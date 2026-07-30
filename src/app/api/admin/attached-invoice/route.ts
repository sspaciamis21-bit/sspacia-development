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
    const { entryId, fileUrl, fileName, fileSize } = body;

    if (!entryId || !fileUrl) {
      return NextResponse.json(
        { error: 'entryId and fileUrl are required' },
        { status: 400 }
      );
    }

    const numInvoiceRecordId = Number(entryId);

    const invoiceRecord = await (prisma as any).invoiceRecord.findUnique({
      where: { id: numInvoiceRecordId },
    });

    if (!invoiceRecord) {
      return NextResponse.json({ error: 'Invoice record not found' }, { status: 404 });
    }

    const attachedInvoice = await (prisma as any).attachedInvoice.upsert({
      where: { invoiceRecordId: numInvoiceRecordId },
      create: {
        invoiceRecordId: numInvoiceRecordId,
        fileUrl,
        fileName: fileName || 'Invoice.pdf',
        fileSize: fileSize ? Number(fileSize) : null,
        uploadedById: userId,
      },
      update: {
        fileUrl,
        fileName: fileName || 'Invoice.pdf',
        fileSize: fileSize ? Number(fileSize) : null,
        uploadedById: userId,
        updatedAt: new Date(),
      },
    });

    // Automatically update status to INVOICE_ATTACHED
    await (prisma as any).invoiceRecord.update({
      where: { id: numInvoiceRecordId },
      data: {
        status: 'INVOICE_ATTACHED',
      },
    });

    return NextResponse.json({
      success: true,
      data: attachedInvoice,
    });
  } catch (error) {
    console.error('Attach invoice error:', error);
    return NextResponse.json({ error: 'Failed to attach invoice' }, { status: 500 });
  }
}
