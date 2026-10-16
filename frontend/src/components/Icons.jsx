// Minimal inline SVG icon set (stroke icons, 24x24 viewBox).

function Icon({ children, className = 'h-5 w-5', title }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

export const LogoMark = ({ className = 'h-8 w-8' }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="#1c5f34" />
    <path d="M4 25 L13 10 L18 17 L21 13 L28 25 Z" fill="#b9e3c4" />
    <path d="M13 10 L15.5 14 L13.5 14.8 L11.6 12.4 Z" fill="#7a5a3a" />
    <path
      d="M16 6 L25 9.5 V16 C25 21 21 24 16 26 C11 24 7 21 7 16 V9.5 Z"
      fill="none"
      stroke="#fbbf24"
      strokeWidth="2.2"
      strokeLinejoin="round"
    />
  </svg>
)

export const MenuIcon = (p) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
)
export const CloseIcon = (p) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
export const AlertIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3l9.5 17h-19L12 3z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Icon>
)
export const MapPinIcon = (p) => (
  <Icon {...p}>
    <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </Icon>
)
export const RainIcon = (p) => (
  <Icon {...p}>
    <path d="M7 15a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17 15H7z" />
    <path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" />
  </Icon>
)
export const ReportIcon = (p) => (
  <Icon {...p}>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M14 3v5h5M9 13h7M9 17h5" />
  </Icon>
)
export const ShieldIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.4 7.7-8 9-4.6-1.3-8-4.5-8-9V6z" />
  </Icon>
)
export const CameraIcon = (p) => (
  <Icon {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
)
export const VideoIcon = (p) => (
  <Icon {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="M16 10.5l5-3v9l-5-3" />
  </Icon>
)
export const NavigateIcon = (p) => (
  <Icon {...p}>
    <path d="M3 11l18-8-8 18-2-8z" />
  </Icon>
)
export const CopyIcon = (p) => (
  <Icon {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </Icon>
)
export const FilterIcon = (p) => (
  <Icon {...p}>
    <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
  </Icon>
)
export const RefreshIcon = (p) => (
  <Icon {...p}>
    <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5L20 16M20 20v-4h-4" />
  </Icon>
)
export const InfoIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.5v.01" />
  </Icon>
)
export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)
export const LocateIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
)
export const TableIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M3.5 10h17M3.5 14.5h17M9.5 5v14" />
  </Icon>
)
export const ChartIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20h16M7 16V10M12 16V5M17 16v-4" />
  </Icon>
)

// ---- Navigation and actions (same 24px stroke style as above) ----
export const HomeIcon = (p) => (
  <Icon {...p}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5.5 9v11h13V9M10 20v-6h4v6" />
  </Icon>
)
export const GridIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
  </Icon>
)
export const BellIcon = (p) => (
  <Icon {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
)
export const LayersIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3l9 5-9 5-9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Icon>
)
export const SearchIcon = (p) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Icon>
)
export const ChevronRightIcon = (p) => (
  <Icon {...p}>
    <path d="M9 5l7 7-7 7" />
  </Icon>
)
export const ChevronLeftIcon = (p) => (
  <Icon {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Icon>
)
export const ChevronDownIcon = (p) => (
  <Icon {...p}>
    <path d="M5 9l7 7 7-7" />
  </Icon>
)
export const ArrowRightIcon = (p) => (
  <Icon {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Icon>
)
export const UserIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20.5c1.5-4 4.4-6 8-6s6.5 2 8 6" />
  </Icon>
)
export const LogoutIcon = (p) => (
  <Icon {...p}>
    <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </Icon>
)
export const UploadIcon = (p) => (
  <Icon {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V16" />
  </Icon>
)
export const ClockIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)
export const HistoryIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
    <path d="M3.5 4v4.5H8M12 8v4l3 2" />
  </Icon>
)
export const MountainIcon = (p) => (
  <Icon {...p}>
    <path d="M2.5 20l7-12 4 6.5 2.5-3.5 5.5 9z" />
    <path d="M8 12.5l1.5 1.5 1.5-1" />
  </Icon>
)
export const ActivityIcon = (p) => (
  <Icon {...p}>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </Icon>
)
export const ExternalIcon = (p) => (
  <Icon {...p}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Icon>
)
export const PhoneIcon = (p) => (
  <Icon {...p}>
    <path d="M5 3.5h3.5l1.5 4.5-2.2 1.3a11 11 0 0 0 6.9 6.9L16 14l4.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16.5 16.5 0 0 1 3.5 5 1.5 1.5 0 0 1 5 3.5z" />
  </Icon>
)
export const CheckCircleIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.8 2.8L16.5 9.5" />
  </Icon>
)
export const XCircleIcon = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Icon>
)
export const EditIcon = (p) => (
  <Icon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Icon>
)
export const TrashIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
)
export const ImageIcon = (p) => (
  <Icon {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="10" r="1.8" />
    <path d="M20.5 16l-5-5L6 19.5" />
  </Icon>
)
export const BookIcon = (p) => (
  <Icon {...p}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5" />
  </Icon>
)
export const SparkIcon = (p) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
  </Icon>
)
export const ClipboardIcon = (p) => (
  <Icon {...p}>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4" />
  </Icon>
)
export const SlidersIcon = (p) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
)
