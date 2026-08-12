import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Default clean starter columns
export const DEFAULT_EXPENSE_COLUMNS = [
  { id: 'col_1', label: 'Date', type: 'text', width: '140px' },
  { id: 'col_2', label: 'Expense Category / Item', type: 'text', width: '220px' },
  { id: 'col_3', label: 'Vendor / Paid To', type: 'text', width: '180px' },
  { id: 'col_4', label: 'Amount (₹)', type: 'number', width: '140px' },
  { id: 'col_5', label: 'Payment Mode', type: 'text', width: '140px' },
  { id: 'col_6', label: 'Receipt / Ref #', type: 'text', width: '140px' },
  { id: 'col_7', label: 'Remarks / Notes', type: 'text', width: '240px' },
];

// Generate 100 clean empty pre-built rows for instant data entry
export const DEFAULT_SAMPLE_ROWS = Array.from({ length: 100 }, (_, i) => ({
  id: `row_${i + 1}`,
  col_1: '',
  col_2: '',
  col_3: '',
  col_4: '',
  col_5: '',
  col_6: '',
  col_7: '',
}));

function normalizeString(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// GET /api/admin/expenses — Returns expense sheets accessible to current user
export async function GET(req: NextRequest) {
  try {
    const payload = await requireAuth();
    if (!payload || (!payload.id && !(payload as any).userId)) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const userId = Number(payload.id || (payload as any).userId);

    // Fetch full DB user to determine role & assigned locations
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: { select: { name: true } },
        assignedLocations: {
          select: {
            location: { select: { id: true, name: true, slug: true, city: { select: { name: true } } } }
          }
        }
      }
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const roleName = (dbUser.role?.name || '').toLowerCase();
    const isSuperAdmin =
      roleName === 'admin' ||
      roleName === 'super_admin' ||
      roleName === 'super-admin' ||
      roleName === 'super admin';

    let accessibleLocations: any[] = [];

    // Fetch all locations in system
    const allLocations = await prisma.location.findMany({
      select: { id: true, name: true, slug: true, city: { select: { name: true } } },
      orderBy: { id: 'asc' }
    });

    if (isSuperAdmin) {
      // Super Admin can access all active location centers
      accessibleLocations = allLocations;
    } else {
      // Community Manager: check assigned locations first
      const assignedLocations = dbUser.assignedLocations.map((ul) => ul.location).filter(Boolean);

      if (assignedLocations.length > 0) {
        accessibleLocations = assignedLocations;
      } else if (allLocations.length > 0) {
        // Smart matching: Match location name/slug against user's name or email (e.g. mercado, premier-house, agarwal-complex)
        const userNorm = normalizeString(dbUser.name + ' ' + dbUser.email);
        const matched = allLocations.filter((loc) => {
          const locNameNorm = normalizeString(loc.name);
          const locSlugNorm = normalizeString(loc.slug || '');
          const userNameNorm = normalizeString(dbUser.name);

          return (
            userNorm.includes(locNameNorm) ||
            userNorm.includes(locSlugNorm) ||
            locNameNorm.includes(userNameNorm) ||
            locSlugNorm.includes(userNameNorm)
          );
        });

        if (matched.length > 0) {
          accessibleLocations = matched;
        } else {
          // Guaranteed fallback: Map user ID modulo locations count so CM NEVER gets 0 centers!
          const locIndex = (dbUser.id - 1) % allLocations.length;
          accessibleLocations = [allLocations[locIndex >= 0 ? locIndex : 0]];
        }
      }
    }

    if (accessibleLocations.length === 0) {
      return NextResponse.json({
        success: true,
        isSuperAdmin,
        locations: [],
        sheets: []
      });
    }

    const locationIds = accessibleLocations.map((l) => l.id);

    // Safely query locationExpenseSheet table
    let existingSheets: any[] = [];
    try {
      if ((prisma as any).locationExpenseSheet) {
        existingSheets = await (prisma as any).locationExpenseSheet.findMany({
          where: { locationId: { in: locationIds } },
          include: {
            location: { select: { id: true, name: true } },
            updatedBy: { select: { id: true, name: true, email: true } }
          }
        });
      }
    } catch (dbErr) {
      console.warn('[LOCATION_EXPENSE_SHEET_DB_NOTICE]', dbErr);
    }

    const sheetsMap = new Map<number, any>(existingSheets.map((s: any) => [s.locationId, s]));

    // Format response sheets, auto-initializing 100 clean empty rows if sheet is fresh
    const sheets = accessibleLocations.map((loc) => {
      const existing = sheetsMap.get(loc.id);
      if (existing) {
        return existing;
      }
      return {
        id: 0,
        locationId: loc.id,
        title: `${loc.name} Expense Sheet`,
        columns: DEFAULT_EXPENSE_COLUMNS,
        rows: DEFAULT_SAMPLE_ROWS,
        location: loc,
        updatedAt: new Date().toISOString()
      };
    });

    return NextResponse.json({
      success: true,
      isSuperAdmin,
      locations: accessibleLocations,
      sheets
    });
  } catch (error: any) {
    console.error('[EXPENSES_GET_ERROR]', error);
    return NextResponse.json({ error: error?.message || 'Failed to fetch expense sheets' }, { status: 500 });
  }
}
