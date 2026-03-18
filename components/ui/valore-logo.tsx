import { useId } from 'react'

interface ValoreLogoProps {
  size?: number
  showName?: boolean
  nameColor?: string
}

export function ValoreLogo({
  size = 32,
  showName = true,
  nameColor,
}: ValoreLogoProps) {
  const id = useId()
  const gradId = `valore-grad-${id.replace(/:/g, '')}`

  const iconSize = size
  const fontSize = size * 0.75
  const letterSpacing = size * 0.09

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.28 }}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4F3EF5" />
            <stop offset="100%" stopColor="#00C2FF" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="7" fill={`url(#${gradId})`} />
        <path
          d="M7 8 L16 24 L25 8"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showName && (
        <span
          style={{
            fontFamily: 'Georgia, serif',
            fontSize,
            letterSpacing,
            color: nameColor ?? '#ffffff',
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          valore
        </span>
      )}
    </div>
  )
}

