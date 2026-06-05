import { useEffect, useRef, useState } from 'react'
import type { Capture } from '../types'
import { getCaptures } from '../api'
import * as d3Force from 'd3-force'
import * as d3Drag from 'd3-drag'
import * as d3Zoom from 'd3-zoom'
import * as d3Selection from 'd3-selection'

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
  degree: number
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
  const [hovered, setHovered] = useState<{ capture: Capture; degree: number } | null>(null)

  useEffect(() => {
    getCaptures(500).then(data => {
      setCaptures(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!captures.length || !svgRef.current) return

    const svgEl = svgRef.current
    const W = svgEl.clientWidth || 800
    const H = svgEl.clientHeight || 600

    const svg = d3Selection.select(svgEl)
    svg.selectAll('*').remove()

    // Single wrapper group — zoom/pan applied here
    const g = svg.append('g')

    // Build nodes
    const nodeById = new Map<number, Node>()
    const nodes: Node[] = captures.map(c => {
      const n: Node = {
        id: c.id,
        capture: c,
        r: c.intent === 'learn' ? 10 : c.intent === 'act' ? 11 : 8,
        degree: 0,
        x: W / 2 + (Math.random() - 0.5) * 300,
        y: H / 2 + (Math.random() - 0.5) * 300,
      }
      nodeById.set(c.id, n)
      return n
    })

    // Build links (deduplicated) and compute true degree per node
    const seen = new Set<string>()
    const links: Link[] = []
    const degree = new Map<number, number>()
    for (const c of captures) {
      for (const rawId of (c.related_ids ?? [])) {
        const rid = Number(rawId)
        const key = [Math.min(c.id, rid), Math.max(c.id, rid)].join('-')
        if (!seen.has(key) && nodeById.has(rid)) {
          seen.add(key)
          links.push({ source: c.id, target: rid })
          degree.set(c.id, (degree.get(c.id) ?? 0) + 1)
          degree.set(rid, (degree.get(rid) ?? 0) + 1)
        }
      }
    }
    // Patch degree onto nodes
    for (const n of nodes) n.degree = degree.get(n.id) ?? 0

    // Draw links
    const linkSel = g.append('g')
      .selectAll<SVGLineElement, Link>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#181410')
      .attr('stroke-opacity', 0.18)
      .attr('stroke-width', 1.5)

    // Draw nodes
    const nodeSel = g.append('g')
      .selectAll<SVGGElement, Node>('g')
      .data(nodes, d => d.id)
      .join('g')
      .attr('cursor', 'grab')

    nodeSel.append('circle')
      .attr('r', d => d.r)
      .attr('fill', d => INTENT_COLORS[d.capture.intent ?? ''] ?? '#ccc')
      .attr('stroke', '#181410')
      .attr('stroke-width', 2)

    // Hover + click
    let dragMoved = false
    nodeSel
      .on('mouseenter', function(_, d) {
        d3Selection.select(this).select('circle')
          .attr('stroke-width', 3.5)
          .attr('r', d.r + 3)
        setHovered({ capture: d.capture, degree: d.degree })
      })
      .on('mouseleave', function(_, d) {
        d3Selection.select(this).select('circle')
          .attr('stroke-width', 2)
          .attr('r', d.r)
        setHovered(null)
      })
      .on('pointerup.pick', (_, d) => { if (!dragMoved) onPick?.(d.capture) })
      .on('dblclick', (_, d) => { d.fx = null; d.fy = null })

    // Drag — directly update transforms (no sim restart → no click absorption by d3-drag)
    const drag = d3Drag.drag<SVGGElement, Node>()
      .on('start', function(_, d) {
        dragMoved = false
        d.fx = d.x; d.fy = d.y
        d3Selection.select(this).attr('cursor', 'grabbing')
      })
      .on('drag', function(event, d) {
        dragMoved = true
        d.fx = d.x = event.x
        d.fy = d.y = event.y
        d3Selection.select(this).attr('transform', `translate(${d.x},${d.y})`)
        linkSel
          .attr('x1', lk => (lk.source as Node).x ?? 0)
          .attr('y1', lk => (lk.source as Node).y ?? 0)
          .attr('x2', lk => (lk.target as Node).x ?? 0)
          .attr('y2', lk => (lk.target as Node).y ?? 0)
      })
      .on('end', function(_, d) {
        if (!dragMoved) { d.fx = null; d.fy = null }
        d3Selection.select(this).attr('cursor', 'grab')
      })

    nodeSel.call(drag)

    // Zoom + pan on the SVG itself
    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', event => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)
    // Prevent zoom from blocking node drag/click
    svg.on('dblclick.zoom', null)

    // Simulation
    const sim = d3Force.forceSimulation<Node>(nodes)
      .force('link', d3Force.forceLink<Node, Link>(links).id(d => d.id).distance(90).strength(0.5))
      .force('charge', d3Force.forceManyBody<Node>().strength(-150))
      .force('center', d3Force.forceCenter(W / 2, H / 2))
      .force('collision', d3Force.forceCollide<Node>(d => d.r + 8))
      .on('tick', () => {
        linkSel
          .attr('x1', d => (d.source as Node).x ?? 0)
          .attr('y1', d => (d.source as Node).y ?? 0)
          .attr('x2', d => (d.target as Node).x ?? 0)
          .attr('y2', d => (d.target as Node).y ?? 0)

        nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`)
      })

    return () => { sim.stop() }
  }, [captures, onPick])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
        <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Graph{' '}
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            · {captures.length} nodes
          </span>
        </h2>
        <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
          scroll · zoom &nbsp;|&nbsp; drag · pan &nbsp;|&nbsp; drag node · pin &nbsp;|&nbsp; dblclick · unpin &nbsp;|&nbsp; click · surface
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexShrink: 0 }}>
        {Object.entries(INTENT_COLORS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: v, border: '2px solid var(--ink)' }} />
            <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{k}</span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', border: '2px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
            <p className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
              Building graph…
            </p>
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
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', border: '2px solid var(--line)', background: INTENT_COLORS[hovered.capture.intent ?? ''] ?? '#eee', boxShadow: '2px 2px 0 var(--line)' }}>
                {(hovered.capture.intent ?? 'unknown').toUpperCase()}
              </span>
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', border: '2px solid var(--line)', background: 'var(--paper)', boxShadow: '2px 2px 0 var(--line)' }}>
                {hovered.capture.type.toUpperCase()}
              </span>
              {hovered.degree > 0 && (
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                  ◇ {hovered.degree} edges
                </span>
              )}
            </div>
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', margin: 0, lineHeight: 1.4 }}>
              {hovered.capture.summary ?? hovered.capture.raw ?? '(processing…)'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
