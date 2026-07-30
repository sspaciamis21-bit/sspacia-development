import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const DEFAULT_PRODUCTS = [
  'Dedicated Cabin',
  'Executive Cabin',
  'Fixed Desk',
  'Flexi Desk',
  'Virtual Office',
  'Virtual Client',
  'Board Room',
  'Meeting Room',
  'Lounge Room',
  'Private Cabin',
  'Car Parking',
  'Space For Display Wall',
  'Transfer in Fixed Desk',
  'Franking & Notary / Document Charges',
  'Printing Charges',
  'Airtel Broadband LL (3 month Plan)',
  'New Seat Added / Shifted to 7 seater Cabin',
  'Car Parking Space'
];

export async function GET() {
  try {
    let products = await prisma.invoiceProduct.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    if (products.length === 0) {
      await prisma.invoiceProduct.createMany({
        data: DEFAULT_PRODUCTS.map((name) => ({ name })),
        skipDuplicates: true
      });
      products = await prisma.invoiceProduct.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' }
      });
    }

    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error('Fetch products error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    const existing = await prisma.invoiceProduct.findUnique({
      where: { name: trimmedName }
    });

    if (existing) {
      if (!existing.isActive) {
        const updated = await prisma.invoiceProduct.update({
          where: { id: existing.id },
          data: { isActive: true }
        });
        return NextResponse.json({ success: true, data: updated });
      }
      return NextResponse.json({ success: true, data: existing });
    }

    const product = await prisma.invoiceProduct.create({
      data: { name: trimmedName }
    });

    return NextResponse.json({ success: true, data: product }, { status: 201 });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
