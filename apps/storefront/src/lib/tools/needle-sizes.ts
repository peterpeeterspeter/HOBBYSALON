/**
 * Knitting needle size conversion: mm ↔ US ↔ UK
 * Sources: magicneedles.in, knitpro.eu
 */

export type NeedleSizeEntry = {
  mm: number;
  us: number | null;
  uk: number | null;
};

export const NEEDLE_SIZES: NeedleSizeEntry[] = [
  { mm: 2, us: 0, uk: 14 },
  { mm: 2.25, us: 1, uk: 13 },
  { mm: 2.5, us: 1.5, uk: null },
  { mm: 2.75, us: 2, uk: 12 },
  { mm: 3, us: 2.5, uk: 11 },
  { mm: 3.25, us: 3, uk: 10 },
  { mm: 3.5, us: 4, uk: null },
  { mm: 3.75, us: 5, uk: 9 },
  { mm: 4, us: 6, uk: 8 },
  { mm: 4.5, us: 7, uk: 7 },
  { mm: 5, us: 8, uk: 6 },
  { mm: 5.5, us: 9, uk: 5 },
  { mm: 6, us: 10, uk: 4 },
  { mm: 6.5, us: 10.5, uk: 3 },
  { mm: 7, us: null, uk: 2 },
  { mm: 7.5, us: null, uk: 1 },
  { mm: 8, us: 11, uk: 0 },
  { mm: 9, us: 13, uk: 0 },
  { mm: 10, us: 15, uk: 0 },
  { mm: 12, us: 17, uk: null },
  { mm: 12.75, us: 17, uk: null },
  { mm: 15, us: 19, uk: null },
  { mm: 16, us: 19, uk: null },
  { mm: 19, us: 35, uk: null },
  { mm: 20, us: 36, uk: null },
  { mm: 25, us: 50, uk: null },
];

export function findByMm(mm: number): NeedleSizeEntry | undefined {
  return NEEDLE_SIZES.find((e) => Math.abs(e.mm - mm) < 0.01);
}

export function findByUs(us: number): NeedleSizeEntry | undefined {
  return NEEDLE_SIZES.find((e) => e.us !== null && Math.abs(e.us - us) < 0.01);
}

export function findByUk(uk: number): NeedleSizeEntry | undefined {
  return NEEDLE_SIZES.find((e) => e.uk !== null && Math.abs(e.uk - uk) < 0.01);
}
