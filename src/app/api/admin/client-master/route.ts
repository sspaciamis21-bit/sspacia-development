import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';
import prisma from '@/lib/prisma';
import { getNodeScopedUserIds, getUserIdsByLocation } from '@/lib/auth/getNodeScopedUserIds';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Authenticate the current user
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    let currentUserId: number | null = null;
    let isAdmin = false;

    if (token) {
      const payload = await verifyToken(token);
      if (payload?.id) {
        currentUserId = Number(payload.id);
        const role = (payload.role as string || '').toUpperCase();
        isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'SUPER-ADMIN';
      }
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const clientStatus = searchParams.get('clientStatus');
    const status = searchParams.get('status');
    const locationId = searchParams.get('locationId'); // Admin filter by node

    const where: any = {};

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { gstNo: { contains: search } },
        { clientId: { contains: search } },
        { tanNo: { contains: search } },
        { cabinName: { contains: search } },
      ];
    }

    if (clientStatus && clientStatus !== 'ALL') {
      where.clientStatus = clientStatus;
    }

    // ── Node-based data isolation ────────────────────────────────
    if (currentUserId) {
      // Admin filtering by specific location
      if (isAdmin && locationId) {
        const locationUserIds = await getUserIdsByLocation(parseInt(locationId, 10));
        if (locationUserIds) {
          where.createdById = { in: locationUserIds };
        }
      } else {
        // Node scoping for CMs (returns null for admins = no filter)
        const scopedUserIds = await getNodeScopedUserIds(currentUserId);
        if (scopedUserIds !== null) {
          where.createdById = { in: scopedUserIds };
        }
      }
    }

    const entries = await (prisma as any).clientMaster.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            assignedLocations: {
              select: {
                location: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        contactPersons: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { srNo: 'desc' },
    });

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error('Fetch client master entries error:', error);
    return NextResponse.json({ error: 'Failed to fetch client master entries' }, { status: 500 });
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

    if (!companyName || !companyName.trim()) {
      return NextResponse.json(
        { error: 'Company Name is required.' },
        { status: 400 }
      );
    }

    // Auto calculate next SR No starting from 1
    const lastRecord = await (prisma as any).clientMaster.findFirst({
      orderBy: { srNo: 'desc' },
      select: { srNo: true },
    });

    const nextSrNo = lastRecord ? lastRecord.srNo + 1 : 1;

    const newEntry = await (prisma as any).clientMaster.create({
      data: {
        srNo: nextSrNo,
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
        escalationApplicable: escalationApplicable ? Number(escalationApplicable) : null,
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
        createdById: userId,
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
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            assignedLocations: {
              select: {
                location: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        contactPersons: true,
      },
    });

    return NextResponse.json({ success: true, data: newEntry }, { status: 201 });
  } catch (error) {
    console.error('Create client master error:', error);
    return NextResponse.json({ error: 'Failed to create client master entry' }, { status: 500 });
  }
}
