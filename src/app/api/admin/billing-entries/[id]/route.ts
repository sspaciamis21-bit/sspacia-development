import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    const entry = await (prisma as any).clientMaster.findUnique({
      where: { id: entryId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        contactPersons: true,
        attachedInvoice: true,
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error('Fetch entry error:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    await (prisma as any).clientMaster.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true, message: 'Client entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
