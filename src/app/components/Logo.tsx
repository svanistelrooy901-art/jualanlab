/** The lab flask with a banknote inside (public/icon-source.svg). */
export function Logo({ size = 32, color = 'var(--color-brand-neon)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6h24" strokeWidth="4.5" />
      <path d="M25 6v18L10.5 49.5Q7 57 15.5 58h33Q57 57 53.5 49.5L39 24V6" strokeWidth="4.5" />
      <rect x="20.5" y="38" width="23" height="13.5" rx="2.5" strokeWidth="3.4" />
      <circle cx="32" cy="44.75" r="3.4" strokeWidth="3.4" />
    </svg>
  );
}
