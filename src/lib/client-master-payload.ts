import { buildHoAddress } from '@/lib/client-master-utils';

export function mapClientMasterPayload(body: Record<string, unknown>) {
  const {
    companyName,
    hoAddress,
    hoAddressLine1,
    hoAddressLine2,
    hoCity,
    hoState,
    hoCountry,
    hoPinCode,
    gstStatus = 'UNREGISTERED',
    gstNo,
    gstPdfUrl,
    gstPdfName,
    agreementStartDate,
    agreementEndDate,
    agreementPdfUrl,
    agreementPdfName,
    lockinEndDate,
    noticePeriodMonths,
    noticePeriodApplicable,
    escalationPercent,
    escalationApplicable,
    documentationCharges,
    cabinName,
    noOfSeats,
    ratePerAgreement,
    amount,
    gstPercent,
    totalAmount,
    products = [],
    willDeductTds = false,
    tanNo,
    tdsPdfUrl,
    tdsPdfName,
    clientId,
    hasBrokerCommission = false,
    brokerCommissionPercent,
    invoiceToBeRaised,
    sorAmount,
    sorRecdDate,
    paymentDueDay,
    clientStatus = 'Active',
    contactPersons = [],
  } = body;

  const productList = Array.isArray(products) ? products : [];
  const firstProduct = productList[0] || {};

  const resolvedCabinName = productList.length > 0
    ? productList.map((p) => (p.cabinName ? String(p.cabinName).trim() : '')).filter(Boolean).join(', ')
    : (cabinName ? String(cabinName).trim() : null);

  const resolvedNoOfSeats = productList.length > 0
    ? productList.reduce((sum, p) => sum + (p.noOfSeats ? Number(p.noOfSeats) : 0), 0)
    : (noOfSeats ? Number(noOfSeats) : null);

  const resolvedRate = productList.length > 0
    ? (firstProduct.ratePerAgreement ? Number(firstProduct.ratePerAgreement) : null)
    : (ratePerAgreement ? Number(ratePerAgreement) : null);

  const resolvedAmount = productList.length > 0
    ? productList.reduce((sum, p) => sum + (p.amount ? Number(p.amount) : 0), 0)
    : (amount ? Number(amount) : null);

  const resolvedGstPercent = productList.length > 0
    ? (firstProduct.gstPercent ? Number(firstProduct.gstPercent) : 18)
    : (gstPercent ? Number(gstPercent) : 18);

  const resolvedTotalAmount = productList.length > 0
    ? productList.reduce((sum, p) => sum + (p.totalAmount ? Number(p.totalAmount) : 0), 0)
    : (totalAmount ? Number(totalAmount) : null);

  const structuredAddress = buildHoAddress({
    line1: hoAddressLine1 as string | undefined,
    line2: hoAddressLine2 as string | undefined,
    city: hoCity as string | undefined,
    state: hoState as string | undefined,
    country: hoCountry as string | undefined,
    pinCode: hoPinCode as string | undefined,
  });

  return {
    companyName: String(companyName || '').trim(),
    hoAddress: structuredAddress || (hoAddress ? String(hoAddress).trim() : null),
    hoAddressLine1: hoAddressLine1 ? String(hoAddressLine1).trim() : null,
    hoAddressLine2: hoAddressLine2 ? String(hoAddressLine2).trim() : null,
    hoCity: hoCity ? String(hoCity).trim() : null,
    hoState: hoState ? String(hoState).trim() : null,
    hoCountry: hoCountry ? String(hoCountry).trim() : null,
    hoPinCode: hoPinCode ? String(hoPinCode).trim() : null,
    gstStatus: String(gstStatus),
    gstNo: gstStatus === 'REGISTERED' && gstNo ? String(gstNo).trim() : null,
    gstPdfUrl: gstStatus === 'REGISTERED' ? (gstPdfUrl as string) || null : null,
    gstPdfName: gstStatus === 'REGISTERED' ? (gstPdfName as string) || null : null,
    agreementStartDate: agreementStartDate ? new Date(String(agreementStartDate)) : null,
    agreementEndDate: agreementEndDate ? new Date(String(agreementEndDate)) : null,
    agreementPdfUrl: (agreementPdfUrl as string) || null,
    agreementPdfName: (agreementPdfName as string) || null,
    lockinEndDate: lockinEndDate ? new Date(String(lockinEndDate)) : null,
    noticePeriodMonths: noticePeriodMonths ? Number(noticePeriodMonths) : null,
    noticePeriodApplicable: noticePeriodApplicable ? String(noticePeriodApplicable) : null,
    escalationPercent: escalationPercent ? Number(escalationPercent) : null,
    escalationApplicable: escalationApplicable ? new Date(String(escalationApplicable)) : null,
    documentationCharges: documentationCharges ? Number(documentationCharges) : null,
    cabinName: resolvedCabinName,
    noOfSeats: resolvedNoOfSeats,
    ratePerAgreement: resolvedRate,
    amount: resolvedAmount,
    gstPercent: resolvedGstPercent,
    totalAmount: resolvedTotalAmount,
    willDeductTds: Boolean(willDeductTds),
    tanNo: willDeductTds && tanNo ? String(tanNo).trim() : null,
    tdsPdfUrl: willDeductTds ? (tdsPdfUrl as string) || null : null,
    tdsPdfName: willDeductTds ? (tdsPdfName as string) || null : null,
    clientId: clientId ? String(clientId).trim() : null,
    hasBrokerCommission: Boolean(hasBrokerCommission),
    brokerCommissionPercent: hasBrokerCommission && brokerCommissionPercent
      ? Number(brokerCommissionPercent)
      : null,
    invoiceToBeRaised: hasBrokerCommission && invoiceToBeRaised
      ? String(invoiceToBeRaised)
      : null,
    sorAmount: sorAmount ? Number(sorAmount) : null,
    sorRecdDate: sorRecdDate ? new Date(String(sorRecdDate)) : null,
    paymentDueDay: paymentDueDay ? Number(paymentDueDay) : null,
    clientStatus: clientStatus ? String(clientStatus) : 'Active',
    contactPersons: Array.isArray(contactPersons) ? contactPersons : [],
    products: productList.map((p: Record<string, unknown>, idx: number) => ({
      cabinName: p.cabinName ? String(p.cabinName).trim() : null,
      noOfSeats: p.noOfSeats ? Number(p.noOfSeats) : null,
      ratePerAgreement: p.ratePerAgreement ? Number(p.ratePerAgreement) : null,
      amount: p.amount ? Number(p.amount) : null,
      gstPercent: p.gstPercent ? Number(p.gstPercent) : null,
      totalAmount: p.totalAmount ? Number(p.totalAmount) : null,
      sortOrder: idx,
    })),
  };
}
