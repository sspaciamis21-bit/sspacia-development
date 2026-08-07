import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    // 1. Authenticate Super Admin
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    const role = ((payload?.role as string) || '').toUpperCase();

    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'SUPER-ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const sender = (body.sender || 'cm@sspacia.com').trim();
    const receiver = (body.receiver || 'savdiyatushar17@gmail.com').trim();
    const subject = (body.subject || 'test').trim();
    const content = (body.body || 'hey it was just a test').trim();

    // Custom SMTP options or defaults (Zoho Mail with App Password)
    const customHost = (body.smtpHost || process.env.SMTP_HOST || 'smtppro.zoho.in').trim();
    const customPort = Number(body.smtpPort || process.env.SMTP_PORT || 465);
    const smtpUser = (body.smtpUser || process.env.SMTP_USER || sender).trim();
    
    // Clean spaces from App Password if provided with spaces (e.g. VXQx VpCn BDZg -> VXQxVpCnBDZg)
    const rawPass = (body.smtpPass || process.env.SMTP_PASS || 'VXQxVpCnBDZg').trim();
    const smtpPass = rawPass.replace(/\s+/g, '');

    if (!receiver) {
      return NextResponse.json({ error: 'Receiver email is required' }, { status: 400 });
    }

    // Process transient in-memory attachments (Zero DB storage)
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    const mailAttachments = rawAttachments.map((att: { filename: string; content: string }) => ({
      filename: att.filename,
      content: Buffer.from(att.content, 'base64'),
    }));

    const attachmentNamesStr = mailAttachments.map((a: { filename: string }) => a.filename).join(', ');

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1B1C1C; max-width: 600px; border: 1px solid #e0e0e0;">
        <div style="background-color: #006064; color: white; padding: 15px; text-align: center;">
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">SSPACIA Communication System</h2>
        </div>
        <div style="padding: 20px; background-color: #ffffff;">
          <p style="font-size: 13px; font-weight: bold; color: #616161; text-transform: uppercase; margin-bottom: 15px;">
            Subject: ${subject}
          </p>
          <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #006064; font-size: 14px; line-height: 1.6;">
            ${content.replace(/\n/g, '<br/>')}
          </div>
          ${
            mailAttachments.length > 0
              ? `<div style="margin-top: 15px; padding: 10px; background-color: #eef6f7; border: 1px solid #b2dfdb; font-size: 12px; color: #006064;">
                  <strong>📎 Attached Files (${mailAttachments.length}):</strong> ${attachmentNamesStr}
                 </div>`
              : ''
          }
          <p style="font-size: 11px; color: #9e9e9e; margin-top: 25px; border-top: 1px solid #eee; padding-top: 10px;">
            Sent from <strong>${sender}</strong> to <strong>${receiver}</strong> via Zoho SMTP.
          </p>
        </div>
      </div>
    `;

    // Candidate configurations (Hosts and Ports)
    const configsToTry = [
      { host: customHost, port: customPort },
      { host: 'smtppro.zoho.in', port: 465 },
      { host: 'smtp.zoho.in', port: 465 },
      { host: 'smtp.zoho.in', port: 587 },
      { host: 'smtppro.zoho.com', port: 465 },
      { host: 'smtp.zoho.com', port: 465 },
      { host: 'smtp.zoho.com', port: 587 },
    ];

    let lastError: any = new Error('No SMTP configurations responded');

    for (const cfg of configsToTry) {
      try {
        const isSecure = cfg.port === 465;
        const transporter = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: isSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          tls: {
            rejectUnauthorized: false,
          },
        } as any);

        const info = await transporter.sendMail({
          from: `SSPACIA Admin <${sender}>`,
          to: receiver,
          cc: 'praveen.agarwal1@gmail.com',
          subject: subject,
          text: content,
          attachments: mailAttachments,
          html: htmlBody,
        });

        return NextResponse.json({
          success: true,
          message: `Email successfully delivered to ${receiver} via ${cfg.host}:${cfg.port}`,
          messageId: info.messageId,
          details: { from: sender, to: receiver, subject, host: cfg.host, port: cfg.port, attachmentCount: mailAttachments.length, response: info.response },
        });
      } catch (err: any) {
        console.warn(`Zoho SMTP attempt failed on ${cfg.host}:${cfg.port}:`, err?.message || err);
        lastError = err || new Error(`Failed to connect to ${cfg.host}:${cfg.port}`);

        const errMsg = String(err?.message || '').toLowerCase();
        if (err?.responseCode === 535 || errMsg.includes('535') || errMsg.includes('invalid password') || errMsg.includes('authentication failed')) {
          // If auth failed, try standard password 'sspacia26' as fallback
          try {
            const fallbackTransporter = nodemailer.createTransport({
              host: cfg.host,
              port: cfg.port,
              secure: cfg.port === 465,
              auth: { user: smtpUser, pass: 'sspacia26' },
              tls: { rejectUnauthorized: false },
            } as any);

            const fallbackInfo = await fallbackTransporter.sendMail({
              from: `SSPACIA Admin <${sender}>`,
              to: receiver,
              subject: subject,
              text: content,
              attachments: mailAttachments,
              html: htmlBody,
            });

            return NextResponse.json({
              success: true,
              message: `Email successfully delivered to ${receiver} via ${cfg.host}:${cfg.port}`,
              messageId: fallbackInfo.messageId,
              details: { from: sender, to: receiver, subject, host: cfg.host, port: cfg.port, attachmentCount: mailAttachments.length, response: fallbackInfo.response },
            });
          } catch {
            break;
          }
        }
      }
    }

    throw lastError;
  } catch (error: any) {
    console.error('Direct Zoho SMTP email sending error:', error);

    const errMsg = String(error?.message || '').toLowerCase();
    const isZohoAuthErr = error?.responseCode === 535 || errMsg.includes('535') || errMsg.includes('authentication failed') || errMsg.includes('invalid password');

    return NextResponse.json(
      {
        error: isZohoAuthErr ? 'Zoho SMTP Authentication Failed (535)' : 'SMTP Email Delivery Failed',
        message: error?.message || 'Zoho SMTP Error',
        code: error?.code || 'ZOHO_SMTP_ERROR',
        hint: isZohoAuthErr
          ? 'Zoho rejected the login. Ensure "SMTP Access" is CHECKED under Zoho Mail Settings (mail.zoho.in -> Settings ⚙️ -> Mail Accounts -> cm@sspacia.com -> SMTP Access checkbox).'
          : 'Check SMTP host settings (smtppro.zoho.in / smtp.zoho.in, Port 465 / 587).',
      },
      { status: 500 }
    );
  }
}
