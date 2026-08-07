import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';

interface NotificationItem {
  id: number;
  srNo: number;
  companyName: string;
  clientId: string | null;
  targetDate: string;
  daysRemaining: number;
  isExpired: boolean;
  statusTag: 'EXPIRED' | 'URGENT' | 'DUE_SOON';
  type: 'AGREEMENT' | 'LOCK_IN';
  locationName: string;
  contactPersons: { name: string; designation?: string | null; mobileNo?: string | null; email?: string | null }[];
}

/**
 * Creates Nodemailer SMTP transport for Zoho Mail (cm@sspacia.com)
 */
function createSmtpTransport() {
  const hostCandidates = [
    process.env.SMTP_HOST || 'smtppro.zoho.in',
    'smtp.zoho.in',
    'smtppro.zoho.com',
    'smtp.zoho.com',
  ];
  const port = Number(process.env.SMTP_PORT || 465);
  const user = (process.env.SMTP_USER || 'cm@sspacia.com').trim();
  const rawPass = (process.env.SMTP_PASS || 'VXQxVpCnBDZg').trim();
  const pass = rawPass.replace(/\s+/g, ''); // strip spaces from app password

  return {
    transporter: nodemailer.createTransport({
      host: hostCandidates[0],
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    } as nodemailer.TransportOptions),
    sender: user,
  };
}

/**
 * Runs the Daily Agreement & Lock-in Email Automation Engine
 * Groups alerts by center/location and dispatches emails.
 */
export async function runDailyAgreementAlertEmails(overrideReceiver?: string) {
  try {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // 1. Fetch active client master entries with locations and contact persons
    const clientEntries = await (prisma as any).clientMaster.findMany({
      where: {
        clientStatus: { in: ['Active', 'On Notice'] },
        OR: [
          { agreementEndDate: { not: null } },
          { lockinEndDate: { not: null } },
        ],
      },
      select: {
        id: true,
        srNo: true,
        companyName: true,
        clientId: true,
        agreementEndDate: true,
        lockinEndDate: true,
        contactPersons: {
          select: { name: true, designation: true, mobileNo: true, email: true },
          orderBy: { sortOrder: 'asc' },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            assignedLocations: {
              select: {
                location: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { srNo: 'asc' },
    });

    // 2. Group alerts by location/center
    const locationMap: Record<string, {
      locationName: string;
      managerEmails: string[];
      agreements: NotificationItem[];
      lockins: NotificationItem[];
    }> = {};

    for (const entry of clientEntries) {
      const locationName = entry.createdBy?.assignedLocations?.[0]?.location?.name || 'General';
      const managerEmail = entry.createdBy?.email || 'cm@sspacia.com';

      if (!locationMap[locationName]) {
        locationMap[locationName] = {
          locationName,
          managerEmails: [managerEmail],
          agreements: [],
          lockins: [],
        };
      } else if (!locationMap[locationName].managerEmails.includes(managerEmail)) {
        locationMap[locationName].managerEmails.push(managerEmail);
      }

      const contacts = entry.contactPersons || [];

      // 60-Day Agreement End Date Alert
      if (entry.agreementEndDate) {
        const endDate = new Date(entry.agreementEndDate);
        const endDateMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
        const diffTime = endDateMidnight - todayMidnight;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 60) {
          let statusTag: 'EXPIRED' | 'URGENT' | 'DUE_SOON';
          if (daysRemaining < 0) statusTag = 'EXPIRED';
          else if (daysRemaining <= 15) statusTag = 'URGENT';
          else statusTag = 'DUE_SOON';

          locationMap[locationName].agreements.push({
            id: entry.id,
            srNo: entry.srNo,
            companyName: entry.companyName,
            clientId: entry.clientId,
            targetDate: new Date(entry.agreementEndDate).toLocaleDateString('en-IN'),
            daysRemaining,
            isExpired: daysRemaining < 0,
            statusTag,
            type: 'AGREEMENT',
            locationName,
            contactPersons: contacts,
          });
        }
      }

      // 15-Day Lock-in End Date Alert
      if (entry.lockinEndDate) {
        const lockinDate = new Date(entry.lockinEndDate);
        const lockinDateMidnight = new Date(lockinDate.getFullYear(), lockinDate.getMonth(), lockinDate.getDate()).getTime();
        const diffTime = lockinDateMidnight - todayMidnight;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 15) {
          let statusTag: 'EXPIRED' | 'URGENT' | 'DUE_SOON';
          if (daysRemaining < 0) statusTag = 'EXPIRED';
          else if (daysRemaining <= 5) statusTag = 'URGENT';
          else statusTag = 'DUE_SOON';

          locationMap[locationName].lockins.push({
            id: entry.id,
            srNo: entry.srNo,
            companyName: entry.companyName,
            clientId: entry.clientId,
            targetDate: new Date(entry.lockinEndDate).toLocaleDateString('en-IN'),
            daysRemaining,
            isExpired: daysRemaining < 0,
            statusTag,
            type: 'LOCK_IN',
            locationName,
            contactPersons: contacts,
          });
        }
      }
    }

    const { transporter, sender } = createSmtpTransport();
    const sentResults: any[] = [];

    // 3. Dispatch Center-Specific Alert Emails
    for (const [locationName, data] of Object.entries(locationMap)) {
      const { agreements, lockins } = data;

      // Skip sending if no active alerts exist for this center
      if (agreements.length === 0 && lockins.length === 0) {
        continue;
      }

      // Receiver email: user specified cm@sspacia.com for now
      const recipient = overrideReceiver || 'cm@sspacia.com';

      const subject = `🚨 Daily Alert [${locationName}]: ${agreements.length} Agreement & ${lockins.length} Lock-in Expirations`;

      const html = generateAlertEmailHtml(locationName, agreements, lockins);

      const mailOptions = {
        from: `"SSPACIA Control Room" <${sender}>`,
        to: recipient,
        cc: 'praveen.agarwal1@gmail.com',
        subject,
        html,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email Automation] Alert email dispatched for ${locationName} to ${recipient} (Message ID: ${info.messageId})`);

      sentResults.push({
        location: locationName,
        recipient,
        agreementAlertsCount: agreements.length,
        lockinAlertsCount: lockins.length,
        messageId: info.messageId,
      });
    }

    return {
      success: true,
      timestamp: now.toISOString(),
      sentCount: sentResults.length,
      details: sentResults,
    };
  } catch (error) {
    console.error('[Email Automation Error]:', error);
    throw error;
  }
}

/**
 * Generates dark-teal branded HTML Email for Agreement & Lock-in Expiration Alerts
 */
function generateAlertEmailHtml(
  locationName: string,
  agreements: NotificationItem[],
  lockins: NotificationItem[]
): string {
  const currentDateStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const agreementRows = agreements.map((item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-weight: bold; color: #111827;">${item.companyName}</td>
      <td style="padding: 10px; font-family: monospace; color: #4b5563;">${item.clientId || 'N/A'}</td>
      <td style="padding: 10px; font-weight: bold; color: #006064;">${item.targetDate}</td>
      <td style="padding: 10px;">
        <span style="display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 3px; ${
          item.isExpired
            ? 'background-color: #fee2e2; color: #991b1b;'
            : item.daysRemaining <= 15
            ? 'background-color: #fef3c7; color: #92400e;'
            : 'background-color: #e0f2fe; color: #075985;'
        }">
          ${item.isExpired ? `EXPIRED (${Math.abs(item.daysRemaining)} days ago)` : `${item.daysRemaining} days left`}
        </span>
      </td>
      <td style="padding: 10px; font-size: 12px; color: #374151;">
        ${item.contactPersons.slice(0, 2).map((cp) => `<div><strong>${cp.name}</strong> ${cp.mobileNo ? `(${cp.mobileNo})` : ''}</div>`).join('') || 'N/A'}
      </td>
    </tr>
  `).join('');

  const lockinRows = lockins.map((item) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px; font-weight: bold; color: #111827;">${item.companyName}</td>
      <td style="padding: 10px; font-family: monospace; color: #4b5563;">${item.clientId || 'N/A'}</td>
      <td style="padding: 10px; font-weight: bold; color: #b45309;">${item.targetDate}</td>
      <td style="padding: 10px;">
        <span style="display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 3px; ${
          item.isExpired
            ? 'background-color: #fee2e2; color: #991b1b;'
            : 'background-color: #fef3c7; color: #92400e;'
        }">
          ${item.isExpired ? `EXPIRED (${Math.abs(item.daysRemaining)} days ago)` : `${item.daysRemaining} days left`}
        </span>
      </td>
      <td style="padding: 10px; font-size: 12px; color: #374151;">
        ${item.contactPersons.slice(0, 2).map((cp) => `<div><strong>${cp.name}</strong> ${cp.mobileNo ? `(${cp.mobileNo})` : ''}</div>`).join('') || 'N/A'}
      </td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SSPACIA Daily Expiration Alerts</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #1F2937;">
      <div style="max-width: 700px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        
        <!-- HEADER -->
        <div style="background-color: #006064; color: #ffffff; padding: 20px 25px; text-align: left;">
          <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; color: #80deea;">SSPACIA CONTROL ROOM</div>
          <h1 style="margin: 5px 0 0 0; font-size: 20px; font-weight: 800;">Daily Agreement & Lock-in Expiration Alerts</h1>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #b2ebf2;">Center Node: <strong style="color: #ffffff;">${locationName.toUpperCase()}</strong> | Date: ${currentDateStr}</p>
        </div>

        <div style="padding: 25px;">

          <!-- AGREEMENTS SECTION -->
          <div style="margin-bottom: 30px;">
            <div style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #006064; border-bottom: 2px solid #006064; padding-bottom: 6px; margin-bottom: 12px;">
              📅 Agreement End Dates (Within 60 Days / 2 Months) - Count: ${agreements.length}
            </div>
            ${
              agreements.length > 0
                ? `
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f3f4f6; color: #4b5563; text-transform: uppercase; font-size: 10px; font-weight: bold;">
                    <th style="padding: 8px 10px;">Company</th>
                    <th style="padding: 8px 10px;">Client ID</th>
                    <th style="padding: 8px 10px;">End Date</th>
                    <th style="padding: 8px 10px;">Status</th>
                    <th style="padding: 8px 10px;">Contact Person</th>
                  </tr>
                </thead>
                <tbody>
                  ${agreementRows}
                </tbody>
              </table>
              `
                : `<p style="font-size: 12px; color: #6b7280; font-style: italic;">No agreement end dates expiring within 60 days for ${locationName}.</p>`
            }
          </div>

          <!-- LOCK-INS SECTION -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 6px; margin-bottom: 12px;">
              🔒 Lock-in Expirations (Within 15 Days) - Count: ${lockins.length}
            </div>
            ${
              lockins.length > 0
                ? `
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                <thead>
                  <tr style="background-color: #f3f4f6; color: #4b5563; text-transform: uppercase; font-size: 10px; font-weight: bold;">
                    <th style="padding: 8px 10px;">Company</th>
                    <th style="padding: 8px 10px;">Client ID</th>
                    <th style="padding: 8px 10px;">Lock-in End</th>
                    <th style="padding: 8px 10px;">Status</th>
                    <th style="padding: 8px 10px;">Contact Person</th>
                  </tr>
                </thead>
                <tbody>
                  ${lockinRows}
                </tbody>
              </table>
              `
                : `<p style="font-size: 12px; color: #6b7280; font-style: italic;">No lock-in periods expiring within 15 days for ${locationName}.</p>`
            }
          </div>

          <!-- FOOTER -->
          <div style="border-t: 1px solid #e5e7eb; padding-top: 15px; margin-top: 25px; text-align: center; font-size: 11px; color: #9ca3af;">
            This is an automated daily system alert dispatched at 9:00 AM from <strong>cm@sspacia.com</strong>.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
