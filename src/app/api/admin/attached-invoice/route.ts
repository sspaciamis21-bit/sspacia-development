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

    const numEntryId = Number(entryId);

    const entry = await (prisma as any).billingEntry.findUnique({
      where: { id: numEntryId },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const attachedInvoice = await (prisma as any).attachedInvoice.upsert({
      where: { entryId: numEntryId },
      create: {
        entryId: numEntryId,
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
    await (prisma as any).billingEntry.update({
      where: { id: numEntryId },
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
