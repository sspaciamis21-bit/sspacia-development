import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    const entry = await prisma.billingEntry.findUnique({
      where: { id: entryId },
      include: {
        centre: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: { orderBy: { sortOrder: 'asc' } },
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    const body = await request.json();
    const {
      centreId,
      company,
      client,
      durationMode = 'HOURS',
      meetingRoomUsedMinutes,
      meetingRoomUsedDays,
      complementaryMinutes,
      complementaryDays,
      toBeChargedMinutes,
      toBeChargedDays,
      boardRoomAmount,
      eventSpaceAmount,
      otherServicesAmount,
      finalAmount,
      lastDateOfPayment,
      gstNo,
      address,
      items = [],
    } = body;

    const existing = await prisma.billingEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Use transaction to update entry and recreate line items
    const updatedEntry = await prisma.$transaction(async (tx) => {
      await tx.billingEntryItem.deleteMany({
        where: { entryId },
      });

      return tx.billingEntry.update({
        where: { id: entryId },
        data: {
          centreId: Number(centreId),
          company: String(company),
          client: String(client).trim(),
          durationMode: durationMode === 'DAYS' ? 'DAYS' : 'HOURS',
          meetingRoomUsedMinutes: meetingRoomUsedMinutes ? Number(meetingRoomUsedMinutes) : null,
          meetingRoomUsedDays: meetingRoomUsedDays ? Number(meetingRoomUsedDays) : null,
          complementaryMinutes: complementaryMinutes ? Number(complementaryMinutes) : null,
          complementaryDays: complementaryDays ? Number(complementaryDays) : null,
          toBeChargedMinutes: toBeChargedMinutes ? Number(toBeChargedMinutes) : null,
          toBeChargedDays: toBeChargedDays ? Number(toBeChargedDays) : null,
          boardRoomAmount: boardRoomAmount ? Number(boardRoomAmount) : 0,
          eventSpaceAmount: eventSpaceAmount ? Number(eventSpaceAmount) : 0,
          otherServicesAmount: otherServicesAmount ? Number(otherServicesAmount) : 0,
          finalAmount: finalAmount ? Number(finalAmount) : 0,
          lastDateOfPayment: lastDateOfPayment ? new Date(lastDateOfPayment) : null,
          gstNo: gstNo ? String(gstNo).trim() : null,
          address: address ? String(address).trim() : null,
          items: {
            create: items.map((item: any, idx: number) => ({
              product: String(item.product).trim(),
              seats: Number(item.seats) || 1,
              ratePerSeat: Number(item.ratePerSeat) || 0,
              fromDate: item.fromDate ? new Date(item.fromDate) : null,
              toDate: item.toDate ? new Date(item.toDate) : null,
              amount: Number(item.amount) || 0,
              sortOrder: idx,
            })),
          },
        },
        include: {
          centre: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          items: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: updatedEntry });
  } catch (error) {
    console.error('Update entry error:', error);
    return NextResponse.json({ error: 'Failed to update billing entry' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entryId = Number(id);

    await prisma.billingEntry.delete({
      where: { id: entryId },
    });

    return NextResponse.json({ success: true, message: 'Billing entry deleted successfully' });
  } catch (error) {
    console.error('Delete entry error:', error);
    return NextResponse.json({ error: 'Failed to delete billing entry' }, { status: 500 });
  }
}
