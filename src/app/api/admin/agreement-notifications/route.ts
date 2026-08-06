import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { getNodeScopedUserIds } from '@/lib/auth/getNodeScopedUserIds';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let currentUserId: number | null = null;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        currentUserId = Number(payload.id);
      }
    }

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Node-scoped user IDs filter for Community Managers / Admins
    const scopedUserIds = await getNodeScopedUserIds(currentUserId);
    const where: any = {
      clientStatus: { in: ['Active', 'On Notice'] },
      OR: [
        { agreementEndDate: { not: null } },
        { lockinEndDate: { not: null } },
      ],
    };

    if (scopedUserIds !== null) {
      where.createdById = { in: scopedUserIds };
    }

    const clientEntries = await (prisma as any).clientMaster.findMany({
      where,
      select: {
        id: true,
        srNo: true,
        companyName: true,
        agreementStartDate: true,
        agreementEndDate: true,
        lockinEndDate: true,
        noticePeriodMonths: true,
        noticePeriodApplicable: true,
        clientStatus: true,
        cabinName: true,
        noOfSeats: true,
        totalAmount: true,
        contactPersons: {
          select: {
            id: true,
            name: true,
            designation: true,
            mobileNo: true,
            email: true,
          },
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
      orderBy: { srNo: 'desc' },
    });

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const agreementNotifications: any[] = [];
    const lockinNotifications: any[] = [];

    for (const entry of clientEntries) {
      const locationName = entry.createdBy?.assignedLocations?.[0]?.location?.name || null;
      const baseInfo = {
        id: entry.id,
        srNo: entry.srNo,
        companyName: entry.companyName,
        agreementStartDate: entry.agreementStartDate,
        agreementEndDate: entry.agreementEndDate,
        lockinEndDate: entry.lockinEndDate,
        noticePeriodMonths: entry.noticePeriodMonths,
        noticePeriodApplicable: entry.noticePeriodApplicable,
        cabinName: entry.cabinName,
        noOfSeats: entry.noOfSeats,
        totalAmount: entry.totalAmount,
        contactPersons: entry.contactPersons || [],
        locationName,
      };

      // 1. AGREEMENT END DATE ALERTS: 2 months prior (<= 60 days) or expired
      if (entry.agreementEndDate) {
        const endDate = new Date(entry.agreementEndDate);
        const endDateMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
        const diffTime = endDateMidnight - todayMidnight;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 60) {
          let statusTag: 'EXPIRED' | 'URGENT' | 'DUE_SOON';
          if (daysRemaining < 0) {
            statusTag = 'EXPIRED';
          } else if (daysRemaining <= 15) {
            statusTag = 'URGENT';
          } else {
            statusTag = 'DUE_SOON';
          }

          agreementNotifications.push({
            ...baseInfo,
            targetDate: entry.agreementEndDate,
            daysRemaining,
            isExpired: daysRemaining < 0,
            statusTag,
            type: 'AGREEMENT',
          });
        }
      }

      // 2. LOCK-IN END DATE ALERTS: 15 days prior (<= 15 days) or expired
      if (entry.lockinEndDate) {
        const lockinDate = new Date(entry.lockinEndDate);
        const lockinDateMidnight = new Date(lockinDate.getFullYear(), lockinDate.getMonth(), lockinDate.getDate()).getTime();
        const diffTime = lockinDateMidnight - todayMidnight;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 15) {
          let statusTag: 'EXPIRED' | 'URGENT' | 'DUE_SOON';
          if (daysRemaining < 0) {
            statusTag = 'EXPIRED';
          } else if (daysRemaining <= 5) {
            statusTag = 'URGENT';
          } else {
            statusTag = 'DUE_SOON';
          }

          lockinNotifications.push({
            ...baseInfo,
            targetDate: entry.lockinEndDate,
            daysRemaining,
            isExpired: daysRemaining < 0,
            statusTag,
            type: 'LOCK_IN',
          });
        }
      }
    }

    // 3. ESCALATED SUPPORT TICKETS (>48 Hours SLA breached by CM)
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const ticketWhere: any = {
      createdAt: { lte: fortyEightHoursAgo },
      status: {
        name: { notIn: ['RESOLVED', 'CLOSED', 'Resolved', 'Closed'] },
      },
    };

    if (scopedUserIds !== null) {
      const currentUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { assignedLocations: { select: { locationId: true } } },
      });
      const myLocIds = currentUser?.assignedLocations.map((ul) => ul.locationId) || [];
      if (myLocIds.length > 0) {
        ticketWhere.locationId = { in: myLocIds };
      }
    }

    const overdueTickets = await prisma.supportTicket.findMany({
      where: ticketWhere,
      select: {
        id: true,
        ticketNumber: true,
        name: true,
        email: true,
        phone: true,
        organization: true,
        category: true,
        subCategory: true,
        description: true,
        createdAt: true,
        status: { select: { id: true, name: true, displayName: true } },
        locationRel: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' }, // oldest / most overdue first
    });

    const ticketEscalations = overdueTickets.map((t) => {
      const hoursOpen = Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60));
      return {
        id: t.id,
        ticketNumber: t.ticketNumber,
        companyName: t.organization || t.customer?.name || t.name,
        reporterName: t.name || t.customer?.name || 'Client',
        email: t.email || t.customer?.email || 'N/A',
        phone: t.phone || 'N/A',
        category: t.category || 'General Issue',
        subCategory: t.subCategory,
        description: t.description,
        createdAt: t.createdAt,
        hoursOpen,
        overdueHours: hoursOpen - 48,
        locationName: t.locationRel?.name || 'General Sector',
        statusName: t.status.displayName || t.status.name,
        type: 'TICKET_ESCALATION',
      };
    });

    // Sort arrays
    agreementNotifications.sort((a, b) => a.daysRemaining - b.daysRemaining);
    lockinNotifications.sort((a, b) => a.daysRemaining - b.daysRemaining);

    const summary = {
      agreementCount: agreementNotifications.length,
      lockinCount: lockinNotifications.length,
      ticketCount: ticketEscalations.length,
      totalCount: agreementNotifications.length + lockinNotifications.length + ticketEscalations.length,
    };

    return NextResponse.json({
      success: true,
      summary,
      agreements: agreementNotifications,
      lockins: lockinNotifications,
      escalatedTickets: ticketEscalations,
    });
  } catch (error) {
    console.error('Agreement, Lock-in & Ticket notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agreement & ticket notifications' },
      { status: 500 }
    );
  }
}
