import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const entries = await (prisma as any).clientMaster.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        contactPersons: true,
        attachedInvoice: true,
      },
      orderBy: { srNo: 'desc' },
    });

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error('Fetch billing entries error:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return NextResponse.json({ error: 'Please use /api/admin/client-master endpoint' }, { status: 400 });
}
