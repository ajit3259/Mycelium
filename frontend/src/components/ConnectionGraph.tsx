import type { Capture } from '../types'

const INTENT_BG: Record<string, string> = {
  learn:     'var(--learn)',
  act:       'var(--act)',
  reference: 'var(--ref)',
  ephemeral: 'var(--eph)',
}

interface Props {
  item: Capture
  onPick?: (c: Capture) => void
}

export function ConnectionGraph({ item, onPick }: Props) {
  const related = (item.related ?? []).slice(0, 5)
  if (related.length === 0) return null

  const W = 380, H = 170
  const cx = 64, cy = H / 2
  const R = 120
  const n = related.length

  const angleFor = (i: number) => {
    if (n === 1) return 0
    const span = Math.min(100, 40 * (n - 1))
    return ((-span / 2) + (span / (n - 1)) * i) * (Math.PI / 180)
  }

  const nodes = related.map((r, i) => {
    const a = angleFor(i)
    return { r, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }
  })

  const centerBg = (item.intent ? INTENT_BG[item.intent] : null) ?? '#eee'

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Lines */}
      {nodes.map((nd, i) => (
        <line
          key={'l' + i}
          x1={cx} y1={cy}
          x2={nd.x} y2={nd.y}
          stroke="var(--ink)"
          strokeWidth="2"
          strokeDasharray="4 3"
          opacity={0.4}
        />
      ))}

      {/* Related nodes */}
      {nodes.map((nd, i) => {
        const bg = (nd.r.intent ? INTENT_BG[nd.r.intent] : null) ?? '#eee'
        const tag = nd.r.tags?.[0] ?? nd.r.intent ?? '?'
        return (
          <g
            key={'n' + i}
            style={{ cursor: onPick ? 'pointer' : 'default' }}
            onClick={() => onPick?.(nd.r)}
          >
            <circle
              cx={nd.x} cy={nd.y} r={15}
              fill={bg}
              stroke="var(--ink)"
              strokeWidth="2.5"
            />
            <text
              x={nd.x} y={nd.y + 29}
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize="9"
              fontWeight="700"
              fill="var(--ink-soft)"
            >
              {tag.length > 12 ? tag.slice(0, 11) + '…' : tag}
            </text>
          </g>
        )
      })}

      {/* Central node */}
      <circle
        cx={cx} cy={cy} r={22}
        fill={centerBg}
        stroke="var(--ink)"
        strokeWidth="3"
      />
      <circle cx={cx} cy={cy} r={7} fill="var(--ink)" />
    </svg>
  )
}
