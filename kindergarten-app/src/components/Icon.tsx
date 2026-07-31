import type { IconName } from '../types'

type IconProps = {
  name: IconName
  size?: number
  className?: string
}

const paths: Record<IconName, React.ReactNode> = {
  approval: (
    <>
      <path d="M8 3h8a2 2 0 0 1 2 2v16l-6-3-6 3V5a2 2 0 0 1 2-2Z" />
      <path d="m9 10 2 2 4-4" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  notice: (
    <>
      <path d="m3 11 18-5v12L3 14v-3Z" />
      <path d="M11.6 16.2 13 21H7l-1.4-6" />
    </>
  ),
  note: (
    <>
      <rect width="16" height="19" x="4" y="3" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </>
  ),
  meal: (
    <>
      <path d="M3 2v8a3 3 0 0 0 3 3V2M3 6h3M6 13v9" />
      <path d="M17 2c-2 2-3 5-3 8 0 2 1 3 3 3v9M17 2v11" />
    </>
  ),
  photo: (
    <>
      <rect width="20" height="16" x="2" y="4" rx="3" />
      <circle cx="8.5" cy="9" r="2" />
      <path d="m21 15-5-5L5 20" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V3M7 8l5-5 5 5" />
      <path d="M5 13H3v8h18v-8h-2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22a8 8 0 0 1 16 0" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v11h14V10M9 21v-7h6v7" />
    </>
  ),
  back: <path d="m15 18-6-6 6-6" />,
  lock: (
    <>
      <rect width="18" height="12" x="3" y="10" rx="2" />
      <path d="M7 10V7a5 5 0 0 1 10 0v3" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C12 4 5 8 5 15c0 3 2 5 5 5 7 0 10-8 10-16Z" />
      <path d="M4 21c3-6 7-9 12-12" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12 4 4L19 6" />,
  warning: (
    <>
      <path d="M10.3 3.7 2.5 17.2A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.8L13.7 3.7a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  archive: (
    <>
      <path d="M3 6h18M5 6v15h14V6M4 3h16v3H4z" />
      <path d="M9 11h6" />
    </>
  ),
  restore: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
}

export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      {paths[name]}
    </svg>
  )
}
