/**
 * Hand-drawn 20px line icons. Inlined rather than pulled from a library so the set
 * stays consistent and the bundle carries only what is used.
 */
type IconProps = { className?: string };

const base = 'size-[18px] shrink-0';
const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? base} aria-hidden {...stroke}>
      {children}
    </svg>
  );
}

export const OrdersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5h2l2.5 11h10L20 8H6" />
    <circle cx="9.5" cy="19" r="1.2" />
    <circle cx="17" cy="19" r="1.2" />
  </Svg>
);

export const CatalogIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M9 4.5v15" />
  </Svg>
);

export const InventoryIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 9.5 12 4l8.5 5.5V20h-17z" />
    <path d="M9 20v-6h6v6" />
  </Svg>
);

export const FulfilmentIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" />
    <circle cx="6.5" cy="18" r="1.4" />
    <circle cx="16.5" cy="18" r="1.4" />
  </Svg>
);

export const UsersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3" />
    <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 6.5a3 3 0 0 1 0 5.8M17.5 19c0-2-.8-3.6-2-4.6" />
  </Svg>
);

export const AuditIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m15.5 15.5 4 4" />
  </Svg>
);

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);
