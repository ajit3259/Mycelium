import { useEffect, useRef, useState } from 'react'
import type { Capture } from '../types'
import { getCaptures } from '../api'
import * as d3Force from 'd3-force'

const INTENT_COLORS: Record<string, string> = {
  learn:     '#ffd23f',
  act:       '#ff5c39',
  reference: '#3a86ff',
  ephemeral: '#b9a7ff',
}

interface Node extends d3Force.SimulationNodeDatum {
  id: number
  capture: Capture
  r: number
}

interface Link extends d3Force.SimulationLinkDatum<Node> {
  source: number | Node
  target: number | Node
}

interface Props {
  onPick?: (c: Capture) => void
}

export function GraphView({ onPick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<Capture | null>(null)

  useEffect(() => {
    getCaptures(500).then(data => {
      setCaptures(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!captures.length || !svgRef.current) return

    const el = svgRef.current
    const W = el.clientWidth || 800
    const H = el.clientHeight || 600

    // Clear previous render
    while (el.firstChild) el.removeChild(el.firstChild)

    // Build nodes + links
    const nodeMap = new Map<number, Node>()
    const nodes: Node[] = captures.map(c => {
      const n: Node = {
        id: c.id,
        capture: c,
        r: c.intent === 'act' ? 10 : c.intent === 'learn' ? 9 : 7,
        x: W / 2 + (Math.random() - 0.5) * 200,
        y: H / 2 + (Math.random() - 0.5) * 200,
      }
      nodeMap.set(c.id, n)
      return n
    })

    const linkSet = new Set<string>()
    const links: Link[] = []
    for (const c of captures) {
      for (const rid of (c.related_ids ?? [])) {
        const key = [Math.min(c.id, rid), Math.max(c.id, rid)].join('-')
        if (!linkSet.has(key) && nodeMap.has(rid)) {
          linkSet.add(key)
          links.push({ source: c.id, target: rid })
        }
      }
    }

    // Simulation
    const sim = d3Force.forceSimulation<Node>(nodes)
      .force('link', d3Force.forceLink<Node, Link>(links).id(d => d.id).distance(80).strength(0.4))
      .force('charge', d3Force.forceManyBody().strength(-120))
      .force('center', d3Force.forceCenter(W / 2, H / 2))
      .force('collision', d3Force.forceCollide<Node>(d => d.r + 6))

    // SVG groups
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    el.appendChild(defs)

    const gLinks = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    const gNodes = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    el.appendChild(gLinks)
    el.appendChild(gNodes)

    // Draw links
    const linkEls = links.map(() => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('stroke', '#181410')
      line.setAttribute('stroke-width', '1.5')
      line.setAttribute('stroke-opacity', '0.15')
      gLinks.appendChild(line)
      return line
    })

    // Draw nodes
    const nodeGroups = nodes.map(n => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.style.cursor = 'pointer'

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      circle.setAttribute('r', String(n.r))
      circle.setAttribute('fill', INTENT_COLORS[n.capture.intent ?? ''] ?? '#ccc')
      circle.setAttribute('stroke', '#181410')
      circle.setAttribute('stroke-width', '2')

      g.appendChild(circle)
      gNodes.appendChild(g)

      g.addEventListener('mouseenter', () => {
        circle.setAttribute('stroke-width', '3')
        circle.setAttribute('r', String(n.r + 3))
        setHovered(n.capture)
      })
      g.addEventListener('mouseleave', () => {
        circle.setAttribute('stroke-width', '2')
        circle.setAttribute('r', String(n.r))
        setHovered(null)
      })
      g.addEventListener('click', () => onPick?.(n.capture))

      return { g, circle }
    })

    // Tick
    sim.on('tick', () => {
      linkEls.forEach((line, i) => {
        const link = links[i]
        const s = link.source as Node
        const t = link.target as Node
        if (s.x == null || t.x == null) return
        line.setAttribute('x1', String(s.x))
        line.setAttribute('y1', String(s.y))
        line.setAttribute('x2', String(t.x))
        line.setAttribute('y2', String(t.y))
      })
      nodeGroups.forEach(({ g }, i) => {
        const n = nodes[i]
        if (n.x == null) return
        g.setAttribute('transform', `translate(${n.x},${n.y})`)
      })
    })

    // Pan + zoom via CSS transform on a wrapper group
    let scale = 1, tx = 0, ty = 0
    let panning = false, startX = 0, startY = 0, startTx = 0, startTy = 0

    function applyTransform() {
      gLinks.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`)
      gNodes.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`)
    }

    el.addEventListener('wheel', e => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      scale = Math.max(0.2, Math.min(4, scale * delta))
      applyTransform()
    }, { passive: false })

    el.addEventListener('mousedown', e => {
      if ((e.target as SVGElement).tagName === 'circle') return
      panning = true; startX = e.clientX; startY = e.clientY
      startTx = tx; startTy = ty
      el.style.cursor = 'grabbing'
    })
    window.addEventListener('mousemove', e => {
      if (!panning) return
      tx = startTx + (e.clientX - startX)
      ty = startTy + (e.clientY - startY)
      applyTransform()
    })
    window.addEventListener('mouseup', () => {
      panning = false; el.style.cursor = 'grab'
    })

    el.style.cursor = 'grab'

    return () => { sim.stop() }
  }, [captures, onPick])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Graph{' '}
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            · {captures.length} nodes
          </span>
        </h2>
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>
          scroll to zoom · drag to pan · click node to surface
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexShrink: 0 }}>
        {Object.entries(INTENT_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: v, border: '2px solid var(--ink)' }} />
            <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{k}</span>
          </div>
        ))}
      </div>

      {/* Graph canvas */}
      <div style={{ flex: 1, position: 'relative', border: '2px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <p className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>Building graph…</p>
          </div>
        )}
        <svg ref={svgRef} width="100%" height="100%" />

        {/* Hover tooltip */}
        {hovered && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16, right: 16,
            background: 'var(--card)', border: '2px solid var(--line)',
            boxShadow: 'var(--shadow)', padding: '10px 14px',
            pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', border: '2px solid var(--line)', background: INTENT_COLORS[hovered.intent ?? ''] ?? '#eee' }}>
                {(hovered.intent ?? 'unknown').toUpperCase()}
              </span>
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', border: '2px solid var(--line)', background: 'var(--paper)' }}>
                {hovered.type.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', margin: 0, lineHeight: 1.4 }}>
              {hovered.summary ?? hovered.raw ?? '(processing…)'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
