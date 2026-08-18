interface ValoreLogoProps {
  size?: number
  showName?: boolean
  nameColor?: string
  /** ID estável do gradiente SVG — evita mismatch de hidratação com useId() */
  instance?: string
}

export function ValoreLogo({
  size = 32,
  showName = true,
  nameColor,
  instance = 'default',
}: ValoreLogoProps) {
  const gradId = `valore-grad-${instance}`

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
        aria-hidden="true"
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
