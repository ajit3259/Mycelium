import { useEffect, useRef, useState } from 'react'
import type { Capture } from '../types'
import { getCaptures } from '../api'
import { ImageThumb } from './ImageThumb'
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
  const [selected, setSelected] = useState<{ capture: Capture; degree: number } | null>(null)

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
      .on('pointerup.pick', (_, d) => { if (!dragMoved) setSelected({ capture: d.capture, degree: d.degree }) })
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

        {/* Hover tooltip — only when no node selected */}
        {hovered && !selected && (
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            background: 'var(--card)', border: '2px solid var(--line)',
            boxShadow: 'var(--shadow)', padding: '8px 12px',
            pointerEvents: 'none', maxWidth: 320,
          }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 5, alignItems: 'center' }}>
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', border: '2px solid var(--line)', background: INTENT_COLORS[hovered.capture.intent ?? ''] ?? '#eee', boxShadow: '2px 2px 0 var(--line)' }}>
                {(hovered.capture.intent ?? '—').toUpperCase()}
              </span>
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', border: '2px solid var(--line)', background: 'var(--paper)', boxShadow: '2px 2px 0 var(--line)' }}>
                {hovered.capture.type.toUpperCase()}
              </span>
              {hovered.degree > 0 && (
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)' }}>◇ {hovered.degree}</span>
              )}
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0, lineHeight: 1.35 }}>
              {hovered.capture.summary ?? hovered.capture.raw ?? '(processing…)'}
            </p>
          </div>
        )}

        {/* Click modal — side panel */}
        {selected && (
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 320,
            background: 'var(--card)', borderLeft: 'var(--bw) solid var(--line)',
            boxShadow: '-4px 0 0 var(--line)',
            display: 'flex', flexDirection: 'column',
            animation: 'pop-in .15s ease both',
          }}>
            {/* header */}
            <div style={{ display: 'flex', gap: 8, padding: '14px 16px', borderBottom: 'var(--bw) solid var(--line)', alignItems: 'center', flexShrink: 0 }}>
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', border: '2px solid var(--line)', background: INTENT_COLORS[selected.capture.intent ?? ''] ?? '#eee', boxShadow: '2px 2px 0 var(--line)' }}>
                {(selected.capture.intent ?? '—').toUpperCase()}
              </span>
              <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', border: '2px solid var(--line)', background: 'var(--paper)', boxShadow: '2px 2px 0 var(--line)' }}>
                {selected.capture.type.toUpperCase()}
              </span>
              {selected.degree > 0 && (
                <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginLeft: 2 }}>◇ {selected.degree} edges</span>
              )}
              <button
                onClick={() => setSelected(null)}
                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1, padding: '2px 4px' }}
              >✕</button>
            </div>

            {/* body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px' }}>
              {selected.capture.type === 'image' && selected.capture.file_path && (
                <ImageThumb
                  src={`/uploads/${selected.capture.file_path.split('/').pop()}`}
                  alt={selected.capture.summary ?? 'image'}
                  thumbHeight={160}
                />
              )}
              <p style={{ margin: '0 0 14px', fontSize: 16, lineHeight: 1.45, fontWeight: 500, color: 'var(--ink)' }}>
                {selected.capture.summary ?? selected.capture.raw ?? '(processing…)'}
              </p>

              {selected.capture.source_url && (
                <a href={selected.capture.source_url} target="_blank" rel="noopener noreferrer"
                  className="font-mono"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: 'var(--ref)', textDecoration: 'none', marginBottom: 14, overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↗ {selected.capture.source_url}</span>
                </a>
              )}

              {selected.capture.tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {selected.capture.tags.map(t => (
                    <span key={t} className="font-mono" style={{ fontSize: 11, padding: '2px 7px', border: '2px solid var(--line)', background: 'var(--paper)', borderRadius: 999 }}>{t}</span>
                  ))}
                </div>
              )}

              <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>
                {selected.capture.created_at?.slice(0, 16).replace('T', ' ')}
              </span>
            </div>

            {/* actions */}
            <div style={{ padding: '12px 16px', borderTop: 'var(--bw) solid var(--line)', flexShrink: 0 }}>
              <button
                onClick={() => { onPick?.(selected.capture); setSelected(null) }}
                style={{
                  width: '100%', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                  textTransform: 'uppercase', padding: '10px 0',
                  border: 'var(--bw) solid var(--line)', background: 'var(--learn)',
                  color: 'var(--ink)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                }}
              >Open in recall →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
