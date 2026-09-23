import React from 'react'

// Minimal inline SVG icon set (stroke-based, 20x20 viewbox, currentColor)
// so the app doesn't depend on an external icon font/package.

type IconProps = { size?: number; className?: string }

function base(children: React.ReactNode, size = 18, className?: string): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export const IconOpen = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </>,
    size,
    className
  )

export const IconSave = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M8 3v5h8V3" />
      <path d="M7 21v-7h10v7" />
    </>,
    size,
    className
  )

export const IconSaveAs = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M5 3h9l5 5v6" />
      <path d="M8 3v5h7V3" />
      <path d="M7 21v-6h6" />
      <circle cx="17" cy="17" r="4" />
      <path d="M17 15.5v3M15.5 17h3" />
    </>,
    size,
    className
  )

export const IconPrint = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M7 8V3h10v5" />
      <rect x="3" y="8" width="18" height="9" rx="2" />
      <path d="M7 21h10v-6H7v6Z" />
    </>,
    size,
    className
  )

export const IconUndo = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="M9 7 4 12l5 5M4 12h11a5 5 0 1 1 0 10h-1" />, size, className)

export const IconRedo = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="M15 7l5 5-5 5M20 12H9a5 5 0 1 0 0 10h1" />, size, className)

export const IconSelect = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="m5 3 15 6-6.5 2.5L11 18 5 3Z" />, size, className)

export const IconHighlighter = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="m9 11 4 4-7 3-2-2 3-7Z" />
      <path d="M12.5 5.5 18.5 11.5" />
      <path d="M17 3l4 4-3.5 3.5-4-4L17 3Z" />
    </>,
    size,
    className
  )

export const IconUnderline = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <path d="M5 20h14" />
    </>,
    size,
    className
  )

export const IconStrikethrough = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M6 6c0-1.8 2-3 6-3s6 1.2 6 3" />
      <path d="M6 18c0 1.8 2.5 3 6 3s6-1.2 6-3" />
      <path d="M4 12h16" />
    </>,
    size,
    className
  )

export const IconSquare = ({ size, className }: IconProps): React.ReactElement =>
  base(<rect x="4" y="4" width="16" height="16" rx="2" />, size, className)

export const IconCircle = ({ size, className }: IconProps): React.ReactElement =>
  base(<circle cx="12" cy="12" r="8" />, size, className)

export const IconLine = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="M5 19 19 5" />, size, className)

export const IconPen = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M3 21c2-1 3-2 4-4l9-9-3-3-9 9c-2 1-3 2-4 4Z" />
      <path d="M14 5l3 3" />
    </>,
    size,
    className
  )

export const IconTextBox = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M9 9h6M9 12.5h6M9 16h3" />
    </>,
    size,
    className
  )

export const IconNote = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M5 4h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
    </>,
    size,
    className
  )

export const IconChevronLeft = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="M14.5 18 8.5 12l6-6" />, size, className)

export const IconChevronRight = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="m9.5 18 6-6-6-6" />, size, className)

export const IconMinus = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="M5 12h14" />, size, className)

export const IconPlus = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="M12 5v14M5 12h14" />, size, className)

export const IconSearch = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>,
    size,
    className
  )

export const IconClose = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="M6 6l12 12M18 6 6 18" />, size, className)

export const IconChevronUp = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="m6 15 6-6 6 6" />, size, className)

export const IconChevronDown = ({ size, className }: IconProps): React.ReactElement =>
  base(<path d="m6 9 6 6 6-6" />, size, className)

export const IconFileText = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </>,
    size,
    className
  )

export const IconRotateLeft = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M8 6a7 7 0 1 1-5 2.5" />
      <path d="M3 4v4.5h4.5" />
    </>,
    size,
    className
  )

export const IconRotateRight = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M16 6a7 7 0 1 0 5 2.5" />
      <path d="M21 4v4.5h-4.5" />
    </>,
    size,
    className
  )

export const IconCopy = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>,
    size,
    className
  )

export const IconTrash = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <path d="M4 7h16" />
      <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </>,
    size,
    className
  )

export const IconLock = ({ size, className }: IconProps): React.ReactElement =>
  base(
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>,
    size,
    className
  )
