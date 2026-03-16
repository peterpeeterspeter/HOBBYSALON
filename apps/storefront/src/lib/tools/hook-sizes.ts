/**
 * Crochet hook size conversion: mm ↔ US letter
 * Sources: magicneedles.in, flockworkshop.uk
 */

export type HookSizeEntry = {
  mm: number;
  usLetter: string | null;
};

export const HOOK_SIZES: HookSizeEntry[] = [
  { mm: 2, usLetter: null },
  { mm: 2.25, usLetter: "B" },
  { mm: 2.5, usLetter: null },
  { mm: 2.75, usLetter: "C" },
  { mm: 3, usLetter: null },
  { mm: 3.25, usLetter: "D" },
  { mm: 3.5, usLetter: "E" },
  { mm: 3.75, usLetter: null },
  { mm: 4, usLetter: "G" },
  { mm: 4.5, usLetter: null },
  { mm: 5, usLetter: "H" },
  { mm: 5.5, usLetter: "I" },
  { mm: 6, usLetter: "J" },
  { mm: 6.5, usLetter: "K" },
  { mm: 7, usLetter: null },
  { mm: 8, usLetter: "L" },
  { mm: 9, usLetter: "M/N" },
  { mm: 10, usLetter: "N/P" },
  { mm: 11, usLetter: null },
  { mm: 12, usLetter: null },
  { mm: 15, usLetter: null },
  { mm: 16, usLetter: null },
  { mm: 19, usLetter: null },
  { mm: 20, usLetter: null },
  { mm: 25, usLetter: null },
];

export function findHookByMm(mm: number): HookSizeEntry | undefined {
  return HOOK_SIZES.find((e) => Math.abs(e.mm - mm) < 0.01);
}

export function findHookByUsLetter(letter: string): HookSizeEntry | undefined {
  const normalized = letter.trim().toUpperCase();
  return HOOK_SIZES.find(
    (e) =>
      e.usLetter !== null &&
      e.usLetter.toUpperCase().replace("/", "").includes(normalized)
  );
}
