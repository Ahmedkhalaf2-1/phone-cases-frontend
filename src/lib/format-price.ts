/** Prices from the backend are integer minor units (e.g. cents/piasters). */
export function formatPrice(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}
