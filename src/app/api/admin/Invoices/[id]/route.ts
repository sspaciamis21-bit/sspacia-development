import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { getNodeScopedUserIds } from '@/lib/auth/getNodeScopedUserIds';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let userId: number | null = null;
    let isAdmin = false;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        userId = Number(payload.id);
        const role = (payload.role as string || '').toUpperCase();
        isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPER-ADMIN';
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Node scoping verification for non-admins
    if (!isAdmin) {
      const scopedUserIds = await getNodeScopedUserIds(userId);
      if (scopedUserIds !== null) {
        const existingRecord = await (prisma as any).invoiceRecord.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!existingRecord || !scopedUserIds.includes(existingRecord.createdById)) {
          return NextResponse.json({ error: 'Forbidden: You cannot edit invoices from another center' }, { status: 403 });
        }
      }
    }

    const body = await request.json();
    const {
      companyName,
      cabinName,
      noOfSeats,
      ratePerAgreement,
      amount,
      gstPercent,
      totalAmount,
      gstNo,
      billingMonth,
      status,
    } = body;

    const updated = await (prisma as any).invoiceRecord.update({
      where: { id },
      data: {
        ...(companyName !== undefined ? { companyName } : {}),
        ...(cabinName !== undefined ? { cabinName } : {}),
        ...(noOfSeats !== undefined ? { noOfSeats: noOfSeats !== '' ? Number(noOfSeats) : null } : {}),
        ...(ratePerAgreement !== undefined ? { ratePerAgreement: ratePerAgreement !== '' ? Number(ratePerAgreement) : null } : {}),
        ...(amount !== undefined ? { amount: amount !== '' ? Number(amount) : null } : {}),
        ...(gstPercent !== undefined ? { gstPercent: gstPercent !== '' ? Number(gstPercent) : null } : {}),
        ...(totalAmount !== undefined ? { totalAmount: totalAmount !== '' ? Number(totalAmount) : null } : {}),
        ...(gstNo !== undefined ? { gstNo } : {}),
        ...(billingMonth !== undefined ? { billingMonth } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update invoice record error:', error);
    return NextResponse.json({ error: 'Failed to update invoice record' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let userId: number | null = null;
    let isAdmin = false;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        userId = Number(payload.id);
        const role = (payload.role as string || '').toUpperCase();
        isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPER-ADMIN';
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Node scoping verification for non-admins
    if (!isAdmin) {
      const scopedUserIds = await getNodeScopedUserIds(userId);
      if (scopedUserIds !== null) {
        const existingRecord = await (prisma as any).invoiceRecord.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!existingRecord || !scopedUserIds.includes(existingRecord.createdById)) {
          return NextResponse.json({ error: 'Forbidden: You cannot delete invoices from another center' }, { status: 403 });
        }
      }
    }

    // Delete attached invoices first to prevent foreign key errors
    await (prisma as any).attachedInvoice.deleteMany({
      where: { invoiceRecordId: id },
    });

    // Delete the invoice record
    await (prisma as any).invoiceRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Invoice record deleted successfully' });
  } catch (error) {
    console.error('Delete invoice record error:', error);
    return NextResponse.json({ error: 'Failed to delete invoice record' }, { status: 500 });
  }
}
