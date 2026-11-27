"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    ...props,
  };
}

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </svg>
);

export const IconPill = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" />
    <path d="m9 15 6-6" />
  </svg>
);

export const IconPharmacy = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 9.5V20h16V9.5" />
    <path d="M3 9.5 5.2 4h13.6L21 9.5a3 3 0 0 1-5.4 1.3 3 3 0 0 1-5.1 0A3 3 0 0 1 3 9.5z" />
    <path d="M10 20v-4.5h4V20M9 11.5h6M12 8.5v6" />
  </svg>
);

export const IconMapPin = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.6 12 21 12 21z" />
    <circle cx="12" cy="10.5" r="2.4" />
  </svg>
);

export const IconPhone = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 3.5h3l1.5 4-2 1.5c.8 2.2 2.3 3.8 4.5 4.6l1.5-2 4 1.5v3c0 1.2-1 2.2-2.2 2.1C10.6 17.9 6.1 13.4 4.9 5.7 4.8 4.5 5.8 3.5 7 3.5z" />
  </svg>
);

export const IconWhatsApp = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20.5 11.7a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.4-4.3A8.5 8.5 0 1 1 20.5 11.7z" />
    <path d="M9.2 8.6c.2-.4.5-.5.8-.5h.5c.2 0 .4 0 .6.4l.7 1.6c.1.3 0 .5-.1.7l-.5.6c-.1.2-.2.3 0 .6.6 1 1.4 1.7 2.4 2.2.3.2.5.1.6 0l.6-.6c.2-.2.4-.2.6-.1l1.6.8c.3.1.4.3.4.6 0 .9-.6 1.9-1.5 2.1-.8.2-2 .1-3.6-.8-1.9-1-3.2-2.9-3.4-3.3-.6-1.1-.7-2.1-.4-2.9z" />
  </svg>
);

export const IconClock = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconShield = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconClose = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9.5 7V4.8h5V7M6 7l1 13h10l1-13" />
    <path d="M10.5 11v5M13.5 11v5" />
  </svg>
);

export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.8 21 20H3z" />
    <path d="M12 9.5v4.5M12 17.2v.1" />
  </svg>
);

export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12h16M14 6l6 6-6 6" />
  </svg>
);

export const IconChevronRight = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M13 2.5 5 13.5h5.5L10 21.5l8-11h-5.5z" />
  </svg>
);

export const IconBed = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 18V9M3 14h18v4M3 18h18" />
    <path d="M7 14v-3h5a2 2 0 0 1 2 2v1M3 8.5V6" />
    <circle cx="6.2" cy="10.4" r="1.6" />
  </svg>
);

export const IconAmbulance = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3 16V8h10v8M13 11h4l3.5 3.5V16H13" />
    <circle cx="7" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
    <path d="M6.5 11.5h3M8 10v3" />
  </svg>
);

export const IconNavigation = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3.5 20 20l-8-3.6L4 20z" />
  </svg>
);

export const IconHospital = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 20V7l8-3.5L20 7v13z" />
    <path d="M9 20v-5h6v5M12 8v4M10 10h4" />
  </svg>
);

export const IconLock = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="4.5" y="10" width="15" height="10.5" rx="2.2" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v3" />
  </svg>
);

export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
    <path d="M16 8l4 4-4 4M20 12H9" />
  </svg>
);

export const IconKey = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="8" cy="12" r="3.5" />
    <path d="M11.5 12H21M18 12v3M15 12v2.5" />
  </svg>
);

export const IconStar = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  </svg>
);

export const IconList = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </svg>
);

export const IconCrosshair = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </svg>
);

export const IconMap = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M3.5 6.5 9 4l6 2.5L20.5 4v13.5L15 20l-6-2.5L3.5 20z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </svg>
);

export const IconUpload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const IconDownload = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
  </svg>
);

export const IconUserCheck = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="m15.5 11.5 2 2 3.5-4" />
  </svg>
);

export const IconArrowLeft = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </svg>
);

export const IconShare = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="18" cy="5" r="2.8" />
    <circle cx="6" cy="12" r="2.8" />
    <circle cx="18" cy="19" r="2.8" />
    <path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2" />
  </svg>
);

export const IconMic = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="3.5" width="6" height="10.5" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7" />
  </svg>
);

export const IconSmartphone = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M12 7.5v6M9.5 11.5 12 14l2.5-2.5" />
    <path d="M11 18h2" />
  </svg>
);

export const IconCamera = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 8.5A2 2 0 0 1 6 6.5h2.2l1.3-2h5l1.3 2H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <circle cx="12" cy="12.8" r="3.2" />
  </svg>
);

export const IconImage = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4.5 17 4.8-4.8a1.2 1.2 0 0 1 1.7 0l2.4 2.4 2.1-2.1a1.2 1.2 0 0 1 1.7 0L20 15.5" />
  </svg>
);

export const IconRotate = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M20 4v5h-5" />
    <path d="M20 9a8 8 0 1 0 2 5.3" />
  </svg>
);

export const IconZoomIn = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6" />
  </svg>
);

export const IconLogo = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 32 32"
    className={className}
    fill="none"
    aria-hidden="true"
    focusable={false}
  >
    <rect width="32" height="32" rx="9" fill="currentColor" />
    <g transform="rotate(-45 16 16)">
      <rect x="8" y="12.8" width="16" height="6.4" rx="3.2" fill="#0B1F1D" />
      <rect x="16" y="12.8" width="8" height="6.4" rx="3.2" fill="#F7F6F2" />
    </g>
  </svg>
);
