import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withPermission } from '@/lib/auth/withPermission';
import { requireAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

// ─── Helper ──────────────────────────────────────────────────────────────────
async function generateTicketNumber(): Promise<string> {
  const last = await prisma.supportTicket.findFirst({
    orderBy: { id: 'desc' },
    select: { ticketNumber: true },
  });
  if (!last?.ticketNumber?.startsWith('TKT-')) return 'TKT-1000';
  const num = parseInt(last.ticketNumber.replace('TKT-', ''), 10);
  return isNaN(num) ? 'TKT-1000' : `TKT-${num + 1}`;
}

// ─── GET /api/admin/tickets ───────────────────────────────────────────────────
// Returns tickets scoped to the caller's assigned locations.
// If no locations assigned → returns all (admin behaviour).
// Supports: ?page, ?limit, ?statusId, ?priority
export const GET = withPermission('tickets', 'view', async (req: NextRequest) => {
  try {
    const payload = await requireAuth();
    if (!payload?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const userId = Number(payload.id);
    const { searchParams } = req.nextUrl;

    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1',  10));
    const limit    = Math.max(1, Math.min(100, parseInt(searchParams.get('limit')    ?? '50', 10)));
    const skip     = (page - 1) * limit;
    const statusId = searchParams.get('statusId') ? parseInt(searchParams.get('statusId')!, 10) : undefined;
    const priority = searchParams.get('priority');

    // Fetch user's assigned locations and role for scoping
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: { 
        email: true,
        role: { select: { name: true } },
        assignedLocations: { select: { locationId: true } } 
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const roleName = user.role?.name?.toLowerCase() || '';
    const isMember = roleName === 'user' || roleName === 'member' || roleName === 'customer';
    
    const locationIds = user.assignedLocations.map((al) => al.locationId);

    const whereClause: Prisma.SupportTicketWhereInput = {
      ...(!isMember && locationIds.length > 0 ? { locationId: { in: locationIds } } : {}),
      ...(isMember ? { email: user.email } : {}),
      ...(statusId && !isNaN(statusId) ? { statusId } : {}),
      ...(priority ? { priority: String(priority).toUpperCase() } : {}),
    };

    const [total, tickets] = await prisma.$transaction([
      prisma.supportTicket.count({ where: whereClause }),
      prisma.supportTicket.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          ticketNumber: true,
          name: true,
          email: true,
          phone: true,
          description: true,
          category: true,
          subCategory: true,
          spaceType: true,
          location: true,
          createdAt: true,
          updatedAt: true,
          status: {
            select: { id: true, name: true, displayName: true, color: true },
          },
          locationRel: { select: { id: true, name: true } },
          productTypeId: true,
          productType: { select: { id: true, name: true, displayName: true } },
          customer: { select: { id: true, name: true, email: true } },
          attachments: { select: { id: true, url: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const now = new Date().getTime();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData = (tickets as any[]).map((t) => {
      const createdAtMs = new Date(t.createdAt).getTime();
      const hoursOpen = Math.floor((now - createdAtMs) / (1000 * 60 * 60));
      const statusName = (t.status?.name || '').toUpperCase();
      const isFinalStatus = ['RESOLVED', 'CLOSED'].includes(statusName) || Boolean(t.status?.isFinal);
      const isEscalated = !isFinalStatus && hoursOpen >= 48;

      return {
        ...t,
        // Frontend expects 'user' object for reporter info
        user: t.customer ? { name: t.customer.name, email: t.customer.email } : (t.name ? { name: t.name, email: t.email } : null),
        customer: undefined, // simplify the response
        hoursOpen,
        isEscalated,
        escalatedHours: isEscalated ? hoursOpen - 48 : 0,
      };
    });

    const escalatedCount = responseData.filter(t => t.isEscalated).length;

    return NextResponse.json({
      data: responseData,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), escalatedCount },
    });
  } catch (error) {
    console.error('[TICKETS_READ]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ─── POST /api/admin/tickets ──────────────────────────────────────────────────
// Create a support ticket (any authenticated user with tickets:create permission).
export const POST = withPermission('tickets', 'create', async (req: NextRequest) => {
  try {
    const payload = await requireAuth();
    if (!payload?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const { name, description, organization, productTypeId, locationId, filestackUrls, category, subCategory } = body;

    // 1. Validate
    if (!name || !description) {
      return NextResponse.json(
        { error: 'name and description are required' },
        { status: 400 }
      );
    }

    // 2. Resolve user → customer
    const userId = Number(payload.id);
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, phone: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let customer = await prisma.customer.findUnique({
      where: { email: dbUser.email },
      select: { id: true },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name:         dbUser.name,
          email:        dbUser.email,
          phone:        dbUser.phone ?? undefined,
          organization: organization ? String(organization) : undefined,
        },
        select: { id: true },
      });
    }

    const ticketNumber = await generateTicketNumber();

    const openStatus = await prisma.ticketStatus.findFirst({
      where: { name: { in: ['OPEN', 'Open', 'PENDING', 'Pending'] } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });

    const attachments =
      Array.isArray(filestackUrls) && filestackUrls.length > 0
        ? { create: (filestackUrls as string[]).map((url) => ({ url })) }
        : undefined;

    // 3. Create + activity log
    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.supportTicket.create({
        data: {
          ticketNumber,
          name:          String(name),
          email:         dbUser.email,
          phone:         dbUser.phone ?? undefined,
          organization:  organization ? String(organization) : undefined,
          locationId:    locationId  ? parseInt(String(locationId),  10) : undefined,
          productTypeId: productTypeId ? parseInt(String(productTypeId), 10) : undefined,
          category:      category ? String(category) : undefined,
          subCategory:   subCategory ? String(subCategory) : undefined,
          description:   String(description),
          customerId:    customer!.id,
          statusId:      openStatus?.id ?? 1,
          attachments,
        },
        select: {
          id: true,
          ticketNumber: true,
          name: true,
          email: true,
          status: { select: { id: true, name: true, displayName: true } },
          attachments: { select: { id: true, url: true } },
          createdAt: true,
        },
      });

      // 4. Activity log
      await tx.activityLog.create({
        data: {
          userId:    userId,
          action:    'CREATE',
          module:    'tickets',
          recordId:  t.id,
          newData:   JSON.stringify(t),
          ipAddress: req.headers.get('x-forwarded-for') ?? null,
        },
      });

      return t;
    });

    return NextResponse.json({ data: ticket, message: 'Created successfully' }, { status: 201 });
  } catch (error) {
    console.error('[TICKETS_CREATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ─── PATCH /api/admin/tickets ─────────────────────────────────────────────────
// Update ticket status. Body: { id, statusId } OR { id, status (name) }
export const PATCH = withPermission('tickets', 'update', async (req: NextRequest) => {
  try {
    const payload = await requireAuth();
    if (!payload?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const id = parseInt(String(body.id ?? ''), 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Valid ticket id is required' }, { status: 400 });
    }

    let statusId = body.statusId ? parseInt(String(body.statusId), 10) : undefined;
    const statusName = body.status ? String(body.status) : undefined;

    // Resolve name to ID if needed
    if (!statusId && statusName) {
      const match = await prisma.ticketStatus.findFirst({
        where: { name: { equals: statusName } },
        select: { id: true },
      });
      if (match) statusId = match.id;
    }

    if (!statusId || isNaN(statusId)) {
      return NextResponse.json(
        { error: 'id and statusId (or valid status name) are required' },
        { status: 400 }
      );
    }

    // 2. Check existence
    const existing = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, statusId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 3. Update + activity log
    const ticket = await prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id },
        data: { statusId: statusId! },
        select: {
          id: true,
          ticketNumber: true,
          status: { select: { id: true, name: true, displayName: true } },
          updatedAt: true,
        },
      });

      // 4. Activity log
      await tx.activityLog.create({
        data: {
          userId:    Number(payload.id),
          action:    'UPDATE',
          module:    'tickets',
          recordId:  id,
          oldData:   JSON.stringify(existing),
          newData:   JSON.stringify(updated),
          ipAddress: req.headers.get('x-forwarded-for') ?? null,
        },
      });

      return updated;
    });

    return NextResponse.json({ data: ticket });
  } catch (error) {
    console.error('[TICKETS_UPDATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
