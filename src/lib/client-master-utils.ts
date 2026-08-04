export const DEFAULT_CLIENT_ID_PREFIX = 'SSPACIA/AHD/CGM';

export function isParkingProduct(name: string): boolean {
  return name.trim().toLowerCase().includes('parking');
}

export function isDocumentationChargesProduct(name: string): boolean {
  return name.trim().toLowerCase().includes('documentation');
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeProductAmount(seats: number, rate: number): number {
  return roundCurrency(seats * rate);
}

export function computeProductTotal(amount: number, gstPercent: number): number {
  const gstVal = (amount * gstPercent) / 100;
  return Math.round(amount + gstVal);
}

export function validateMobile(mobile: string): boolean {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 10;
}

export function sanitizeMobileInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function buildHoAddress(parts: {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
}): string | null {
  const segments = [
    parts.line1?.trim(),
    parts.line2?.trim(),
    parts.city?.trim(),
    parts.state?.trim(),
    parts.country?.trim(),
    parts.pinCode?.trim(),
  ].filter(Boolean);
  return segments.length > 0 ? segments.join(', ') : null;
}

export interface ProductRow {
  cabinName: string;
  noOfSeats: number | '';
  ratePerAgreement: number | '';
  amount: number | '';
  gstPercent: number | '';
  totalAmount: number | '';
  isAmountManuallyEdited: boolean;
  isTotalAmountManuallyEdited: boolean;
}

export function createEmptyProductRow(): ProductRow {
  return {
    cabinName: '',
    noOfSeats: '',
    ratePerAgreement: '',
    amount: '',
    gstPercent: 18,
    totalAmount: '',
    isAmountManuallyEdited: false,
    isTotalAmountManuallyEdited: false,
  };
}
