import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withPermission, type PermissionContext } from '@/lib/auth/withPermission';
import { PAGINATION, LOG_ACTION } from '@/lib/auth/constants';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Returns users scoped to the caller's assigned locations.
// If no locations assigned → returns all (admin behaviour).
// Supports: ?page, ?limit, ?isActive
export const GET = withPermission('users', 'read', async (req: NextRequest, { payload }: PermissionContext) => {
  try {
    const userId = Number(payload.id);
    const { searchParams } = req.nextUrl;

    const page     = Math.max(1, parseInt(searchParams.get('page')  ?? String(PAGINATION.DEFAULT_PAGE),  10));
    const limit    = Math.max(1, Math.min(PAGINATION.MAX_LIMIT, parseInt(searchParams.get('limit') ?? String(PAGINATION.DEFAULT_LIMIT), 10)));
    const skip     = (page - 1) * limit;
    const isActive = searchParams.get('isActive');

    // Fetch caller's assigned locations for scoping
    const caller = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: { assignedLocations: { select: { locationId: true } } },
    });

    if (!caller) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const locationIds = caller.assignedLocations.map((al) => al.locationId);

    const whereClause: Prisma.UserWhereInput = {
      ...(isActive !== null ? { isActive: isActive !== 'false' } : {}),
      ...(locationIds.length > 0
        ? { assignedLocations: { some: { locationId: { in: locationIds } } } }
        : {}),
    };

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where: whereClause }),
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          role: {
            select: { id: true, name: true, displayName: true },
          },
          assignedLocations: {
            select: {
              location: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[USERS_READ]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────
// Create a new user manually.
export const POST = withPermission('users', 'create', async (req: NextRequest, { payload }: PermissionContext) => {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { name, email, password, roleId, assignedLocationIds } = body;

    // Validate
    if (!name || !email || !password || !roleId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, roleId' },
        { status: 400 },
      );
    }

    const rId = parseInt(String(roleId), 10);
    if (isNaN(rId)) {
      return NextResponse.json({ error: 'Invalid roleId' }, { status: 400 });
    }

    // Duplicate check
    const existing = await prisma.user.findUnique({
      where: { email: String(email) },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: 'User already exists with this email' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(String(password), 12);
    const locationIds: number[] = Array.isArray(assignedLocationIds)
      ? assignedLocationIds
          .map((id: any) => parseInt(String(id), 10))
          .filter((id: number) => !isNaN(id) && id > 0)
      : [];

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name:     String(name),
          email:    String(email),
          password: hashedPassword,
          roleId:   rId,
          assignedLocations: {
            create: locationIds.map((locId) => ({ locationId: locId })),
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
          role: { select: { id: true, name: true, displayName: true } },
          assignedLocations: {
            select: { location: { select: { id: true, name: true } } },
          },
        },
      });

      await tx.activityLog.create({
        data: {
          userId:   Number(payload.id),
          action:   LOG_ACTION.CREATE,
          module:   'users',
          recordId: u.id,
          newData:  JSON.stringify({ id: u.id, email: u.email, role: u.role.name }),
          ipAddress: req.headers.get('x-forwarded-for') ?? null,
        },
      });

      return u;
    });

    return NextResponse.json({ data: user, message: 'Created successfully' }, { status: 201 });
  } catch (error) {
    console.error('[USERS_CREATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
