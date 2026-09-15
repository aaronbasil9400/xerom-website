/**
 * Normalize a Malaysian mobile number to E.164 format.
 *
 * Local mobile numbers use 01X plus seven subscriber digits, except 011 and
 * 015 ranges, which use eight subscriber digits. International input may use
 * +60, 60, or 0060 and omits the domestic leading zero.
 */
export function normalizeMalaysianMobile(value: string): string | null {
  let compact = value.trim().replace(/[\s()-]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;

  let national: string;
  if (compact.startsWith("+60")) {
    const rest = compact.slice(3);
    if (!/^\d+$/.test(rest)) return null;
    national = `0${rest}`;
  } else if (compact.startsWith("60")) {
    const rest = compact.slice(2);
    if (!/^\d+$/.test(rest)) return null;
    national = `0${rest}`;
  } else {
    if (!/^\d+$/.test(compact)) return null;
    national = compact;
  }

  if (!/^01\d+$/.test(national)) return null;
  const prefix = national.slice(0, 3);
  const subscriberLength = prefix === "011" || prefix === "015" ? 8 : 7;
  if (national.length !== 3 + subscriberLength) return null;

  return `+60${national.slice(1)}`;
}
