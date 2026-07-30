import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withPermission } from '@/lib/auth/withPermission';
import { requireAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// ─── GET /api/admin/users/[id] ────────────────────────────────────────────────
export const GET = withPermission('users', 'read', async (
  _req: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) => {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        role: { select: { id: true, name: true, displayName: true } },
        assignedLocations: {
          select: { location: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    console.error('[USER_READ_ONE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ─── PATCH /api/admin/users/[id] ──────────────────────────────────────────────
export const PATCH = withPermission('users', 'update', async (
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) => {
  try {
    const payload = await requireAuth();
    if (!payload?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // 2. Check existence
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true, roleId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const body = await req.json() as Record<string, unknown>;
    const { name, email, roleId, isActive, password, assignedLocationIds } = body;

    const data: Record<string, unknown> = {};
    if (name     !== undefined) data.name     = String(name);
    if (email    !== undefined) data.email    = String(email);
    if (roleId   !== undefined) data.roleId   = parseInt(String(roleId), 10);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (password)               data.password = await bcrypt.hash(String(password), 12);

    // 3. Update + handle locations + activity log
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: userId },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          updatedAt: true,
          role: { select: { id: true, name: true, displayName: true } },
          assignedLocations: {
            select: { location: { select: { id: true, name: true } } },
          },
        },
      });

      // Replace location assignments if provided
      if (Array.isArray(assignedLocationIds)) {
        const validLocIds = assignedLocationIds
          .map((id: any) => parseInt(String(id), 10))
          .filter((id: number) => !isNaN(id) && id > 0);

        await tx.userLocation.deleteMany({ where: { userId } });
        if (validLocIds.length > 0) {
          await tx.userLocation.createMany({
            data: validLocIds.map((locId: number) => ({ userId, locationId: locId })),
          });
        }
      }

      // 4. Activity log
      await tx.activityLog.create({
        data: {
          userId:    Number(payload.id),
          action:    'UPDATE',
          module:    'users',
          recordId:  userId,
          oldData:   JSON.stringify(existing),
          newData:   JSON.stringify({ id: u.id, email: u.email }),
          ipAddress: req.headers.get('x-forwarded-for') ?? null,
        },
      });

      return u;
    });

    // Refetch with updated locations
    const refreshed = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        updatedAt: true,
        role: { select: { id: true, name: true, displayName: true } },
        assignedLocations: {
          select: { location: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json({ data: refreshed ?? user });
  } catch (error) {
    console.error('[USER_UPDATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ─── DELETE /api/admin/users/[id] ─────────────────────────────────────────────
export const DELETE = withPermission('users', 'delete', async (
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) => {
  try {
    const payload = await requireAuth();
    if (!payload?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    // 2. Check existence
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 3. Delete + activity log
    await prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: userId } });

      // 4. Activity log
      await tx.activityLog.create({
        data: {
          userId:    Number(payload.id),
          action:    'DELETE',
          module:    'users',
          recordId:  userId,
          oldData:   JSON.stringify(existing),
          newData:   null,
          ipAddress: req.headers.get('x-forwarded-for') ?? null,
        },
      });
    });

    return NextResponse.json({ data: { message: 'User deleted successfully' } });
  } catch (error) {
    console.error('[USER_DELETE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
