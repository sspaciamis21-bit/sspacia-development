import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { withPermission } from '@/lib/auth/withPermission';
import { requireAuth } from '@/lib/auth';

// ─── GET /api/admin/locations ────────────────────────────────────────────────
// List all locations with pagination. Scoped to assigned locations if any.
export const GET = withPermission('locations', 'view', async (req: NextRequest) => {
  try {
    const payload = await requireAuth();
    if (!payload?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const userId = Number(payload.id);
    const { searchParams } = req.nextUrl;

    const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10)));
    const skip  = (page - 1) * limit;

    // Determine location scope from assigned locations
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        assignedLocations: { select: { locationId: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const assignedIds = user.assignedLocations.map((al) => al.locationId);
    const scopeWhere = assignedIds.length > 0 ? { id: { in: assignedIds } } : {};

    const [total, locations] = await prisma.$transaction([
      prisma.location.count({ where: scopeWhere }),
      prisma.location.findMany({
        where: scopeWhere,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          address: true,
          phone: true,
          email: true,
          isActive: true,
          sortOrder: true,
          city: { select: { id: true, name: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    return NextResponse.json({
      data: locations,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[LOCATIONS_READ]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ─── POST /api/admin/locations ───────────────────────────────────────────────
// Create a new location.
export const POST = withPermission('locations', 'create', async (req: NextRequest) => {
  try {
    const payload = await requireAuth();
    if (!payload?.id) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;

    // 1. Parse & validate
    const cityId   = parseInt(String(body.cityId ?? ''), 10);
    const name     = String(body.name  ?? '').trim();
    const slug     = String(body.slug  ?? '').trim();

    if (isNaN(cityId) || !name || !slug) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: cityId, name, slug' },
        { status: 400 }
      );
    }

    // 2. Duplicate slug check
    const existing = await prisma.location.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Location with this slug already exists' },
        { status: 400 }
      );
    }

    // 3. Create + activity log in transaction
    const location = await prisma.$transaction(async (tx) => {
      const loc = await tx.location.create({
        data: {
          cityId,
          name,
          slug,
          address:   String(body.address   ?? ''),
          mapUrl:    String(body.mapUrl     ?? ''),
          mapEmbed:  String(body.mapEmbed   ?? ''),
          phone:     String(body.phone      ?? ''),
          email:     String(body.email      ?? ''),
          isActive:  body.isActive !== false,
          sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          sortOrder: true,
          city: { select: { id: true, name: true } },
          createdAt: true,
        },
      });

      // 4. Activity log
      await tx.activityLog.create({
        data: {
          userId:    Number(payload.id),
          action:    'CREATE',
          module:    'locations',
          recordId:  loc.id,
          newData:   JSON.stringify(loc),
          ipAddress: req.headers.get('x-forwarded-for') ?? null,
        },
      });

      return loc;
    });

    return NextResponse.json(
      { data: location, message: 'Created successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('[LOCATIONS_CREATE]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
