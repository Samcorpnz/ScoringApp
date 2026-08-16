type IconProps = { readonly className?: string };

const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function BrowserIcon({ className }: IconProps) {
  return (
    <svg className={className} {...common}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 8.5h18" />
      <circle cx="6" cy="6.25" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="8.3" cy="6.25" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BroadcastIcon({ className }: IconProps) {
  return (
    <svg className={className} {...common}>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M7.5 8.5a6.2 6.2 0 0 0 0 7" />
      <path d="M16.5 8.5a6.2 6.2 0 0 1 0 7" />
      <path d="M4.5 5.5a10.6 10.6 0 0 0 0 13" />
      <path d="M19.5 5.5a10.6 10.6 0 0 1 0 13" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg className={className} {...common}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" />
    </svg>
  );
}

export function ControlsIcon({ className }: IconProps) {
  return (
    <svg className={className} {...common}>
      <path d="M4 6h9" />
      <path d="M17 6h3" />
      <circle cx="14" cy="6" r="2" />
      <path d="M4 12h3" />
      <path d="M11 12h9" />
      <circle cx="8" cy="12" r="2" />
      <path d="M4 18h9" />
      <path d="M17 18h3" />
      <circle cx="14" cy="18" r="2" />
    </svg>
  );
}
