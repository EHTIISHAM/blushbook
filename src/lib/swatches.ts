/** Swatches drawn from the Bloom palette, distinct enough to tell services
 *  and staff apart at a glance. */
export const SWATCHES = [
  "#C2255C",
  "#8F1A43",
  "#FF9EC0",
  "#3A2C48",
  "#17604A",
  "#9C7BB5",
];

/** The palette, plus a colour picked before it changed, so editing an older
 *  service or staff member never loses its colour. */
export function swatchesWith(current: string | undefined): string[] {
  if (!current) return SWATCHES;
  const known = SWATCHES.some((swatch) => swatch.toLowerCase() === current.toLowerCase());
  return known ? SWATCHES : [current, ...SWATCHES];
}
