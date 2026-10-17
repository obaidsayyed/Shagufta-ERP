// Currency utilities enforcing exact integer paise representation
// 1 Rupee = 100 Paise. All database and calculation operations use integer paise.

export function formatPaiseToINR(paise: number, includeDecimals = true): string {
  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const remainingPaise = absPaise % 100;

  // Format with Indian numbering system (lakhs, crores: e.g. 1,23,456.00)
  const rupeeString = rupees.toLocaleString('en-IN');
  const sign = isNegative ? '-' : '';

  if (!includeDecimals && remainingPaise === 0) {
    return `${sign}₹${rupeeString}`;
  }

  const paddedPaise = remainingPaise.toString().padStart(2, '0');
  return `${sign}₹${rupeeString}.${paddedPaise}`;
}

export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * 100);
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}
