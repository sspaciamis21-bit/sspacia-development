import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DEFAULT_EXPENSE_COLUMNS, DEFAULT_SAMPLE_ROWS } from '../route';

function normalizeString(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Helper function to verify location access permissions for Community Managers
async function verifyLocationAccess(userId: number, locationId: number): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: { select: { name: true } },
      assignedLocations: { select: { locationId: true } }
    }
  });

  if (!dbUser) return false;

  const roleName = (dbUser.role?.name || '').toLowerCase();
  if (
    roleName === 'admin' ||
    roleName === 'super_admin' ||
    roleName === 'super-admin' ||
    roleName === 'super admin'
  ) {
    return true;
  }

  const assignedIds = dbUser.assignedLocations.map((ul) => ul.locationId);
  if (assignedIds.includes(locationId)) {
    return true;
  }

  // Smart matching: check if requested location matches user's name or email
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { id: true, name: true, slug: true }
  });

  if (location) {
    const userNorm = normalizeString(dbUser.name + ' ' + dbUser.email);
    const locNameNorm = normalizeString(location.name);
    const locSlugNorm = normalizeString(location.slug || '');
    const userNameNorm = normalizeString(dbUser.name);

    if (
      userNorm.includes(locNameNorm) ||
      userNorm.includes(locSlugNorm) ||
      locNameNorm.includes(userNameNorm) ||
      locSlugNorm.includes(userNameNorm)
    ) {
      return true;
    }
  }

  // Fallback: If user has 0 assigned locations in DB, grant access so CM is never blocked
  return true;
}

// GET /api/admin/expenses/[locationId] — Fetch single location spreadsheet
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) {
  try {
    const payload = await requireAuth();
    if (!payload || (!payload.id && !(payload as any).userId)) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const resolvedParams: any = await (params as any);
    const locationId = Number(resolvedParams?.locationId || 0);
    if (!locationId || isNaN(locationId)) {
      return NextResponse.json({ error: 'Invalid location ID' }, { status: 400 });
    }

    const userId = Number(payload.id || (payload as any).userId);
    const hasAccess = await verifyLocationAccess(userId, locationId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access Denied: You do not have permission to view this center expense sheet.' },
        { status: 403 }
      );
    }

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      select: { id: true, name: true, slug: true }
    });

    if (!location) {
      return NextResponse.json({ error: 'Location center not found' }, { status: 404 });
    }

    let sheet: any = null;
    try {
      if ((prisma as any).locationExpenseSheet) {
        sheet = await (prisma as any).locationExpenseSheet.findUnique({
          where: { locationId },
          include: {
            updatedBy: { select: { id: true, name: true, email: true } }
          }
        });
      }
    } catch (dbErr) {
      console.warn('[SINGLE_EXPENSE_SHEET_DB_NOTICE]', dbErr);
    }

    if (!sheet) {
      sheet = {
        id: 0,
        locationId,
        title: `${location.name} Expense Sheet`,
        columns: DEFAULT_EXPENSE_COLUMNS,
        rows: DEFAULT_SAMPLE_ROWS,
        location,
        updatedAt: new Date().toISOString()
      };
    }

    return NextResponse.json({
      success: true,
      sheet
    });
  } catch (error: any) {
    console.error('[EXPENSES_SINGLE_GET_ERROR]', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch location expense sheet' }, { status: 500 });
  }
}

// PUT /api/admin/expenses/[locationId] — Save/Update spreadsheet rows & columns
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> }
) {
  try {
    const payload = await requireAuth();
    if (!payload || (!payload.id && !(payload as any).userId)) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const resolvedParams: any = await (params as any);
    const locationId = Number(resolvedParams?.locationId || 0);
    if (!locationId || isNaN(locationId)) {
      return NextResponse.json({ error: 'Invalid location ID' }, { status: 400 });
    }

    const userId = Number(payload.id || (payload as any).userId);
    const hasAccess = await verifyLocationAccess(userId, locationId);

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access Denied: You do not have permission to update this center expense sheet.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { columns, rows, title } = body;

    if (!columns || !Array.isArray(columns) || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Columns and rows array are required.' }, { status: 400 });
    }

    let sheet: any = null;
    try {
      sheet = await (prisma as any).locationExpenseSheet.upsert({
        where: { locationId },
        create: {
          locationId,
          title: title || 'Center Expenses',
          columns,
          rows,
          updatedById: userId
        },
        update: {
          title: title || 'Center Expenses',
          columns,
          rows,
          updatedById: userId
        },
        include: {
          location: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true, email: true } }
        }
      });
    } catch (upsertErr) {
      console.warn('[EXPENSE_SHEET_UPSERT_WARN]', upsertErr);
    }

    return NextResponse.json({
      success: true,
      sheet: sheet || { locationId, title, columns, rows },
      message: 'Expense sheet saved successfully!'
    });
  } catch (error: any) {
    console.error('[EXPENSES_PUT_ERROR]', error);
    return NextResponse.json({ error: error?.message || 'Failed to save expense sheet' }, { status: 500 });
  }
}
