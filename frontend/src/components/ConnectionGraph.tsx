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
  const related = (item.related ?? []).slice(0, 3)
  if (related.length === 0) return null

  // Total connections from DB — related_ids is the authoritative count
  const totalConnected = item.related_ids?.length ?? item.related?.length ?? 0
  const extra = totalConnected - related.length

  const W = 380, H = 190
  const cx = 56, cy = 88  // center node position
  const R = 100             // spoke length — shorter keeps labels in bounds
  const n = related.length

  const angleFor = (i: number) => {
    if (n === 1) return 0
    const span = Math.min(70, 35 * (n - 1)) // tighter spread → labels stay in-box
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
      style={{ display: 'block', overflow: 'hidden' }}
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
              x={nd.x} y={nd.y + 27}
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize="9"
              fontWeight="700"
              fill="var(--ink-soft)"
            >
              {tag.length > 14 ? tag.slice(0, 13) + '…' : tag}
            </text>
          </g>
        )
      })}

      {/* Central node */}
      <circle cx={cx} cy={cy} r={22} fill={centerBg} stroke="var(--ink)" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={7} fill="var(--ink)" />

      {/* "· N more" — anchored to center, only when DB has more than shown */}
      {extra > 0 && (
        <text
          x={cx} y={cy + 37}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          fontWeight="700"
          fill="var(--ink-soft)"
        >
          · {extra} more
        </text>
      )}
    </svg>
  )
}
