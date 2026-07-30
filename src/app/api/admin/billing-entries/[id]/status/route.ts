import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    const body = await request.json();
    const { status, remarks } = body;

    const validStatuses = [
      'DRAFT',
      'SENT_TO_ACCOUNTANT',
      'INVOICE_ATTACHED',
      'APPROVED',
      'REJECTED_WITH_REMARKS',
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
    }

    const updated = await (prisma as any).billingEntry.update({
      where: { id: entryId },
      data: {
        status,
        ...(remarks !== undefined ? { remarks: remarks ? String(remarks).trim() : null } : {}),
      },
      include: {
        centre: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        attachedInvoice: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update entry status error:', error);
    return NextResponse.json({ error: 'Failed to update entry status' }, { status: 500 });
  }
}
