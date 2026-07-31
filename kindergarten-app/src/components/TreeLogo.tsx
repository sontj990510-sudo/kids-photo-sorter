type TreeLogoProps = {
  animated?: boolean
  compact?: boolean
}

export function TreeLogo({ animated = false, compact = false }: TreeLogoProps) {
  const className = [
    'tree-logo',
    animated ? 'tree-logo-animated' : '',
    compact ? 'tree-logo-compact' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      className={className}
      viewBox="0 0 180 180"
      role="img"
      aria-label="Giving Tree 나무 로고"
    >
      <g className="tree-shadow">
        <ellipse cx="91" cy="153" rx="52" ry="9" fill="#b8c99a" opacity=".45" />
      </g>
      <g className="tree-trunk">
        <path
          d="M77 150c11-27 7-51 7-75h16c0 23 3 48 17 75H77Z"
          fill="#9b6747"
        />
        <path
          d="M91 104c-13-10-24-23-31-38M95 93c12-10 22-21 29-35"
          fill="none"
          stroke="#9b6747"
          strokeLinecap="round"
          strokeWidth="9"
        />
        <path
          d="M91 114c-7 9-10 21-9 35M98 107c2 14 6 29 12 42"
          fill="none"
          stroke="#7f5038"
          strokeLinecap="round"
          strokeWidth="3"
          opacity=".55"
        />
      </g>
      <g className="tree-crown">
        <circle cx="55" cy="71" r="32" fill="#92c971" />
        <circle cx="87" cy="48" r="39" fill="#5fa576" />
        <circle cx="125" cy="70" r="32" fill="#79b965" />
        <circle cx="89" cy="84" r="38" fill="#6eaf65" />
        <circle cx="67" cy="45" r="23" fill="#7bbd72" />
        <circle cx="112" cy="44" r="25" fill="#70af69" />
      </g>
      <g className="tree-fruit">
        <circle cx="52" cy="64" r="7" fill="#f2bd5d" />
        <circle cx="113" cy="48" r="7" fill="#e98f70" />
        <circle cx="121" cy="83" r="6" fill="#f2bd5d" />
        <circle cx="73" cy="91" r="6" fill="#eb9873" />
      </g>
      <path
        className="tree-heart"
        d="M82 53c-6-9-19-3-14 7 3 6 14 13 14 13s13-8 15-14c4-10-10-15-15-6Z"
        fill="#fff7df"
      />
      <g className="tree-sparkles" fill="#fff9dc">
        <path d="m42 34 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" />
        <path d="m139 49 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5 1.5-4Z" />
      </g>
    </svg>
  )
}

export function ForestBackdrop() {
  return (
    <div className="forest-backdrop" aria-hidden="true">
      <div className="sun-glow" />
      <div className="cloud cloud-one" />
      <div className="cloud cloud-two" />
      <div className="hill hill-back" />
      <div className="hill hill-front" />
      <div className="forest-tree forest-tree-one">
        <span />
      </div>
      <div className="forest-tree forest-tree-two">
        <span />
      </div>
      <div className="forest-tree forest-tree-three">
        <span />
      </div>
      <div className="forest-tree forest-tree-four">
        <span />
      </div>
      <i className="floating-leaf leaf-one" />
      <i className="floating-leaf leaf-two" />
      <i className="floating-leaf leaf-three" />
    </div>
  )
}
