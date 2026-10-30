import type { SVGProps } from "react";

const paths: Record<string, string> = {
  record: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  plus: "M12 5v14M5 12h14",
  chart: "M4 20V4M4 20h16M8 16v-5M13 16V7M18 16v-8",
  about: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5v.5",
  stop: "M6 6h12v12H6z",
  play: "M7 4l13 8-13 8z",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8",
  wave: "M3 12h1M6 8v8M9 5v14M12 9v6M15 4v16M18 8v8M21 11v2",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  quote: "M7 7h5v5H8v3h4M14 7h5v5h-4v3h4",
  shield: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM9 12l2 2 4-4",
  scissors: "M6 6l12 12M6 18L18 6M8 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM8 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  send: "M3 11l18-8-8 18-2-8z",
  cloudOff: "M3 3l18 18M7 17a5 5 0 0 1-.9-9.9M11 7a5 5 0 0 1 8.9 3.5A4 4 0 0 1 18 18H9",
  inbox: "M3 5h18v14H3zM3 13h5l2 3h4l2-3h5",
  check: "M4 12l5 5L20 6",
  x: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  chevronDown: "M6 9l6 6 6-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  arrowUp: "M12 20V4M6 10l6-6 6 6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21c0-4 3.6-6 8-6s8 2 8 6M17 4a4 4 0 0 1 0 7M23 21c0-3.2-1.5-5-4-5.7",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  calendar: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16",
  file: "M6 2h9l4 4v16H6zM15 2v5h4M9 12h7M9 16h7",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  lock: "M6 10h12v11H6zM9 10V7a3 3 0 0 1 6 0v3M12 14v3",
  key: "M15 7a4 4 0 1 0-3.4 6L4 20v-3h3v-3h3l1.6-1.6A4 4 0 0 0 15 7z",
  cpu: "M7 7h10v10H7zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  gauge: "M4 18a8 8 0 1 1 16 0M12 14l4-4",
  book: "M4 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4zM20 4h-3a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h3z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  contrast: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 3v18",
  menu: "M3 6h18M3 12h18M3 18h18",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  external: "M14 4h6v6M20 4L10 14M18 14v6H4V6h6",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
  filter: "M3 5h18M6 12h12M10 19h4",
  spark: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 16l.9 3.1L23 20l-3.1.9L19 24l-.9-3.1L15 20l3.1-.9z",
  alert: "M12 3l10 18H2zM12 9v5M12 17.5v.5",
  refresh: "M20 11a8 8 0 1 0-2.3 6.2M20 4v7h-7",
  headphones: "M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H4zM20 14h-3v6h3z",
  wifi: "M2 8.8a16 16 0 0 1 20 0M5 12.5a11 11 0 0 1 14 0M8.5 16a6 6 0 0 1 7 0M12 20h.01",
  wifiOff: "M3 3l18 18M8.5 16a6 6 0 0 1 7 0M5 12.5a11 11 0 0 1 4-2.4M2 8.8a16 16 0 0 1 6-3.6M12 20h.01",
  camera: "M4 7h4l2-3h4l2 3h4v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  pin: "M12 21s7-6 7-12a7 7 0 1 0-14 0c0 6 7 12 7 12zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  battery: "M3 7h16v10H3zM19 10h2v4h-2M6 10v4M10 10v4",
  harddrive: "M4 5h16v14H4zM4 13h16M7 17h.01M11 17h.01",
  edit: "M4 20h4L20 8l-4-4L4 16zM14 6l4 4",
  signature: "M3 20c3 0 3-12 6-12s1 8 4 8 2-6 4-6 2 4 4 4M3 20h18",
  scale: "M12 3v18M7 21h10M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 5.2A11 11 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-3 3.7M6 6.6C3.5 8.5 2 12 2 12s4 7 10 7c1.4 0 2.7-.4 3.9-1",
  hash: "M4 9h16M4 15h16M10 3L8 21M16 3l-2 18",
  layers: "M12 3l9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5",
  terminal: "M4 4h16v16H4zM8 9l3 3-3 3M13 15h4",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  inboxIn: "M3 5h18v14H3zM3 13h5l2 3h4l2-3h5M12 3v6M9 6l3 3 3-3",
  shieldOff: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7M3 3l18 18",
  flask: "M9 3h6M10 3v6L4 20h16L14 9V3M7 15h10",
};

export function Icon({ name, size = 16, ...rest }: { name: string; size?: number } & SVGProps<SVGSVGElement>) {
  const d = paths[name] ?? paths.about ?? "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
