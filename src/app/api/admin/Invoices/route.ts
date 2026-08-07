import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { getNodeScopedUserIds, getUserIdsByLocation } from '@/lib/auth/getNodeScopedUserIds';
import { autoDispatchIfLastDay } from '@/lib/auto-dispatch';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // ── Auto-dispatch on last day of month (runs only once, duplicate-safe) ──
    await autoDispatchIfLastDay();

    // ── Auto-cleanup & Consolidation of multiple invoice records per client for current month ──
    try {
      const now = new Date();
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const currentBillingMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      const allRecords = await (prisma as any).invoiceRecord.findMany({
        where: { billingMonth: currentBillingMonth },
        orderBy: { id: 'desc' },
      });

      // Group records by clientMasterId
      const groupedByClient: Record<number, any[]> = {};
      for (const rec of allRecords) {
        if (!groupedByClient[rec.clientMasterId]) {
          groupedByClient[rec.clientMasterId] = [];
        }
        groupedByClient[rec.clientMasterId].push(rec);
      }

      const duplicateIdsToDelete: number[] = [];

      for (const [rawCmId, recs] of Object.entries(groupedByClient)) {
        if (recs.length > 1) {
          const cmId = Number(rawCmId);
          // Keep the main record (recs[0]) and delete extra split product rows
          const mainRecord = recs[0];
          const extras = recs.slice(1);
          extras.forEach(r => duplicateIdsToDelete.push(r.id));

          // Fetch full ClientMaster data to update mainRecord with consolidated amounts & cabin summary
          const cm = await (prisma as any).clientMaster.findUnique({
            where: { id: cmId },
            include: { products: { orderBy: { sortOrder: 'asc' } } },
          });

          if (cm) {
            const cabinSummary = cm.products && cm.products.length > 0
              ? (cm.products.length > 1
                  ? `${cm.products.length} Products (${cm.products.map((p: any) => p.cabinName).filter(Boolean).join(', ')})`
                  : (cm.products[0].cabinName || cm.cabinName || 'N/A'))
              : (cm.cabinName || 'N/A');

            const totalSeats = cm.products && cm.products.length > 0
              ? cm.products.reduce((acc: number, p: any) => acc + (p.noOfSeats || 0), 0)
              : (cm.noOfSeats || 0);

            const totalAmt = cm.totalAmount || (cm.products ? cm.products.reduce((acc: number, p: any) => acc + (p.totalAmount || 0), 0) : 0);
            const subAmount = cm.amount || (cm.products ? cm.products.reduce((acc: number, p: any) => acc + (p.amount || 0), 0) : 0);

            await (prisma as any).invoiceRecord.update({
              where: { id: mainRecord.id },
              data: {
                cabinName: cabinSummary,
                noOfSeats: totalSeats,
                amount: subAmount,
                gstPercent: cm.gstPercent || (cm.products?.[0]?.gstPercent ?? 18),
                totalAmount: totalAmt,
              },
            });
          }
        }
      }

      if (duplicateIdsToDelete.length > 0) {
        await (prisma as any).attachedInvoice.deleteMany({
          where: { invoiceRecordId: { in: duplicateIdsToDelete } },
        });

        await (prisma as any).invoiceRecord.deleteMany({
          where: { id: { in: duplicateIdsToDelete } },
        });
        console.log(`[Invoices API] Consolidated multiple product rows into 1 invoice per client (deleted ${duplicateIdsToDelete.length} extra split rows for ${currentBillingMonth}).`);
      }
    } catch (cleanErr) {
      console.warn('Deduplication cleanup warning:', cleanErr);
    }

    // Authenticate the current user
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let currentUserId: number | null = null;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        currentUserId = Number(payload.id);
      }
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const sendType = searchParams.get('sendType');
    const locationId = searchParams.get('locationId'); // Filter by node

    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { gstNo: { contains: search } },
        { cabinName: { contains: search } },
      ];
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (sendType && sendType !== 'ALL') {
      where.sendType = sendType;
    }

    // ── Node-based data isolation ────────────────────────────────
    if (currentUserId) {
      if (locationId && locationId !== 'ALL') {
        const locationUserIds = await getUserIdsByLocation(parseInt(locationId, 10));
        if (locationUserIds) {
          where.createdById = { in: locationUserIds };
        }
      } else {
        // Node scoping for CMs (returns null for admins & accountant = no filter)
        const scopedUserIds = await getNodeScopedUserIds(currentUserId);
        if (scopedUserIds !== null) {
          where.createdById = { in: scopedUserIds };
        }
      }
    }

    const invoices = await (prisma as any).invoiceRecord.findMany({
      where,
      include: {
        clientMaster: {
          include: {
            contactPersons: { orderBy: { sortOrder: 'asc' } },
          },
        },
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
        attachedInvoice: true,
      },
      orderBy: { sentAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: invoices });
  } catch (error) {
    console.error('Fetch invoices error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice records' }, { status: 500 });
  }
}
