/** Swatches drawn from the Bloom palette, distinct enough to tell services
 *  and staff apart at a glance. */
export const SWATCHES = [
  "#D6006E",
  "#A8004F",
  "#FF7AB6",
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
