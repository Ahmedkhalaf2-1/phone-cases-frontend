/**
 * Whole-EGP display used across admin lists: 5000 -> "EGP 50",
 * 12550 -> "EGP 125.50", 150000 -> "EGP 1,500". Input is integer minor units.
 */
export function formatEgp(minorUnits: number): string {
  const amount = minorUnits / 100;
  const text = amount.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `EGP ${text}`;
}
