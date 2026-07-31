import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
        contactPersons: { orderBy: { sortOrder: 'asc' } },
        attachedInvoice: true,
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Client entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error('Fetch client master error:', error);
    return NextResponse.json({ error: 'Failed to fetch client entry' }, { status: 500 });
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
      companyName,
      hoAddress,
      gstStatus = 'UNREGISTERED',
      gstNo,
      gstPdfUrl,
      gstPdfName,
      agreementStartDate,
      agreementEndDate,
      lockinEndDate,
      noticePeriodMonths,
      noticePeriodApplicable,
      escalationPercent,
      escalationApplicable,
      cabinName,
      noOfSeats,
      ratePerAgreement,
      amount,
      gstPercent,
      totalAmount,
      willDeductTds = false,
      tanNo,
      tdsPdfUrl,
      tdsPdfName,
      clientId,
      sorAmount,
      sorRecdDate,
      clientStatus = 'Active',
      contactPersons = [],
    } = body;

    const existing = await (prisma as any).clientMaster.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Client entry not found' }, { status: 404 });
    }

    const updatedEntry = await (prisma as any).$transaction(async (tx: any) => {
      await tx.clientContactPerson.deleteMany({
        where: { clientMasterId: entryId },
      });

      return tx.clientMaster.update({
        where: { id: entryId },
        data: {
          companyName: String(companyName).trim(),
          hoAddress: hoAddress ? String(hoAddress).trim() : null,
          gstStatus: String(gstStatus),
          gstNo: gstStatus === 'REGISTERED' && gstNo ? String(gstNo).trim() : null,
          gstPdfUrl: gstStatus === 'REGISTERED' ? gstPdfUrl || null : null,
          gstPdfName: gstStatus === 'REGISTERED' ? gstPdfName || null : null,
          agreementStartDate: agreementStartDate ? new Date(agreementStartDate) : null,
          agreementEndDate: agreementEndDate ? new Date(agreementEndDate) : null,
          lockinEndDate: lockinEndDate ? new Date(lockinEndDate) : null,
          noticePeriodMonths: noticePeriodMonths ? Number(noticePeriodMonths) : null,
          noticePeriodApplicable: noticePeriodApplicable ? String(noticePeriodApplicable) : null,
          escalationPercent: escalationPercent ? Number(escalationPercent) : null,
          escalationApplicable: escalationApplicable ? new Date(escalationApplicable) : null,
          cabinName: cabinName ? String(cabinName).trim() : null,
          noOfSeats: noOfSeats ? Number(noOfSeats) : null,
          ratePerAgreement: ratePerAgreement ? Number(ratePerAgreement) : null,
          amount: amount ? Number(amount) : null,
          gstPercent: gstPercent ? Number(gstPercent) : null,
          totalAmount: totalAmount ? Number(totalAmount) : null,
          willDeductTds: Boolean(willDeductTds),
          tanNo: willDeductTds && tanNo ? String(tanNo).trim() : null,
          tdsPdfUrl: willDeductTds ? tdsPdfUrl || null : null,
          tdsPdfName: willDeductTds ? tdsPdfName || null : null,
          clientId: clientId ? String(clientId).trim() : null,
          sorAmount: sorAmount ? Number(sorAmount) : null,
          sorRecdDate: sorRecdDate ? new Date(sorRecdDate) : null,
          clientStatus: clientStatus ? String(clientStatus) : 'Active',
          contactPersons: {
            create: contactPersons.map((cp: any, idx: number) => ({
              name: String(cp.name || '').trim(),
              designation: cp.designation ? String(cp.designation).trim() : null,
              mobileNo: cp.mobileNo ? String(cp.mobileNo).trim() : null,
              email: cp.email ? String(cp.email).trim() : null,
              sortOrder: idx,
            })),
          },
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          contactPersons: true,
          attachedInvoice: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: updatedEntry });
  } catch (error) {
    console.error('Update client master error:', error);
    return NextResponse.json({ error: 'Failed to update client master entry' }, { status: 500 });
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
    console.error('Delete client master error:', error);
    return NextResponse.json({ error: 'Failed to delete client entry' }, { status: 500 });
  }
}
