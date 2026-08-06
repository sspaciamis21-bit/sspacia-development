import prisma from '@/lib/prisma';

/**
 * Auto-dispatches all active ClientMaster entries to InvoiceRecords
 * on the last day of the month. Safe to call multiple times — 
 * has built-in duplicate prevention.
 * 
 * Called automatically when anyone opens the Invoices page.
 */
export async function autoDispatchIfLastDay(): Promise<{ dispatched: boolean; count: number; message: string }> {
  try {
    const now = new Date();
    const today = now.getDate();
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Only run on the last day of the month
    if (today !== lastDayOfMonth) {
      return { dispatched: false, count: 0, message: 'Not the last day of the month' };
    }

    // Build billing month string
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentBillingMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    // Duplicate prevention: skip if already dispatched this month
    const existingCount = await (prisma as any).invoiceRecord.count({
      where: {
        billingMonth: currentBillingMonth,
        sendType: 'AUTOMATIC_MONTH_END',
      },
    });

    if (existingCount > 0) {
      return { dispatched: false, count: 0, message: `Already dispatched for ${currentBillingMonth}` };
    }

    // Fetch all active clients with their products
    const clientsToDispatch = await (prisma as any).clientMaster.findMany({
      where: { clientStatus: 'Active' },
      include: {
        products: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (clientsToDispatch.length === 0) {
      return { dispatched: false, count: 0, message: 'No active clients found' };
    }

    // Create InvoiceRecord entries
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
              sendType: 'AUTOMATIC_MONTH_END',
              sentAt: now,
              status: 'PENDING_CM_REVIEW',
              createdById: cm.createdById,
            },
          })
        );
      }
    }

    const createdRecords = await (prisma as any).$transaction(invoiceCreates);

    console.log(`[Auto-Dispatch] ${currentBillingMonth}: ${createdRecords.length} invoice entries created from ${clientsToDispatch.length} active clients.`);

    return {
      dispatched: true,
      count: createdRecords.length,
      message: `Auto-dispatched ${createdRecords.length} entries for ${currentBillingMonth}`,
    };
  } catch (error) {
    console.error('[Auto-Dispatch] Error:', error);
    return { dispatched: false, count: 0, message: 'Auto-dispatch error' };
  }
}
