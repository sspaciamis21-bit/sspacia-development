import prisma from '@/lib/prisma';

/**
 * Auto-dispatches all active ClientMaster entries to InvoiceRecords
 * on the last day of the month. Creates 1 single consolidated invoice per client.
 * Safe to call multiple times — has built-in duplicate prevention.
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
