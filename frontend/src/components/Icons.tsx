import React from 'react'

type IconProps = { size?: number; className?: string; style?: React.CSSProperties }

const s = (p: IconProps) => ({ width: p.size ?? 20, height: p.size ?? 20 })

// ─── 导航图标 ───

export const IconChart: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
)

export const IconTag: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
    <path d="M7 7h.01" strokeWidth="3" />
  </svg>
)

export const IconFactory: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21V7l4 3V7l4 3V7l4 3V3l4 3v15H3Z" />
    <path d="M7 21v-4h4v4" />
    <path d="M15 21v-4h4v4" />
    <path d="M3 21h18" />
  </svg>
)

export const IconClipboard: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" />
  </svg>
)

export const IconPackage: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8" />
    <path d="M12 12 3.3 7.1a2 2 0 0 1-.3-3.1l1.5-1C5 2.4 6.8 2.4 8 3.3L12 6l4-2.7c1.2-.9 3-.9 4.2 0l1.5 1a2 2 0 0 1-.3 3.1L12 12Z" />
    <path d="M12 12v9" /><path d="M7.5 5.5 16 10.5" />
  </svg>
)

export const IconLightbulb: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" /><path d="M10 22h4" />
    <path d="M15.09 14c.6-.77 1.05-1.6 1.32-2.5A5.4 5.4 0 0 0 12 6a5.4 5.4 0 0 0-4.41 5.5c.27.9.72 1.73 1.32 2.5" />
    <path d="M9 18c0-1.5.5-2.9 1.5-4h3c1 1.1 1.5 2.5 1.5 4" />
  </svg>
)

export const IconBroom: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 4 8 16" /><path d="M16 20 4 8" />
    <path d="M14 6a3 3 0 0 0-6 0v5h6V6Z" />
    <path d="M6 14c0 2 1.5 4 3 5" />
    <path d="M14 14c0 2-1.5 4-3 5" />
    <path d="M4 8h16" />
  </svg>
)

export const IconGear: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
)

export const IconAlert: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
)

// ─── 通用图标 ───

export const IconSearch: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)

export const IconTrash: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

export const IconClose: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
  </svg>
)

export const IconCheck: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 12 10 18 20 6" />
  </svg>
)

export const IconUndo: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
)

export const IconSave: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
    <polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
)

export const IconLightning: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M13 2L4 14h6v8l9-12h-6V2Z" />
  </svg>
)

export const IconFolder: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11Z" />
  </svg>
)

export const IconEmpty: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M2 10h20" /><path d="M6 14h2" /><path d="M10 14h2" /><path d="M14 14h2" />
  </svg>
)

export const IconCart: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
)

export const IconScale: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" /><path d="M3 12h18" />
    <path d="M9 3h6" /><path d="M9 21h6" />
  </svg>
)

export const IconImport: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

export const IconExport: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

// ─── 趋势箭头 ───

export const IconTrendUp: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
)

export const IconTrendDown: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
  </svg>
)

export const IconTrendFlat: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="12" x2="23" y2="12" /><polyline points="18 9 23 12 18 15" />
  </svg>
)

// ─── 状态指示 ───

export const IconStatusOnline: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="#22c55e">
    <circle cx="12" cy="12" r="6" />
  </svg>
)

export const IconStatusWarning: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="#eab308">
    <circle cx="12" cy="12" r="6" />
  </svg>
)

export const IconStatusOffline: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="#ef4444">
    <circle cx="12" cy="12" r="6" />
  </svg>
)

export const IconStatusInfo: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="#3b82f6">
    <circle cx="12" cy="12" r="6" />
  </svg>
)

// ─── Loading spinner ───

export const IconLoading: React.FC<IconProps> = (p) => (
  <svg {...s(p)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite', ...p.style }}>
    <path d="M21 12a9 9 0 1 1-6.22-8.56" />
  </svg>
)

// ─── 图标查找表 ───

export const NAV_ICONS: Record<string, React.FC<IconProps>> = {
  dash: IconChart,
  products: IconTag,
  suppliers: IconFactory,
  orders: IconClipboard,
  inv: IconPackage,
  insights: IconLightbulb,
  cleansing: IconBroom,
  rules: IconGear,
  quality: IconAlert,
}

// 根据 key 选择趋势图标
export const trendIcon = (current: number, prev: number): React.ReactNode => {
  const Icon = current > prev * 1.15 ? IconTrendUp : current < prev * 0.85 ? IconTrendDown : IconTrendFlat
  return <Icon size={12} />
}

// status display text
export const STATUS_LABEL: Record<string, { label: string; Icon: React.FC<IconProps> }> = {
  connected: { label: '实时', Icon: IconStatusOnline },
  polling: { label: '轮询', Icon: IconStatusWarning },
  disconnected: { label: '断开', Icon: IconStatusOffline },
}
