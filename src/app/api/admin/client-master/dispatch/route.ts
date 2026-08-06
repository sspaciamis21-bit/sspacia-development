import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

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
    const { sendType = 'MANUAL', clientMasterIds = [] } = body;

    let clientsToDispatch: any[] = [];

    if (sendType === 'MANUAL' && Array.isArray(clientMasterIds) && clientMasterIds.length > 0) {
      clientsToDispatch = await (prisma as any).clientMaster.findMany({
        where: { id: { in: clientMasterIds.map(Number) } },
        include: {
          products: { orderBy: { sortOrder: 'asc' } },
        },
      });
    } else {
      clientsToDispatch = await (prisma as any).clientMaster.findMany({
        where: { clientStatus: 'Active' },
        include: {
          products: { orderBy: { sortOrder: 'asc' } },
        },
      });
    }

    if (clientsToDispatch.length === 0) {
      return NextResponse.json(
        { error: 'No active clients found to dispatch to Invoices section.' },
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
        },
      });

      if (existingCount > 0) {
        return NextResponse.json(
          { error: `Month-end dispatch already completed for ${currentBillingMonth} (${existingCount} records exist). Cannot dispatch again.` },
          { status: 400 }
        );
      }
    }

    const invoiceCreates: any[] = [];

    for (const cm of clientsToDispatch) {
      const productRows = cm.products?.length > 0
        ? cm.products
        : [{
            cabinName: cm.cabinName,
            noOfSeats: cm.noOfSeats,
            ratePerAgreement: cm.ratePerAgreement,
            amount: cm.amount,
            gstPercent: cm.gstPercent,
            totalAmount: cm.totalAmount,
          }];

      for (const product of productRows) {
        invoiceCreates.push(
          (prisma as any).invoiceRecord.create({
            data: {
              clientMasterId: cm.id,
              srNo: cm.srNo,
              companyName: cm.companyName,
              cabinName: product.cabinName,
              noOfSeats: product.noOfSeats,
              ratePerAgreement: product.ratePerAgreement,
              amount: product.amount,
              gstPercent: product.gstPercent,
              totalAmount: product.totalAmount,
              gstNo: cm.gstNo,
              billingMonth: currentBillingMonth,
              sendType: sendType === 'AUTOMATIC_MONTH_END' ? 'AUTOMATIC_MONTH_END' : 'MANUAL',
              sentAt: now,
              status: 'PENDING_CM_REVIEW',
              createdById: cm.createdById, // Preserve original CM node ownership for data isolation
            },
          })
        );
      }
    }

    const createdInvoiceRecords = await (prisma as any).$transaction(invoiceCreates);

    return NextResponse.json({
      success: true,
      message: `Successfully dispatched ${createdInvoiceRecords.length} entries to Invoices section!`,
      count: createdInvoiceRecords.length,
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
