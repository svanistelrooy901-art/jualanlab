/** UntungLab licence codes: the same normalising rules as UntungLab itself. */

/** UntungLab's own code alphabet (src/license/code.ts there): no 0/O, 1/I/L or U. */
const UL_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** Canonical "UL-XXXX-XXXX-XXXX" form of what a person typed (same rules as UntungLab), or null if it cannot be a code. */
export function normaliseUlCode(input: string): string | null {
  let s = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.startsWith('UL')) s = s.slice(2);
  if (s.length !== 12 || [...s].some((c) => !UL_ALPHABET.includes(c))) return null;
  return `UL-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
