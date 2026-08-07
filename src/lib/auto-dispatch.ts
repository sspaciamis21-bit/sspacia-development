import prisma from '@/lib/prisma';

/**
 * Auto-dispatches all active ClientMaster entries to InvoiceRecords
 * on the last day of the month. Creates 1 single consolidated invoice per client.
 * Prioritizes products array sum so multi-product clients get exact grand totals.
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

    // Create 1 InvoiceRecord entry per client
    const invoiceCreates: any[] = [];

    for (const cm of clientsToDispatch) {
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
            sendType: 'AUTOMATIC_MONTH_END',
            sentAt: now,
            status: 'PENDING_CM_REVIEW',
            createdById: cm.createdById,
          },
        })
      );
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
