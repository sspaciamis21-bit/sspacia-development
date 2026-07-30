import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const centreId = searchParams.get('centreId');

    const where: any = {};

    if (search) {
      where.OR = [
        { client: { contains: search } },
        { company: { contains: search } },
        { gstNo: { contains: search } },
      ];
    }

    if (centreId && centreId !== 'ALL') {
      where.centreId = Number(centreId);
    }

    const entries = await (prisma as any).billingEntry.findMany({
      where,
      include: {
        centre: {
          select: { id: true, name: true, slug: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        items: {
          orderBy: { sortOrder: 'asc' },
        },
        attachedInvoice: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error('Fetch billing entries error:', error);
    return NextResponse.json({ error: 'Failed to fetch billing entries' }, { status: 500 });
  }
}

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

    if (!centreId || !company || !client) {
      return NextResponse.json(
        { error: 'Centre, Company, and Client name are required fields.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one product line item is required.' },
        { status: 400 }
      );
    }

    const newEntry = await (prisma as any).billingEntry.create({
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
        createdById: userId,
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

    return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
  } catch (error) {
    console.error('Create billing entry error:', error);
    return NextResponse.json({ error: 'Failed to create billing entry' }, { status: 500 });
  }
}
