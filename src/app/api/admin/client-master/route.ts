import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { getNodeScopedUserIds, getUserIdsByLocation } from '@/lib/auth/getNodeScopedUserIds';
import { mapClientMasterPayload } from '@/lib/client-master-payload';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Authenticate the current user
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let currentUserId: number | null = null;
    let isAdmin = false;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        currentUserId = Number(payload.id);
        const role = (payload.role as string || '').toUpperCase();
        isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPER-ADMIN';
      }
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const clientStatus = searchParams.get('clientStatus');
    const status = searchParams.get('status');
    const locationId = searchParams.get('locationId'); // Admin filter by node

    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { gstNo: { contains: search } },
        { clientId: { contains: search } },
        { tanNo: { contains: search } },
        { cabinName: { contains: search } },
      ];
    }

    if (clientStatus && clientStatus !== 'ALL') {
      where.clientStatus = clientStatus;
    }

    // ── Node-based data isolation ────────────────────────────────
    if (currentUserId) {
      // Admin filtering by specific location
      if (isAdmin && locationId && locationId !== 'ALL') {
        const locationUserIds = await getUserIdsByLocation(parseInt(locationId, 10));
        if (locationUserIds) {
          where.createdById = { in: locationUserIds };
        }
      } else {
        // Node scoping for CMs (returns null for admins = no filter)
        const scopedUserIds = await getNodeScopedUserIds(currentUserId);
        if (scopedUserIds !== null) {
          where.createdById = { in: scopedUserIds };
        }
      }
    }

    const entries = await (prisma as any).clientMaster.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            assignedLocations: {
              select: {
                location: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        contactPersons: {
          orderBy: { sortOrder: 'asc' },
        },
        products: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { srNo: 'asc' },
    });

    // Determine current billing month to mark entries already present in Invoices section
    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentBillingMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const dispatchedInvoices = await (prisma as any).invoiceRecord.findMany({
      where: { billingMonth: currentBillingMonth },
      select: { clientMasterId: true },
    });
    const dispatchedSet = new Set(dispatchedInvoices.map((inv: any) => inv.clientMasterId));

    const dataWithInvoiceStatus = entries.map((entry: any) => ({
      ...entry,
      isDispatchedToInvoices: dispatchedSet.has(entry.id),
    }));

    return NextResponse.json({ success: true, data: dataWithInvoiceStatus });
  } catch (error) {
    console.error('Fetch client master entries error:', error);
    return NextResponse.json({ error: 'Failed to fetch client master entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let userId = 1;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        userId = Number(payload.id);
      }
    }

    const body = await request.json();
    const mapped = mapClientMasterPayload(body);
    const { contactPersons, products, ...clientData } = mapped;

    if (!clientData.companyName) {
      return NextResponse.json(
        { error: 'Company Name is required.' },
        { status: 400 }
      );
    }

    // Auto calculate next SR No starting from 1
    const lastRecord = await (prisma as any).clientMaster.findFirst({
      orderBy: { srNo: 'desc' },
      select: { srNo: true },
    });

    const nextSrNo = lastRecord ? lastRecord.srNo + 1 : 1;

    const newEntry = await (prisma as any).clientMaster.create({
      data: {
        srNo: nextSrNo,
        ...clientData,
        createdById: userId,
        contactPersons: {
          create: contactPersons.map((cp: any, idx: number) => ({
            name: String(cp.name || '').trim(),
            designation: cp.designation ? String(cp.designation).trim() : null,
            mobileNo: cp.mobileNo ? String(cp.mobileNo).trim() : null,
            email: cp.email ? String(cp.email).trim() : null,
            sortOrder: idx,
          })),
        },
        products: {
          create: products,
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            assignedLocations: {
              select: {
                location: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        contactPersons: true,
        products: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
  } catch (error) {
    console.error('Create client master error:', error);
    return NextResponse.json({ error: 'Failed to create client master entry' }, { status: 500 });
  }
}
