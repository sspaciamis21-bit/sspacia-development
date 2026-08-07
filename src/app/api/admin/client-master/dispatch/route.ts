import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { getNodeScopedUserIds, getUserIdsByLocation } from '@/lib/auth/getNodeScopedUserIds';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let userId: number | null = null;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        userId = Number(payload.id);
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sendType = 'MANUAL', clientMasterIds = [], locationId = null } = body;

    // ── Node-based Data Isolation & Super Admin Node Filter for Dispatching ──
    const scopedUserIds = await getNodeScopedUserIds(userId);

    const where: any = {
      clientStatus: 'Active',
    };

    // Filter by explicitly selected Client Master IDs if provided
    if (sendType === 'MANUAL' && Array.isArray(clientMasterIds) && clientMasterIds.length > 0) {
      where.id = { in: clientMasterIds.map(Number) };
    }

    // Super Admin Node Filter: if locationId is passed (e.g. Super Admin filtered by a center)
    if (locationId && locationId !== 'ALL') {
      const locationUserIds = await getUserIdsByLocation(parseInt(String(locationId), 10));
      if (locationUserIds) {
        where.createdById = { in: locationUserIds };
      }
    } else if (scopedUserIds !== null) {
      // Apply node scoping for non-admin Community Managers
      where.createdById = { in: scopedUserIds };
    }

    const clientsToDispatch = await (prisma as any).clientMaster.findMany({
      where,
      include: {
        products: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (clientsToDispatch.length === 0) {
      return NextResponse.json(
        { error: 'No active clients found in the selected center to dispatch.' },
        { status: 400 }
      );
    }

    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentBillingMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    // ── Duplicate prevention for AUTOMATIC_MONTH_END ─────────────
    if (sendType === 'AUTOMATIC_MONTH_END') {
      const existingCount = await (prisma as any).invoiceRecord.count({
        where: {
          billingMonth: currentBillingMonth,
          sendType: 'AUTOMATIC_MONTH_END',
          ...(scopedUserIds !== null ? { createdById: { in: scopedUserIds } } : {}),
        },
      });

      if (existingCount > 0) {
        return NextResponse.json(
          { error: `Month-end dispatch already completed for ${currentBillingMonth} in this center (${existingCount} records exist).` },
          { status: 400 }
        );
      }
    }

    // ── Strict Single Invoice Record Per Client Master Entry ─────────────────
    const existingInvoices = await (prisma as any).invoiceRecord.findMany({
      where: {
        billingMonth: currentBillingMonth,
      },
      select: {
        clientMasterId: true,
      },
    });

    const existingSet = new Set(existingInvoices.map((inv: any) => inv.clientMasterId));

    const invoiceCreates: any[] = [];
    let skippedDuplicatesCount = 0;

    for (const cm of clientsToDispatch) {
      // Skip if an invoice record already exists for this client in current billing month
      if (existingSet.has(cm.id)) {
        skippedDuplicatesCount++;
        continue;
      }

      existingSet.add(cm.id); // Mark as created within this batch

      let totalSeats = 0;
      let subAmount = 0;
      let totalAmt = 0;
      let cabinSummary = 'N/A';

      if (cm.products && cm.products.length > 0) {
        totalSeats = cm.products.reduce((sum: number, p: any) => sum + (Number(p.noOfSeats) || 0), 0);
        subAmount = cm.products.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        totalAmt = cm.products.reduce((sum: number, p: any) => sum + (Number(p.totalAmount) || 0), 0);
        cabinSummary = cm.products.length > 1
          ? `${cm.products.length} Products (${cm.products.map((p: any) => p.cabinName).filter(Boolean).join(', ')})`
          : (cm.products[0].cabinName || cm.cabinName || 'N/A');
      } else {
        totalSeats = Number(cm.noOfSeats) || 0;
        subAmount = Number(cm.amount) || 0;
        totalAmt = Number(cm.totalAmount) || 0;
        cabinSummary = cm.cabinName || 'N/A';
      }

      invoiceCreates.push(
        (prisma as any).invoiceRecord.create({
          data: {
            clientMasterId: cm.id,
            srNo: cm.srNo,
            companyName: cm.companyName,
            cabinName: cabinSummary,
            noOfSeats: totalSeats,
            ratePerAgreement: cm.ratePerAgreement || (cm.products?.[0]?.ratePerAgreement ?? null),
            amount: subAmount,
            gstPercent: cm.gstPercent || (cm.products?.[0]?.gstPercent ?? 18),
            totalAmount: totalAmt,
            gstNo: cm.gstNo,
            billingMonth: currentBillingMonth,
            sendType: sendType === 'AUTOMATIC_MONTH_END' ? 'AUTOMATIC_MONTH_END' : 'MANUAL',
            sentAt: now,
            status: 'PENDING_CM_REVIEW',
            createdById: cm.createdById, // Preserve original CM center/node ownership
          },
        })
      );
    }

    if (invoiceCreates.length === 0) {
      return NextResponse.json(
        {
          error: `Selected client entry(ies) are already present in the Invoices section for ${currentBillingMonth}. Cannot re-dispatch.`,
        },
        { status: 400 }
      );
    }

    const createdInvoiceRecords = await (prisma as any).$transaction(invoiceCreates);

    return NextResponse.json({
      success: true,
      message: `Successfully dispatched ${createdInvoiceRecords.length} entries to Invoices section${skippedDuplicatesCount > 0 ? ` (${skippedDuplicatesCount} already present skipped)` : ''}!`,
      count: createdInvoiceRecords.length,
      skippedDuplicatesCount,
      batchDate: now.toISOString(),
      sendType,
      data: createdInvoiceRecords,
    });
  } catch (error) {
    console.error('Dispatch to invoices error:', error);
    return NextResponse.json(
      { error: 'Failed to dispatch entries to Invoices section' },
      { status: 500 }
    );
  }
}
