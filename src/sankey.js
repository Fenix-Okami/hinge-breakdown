import { select } from 'd3-selection';
import { sankey as createSankey, sankeyLinkHorizontal } from 'd3-sankey';

/** Node colour palette (keyed by node id) */
const NODE_COLORS = {
  all:       '#e8234a', // Hinge red  – All Matches
  chatted:   '#3b82f6', // Blue       – Had a conversation
  never:     '#9ca3af', // Gray       – Never messaged
  wemet:     '#10b981', // Green      – We Met
  unmatched: '#ef4444', // Red        – Unmatched / removed
  ongoing:   '#f59e0b', // Amber      – Ongoing / ghosted
};

/**
 * Renders a Sankey chart showing how matches progressed through the funnel.
 *
 * @param {HTMLElement} container
 * @param {{
 *   total: number,
 *   chatted: number,
 *   neverChatted: number,
 *   weMet: number,
 *   unmatched: number,
 *   ongoing: number
 * }} stats
 */
export function renderSankey(container, stats) {
  const { total, chatted, neverChatted, weMet, unmatched, ongoing } = stats;

  // Clear any previous render
  select(container).selectAll('*').remove();

  // ── Build node / link arrays ──────────────────────────────────────────────
  // Only include a node/link if its value is > 0 to keep the chart clean.

  /** @type {{id: string, name: string, color: string}[]} */
  const nodeDefinitions = [
    { id: 'all',       name: 'All Matches'   },
    chatted     > 0 && { id: 'chatted',   name: 'Chatted'        },
    neverChatted > 0 && { id: 'never',    name: 'Never Messaged' },
    weMet       > 0 && { id: 'wemet',     name: 'We Met 🎉'      },
    unmatched   > 0 && { id: 'unmatched', name: 'Unmatched'      },
    ongoing     > 0 && { id: 'ongoing',   name: 'Ongoing 💬'     },
  ].filter(Boolean);

  const linkDefinitions = [
    chatted     > 0 && { source: 'all',     target: 'chatted',   value: chatted     },
    neverChatted > 0 && { source: 'all',    target: 'never',     value: neverChatted },
    weMet       > 0 && { source: 'chatted', target: 'wemet',     value: weMet       },
    unmatched   > 0 && { source: 'chatted', target: 'unmatched', value: unmatched   },
    ongoing     > 0 && { source: 'chatted', target: 'ongoing',   value: ongoing     },
  ].filter(Boolean);

  if (linkDefinitions.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;color:#6b7280;padding:2rem 0">Not enough data to render the Sankey chart.</p>';
    return;
  }

  // Map id → index for link source/target
  const idToIndex = Object.fromEntries(
    nodeDefinitions.map((n, i) => [n.id, i])
  );

  const nodes = nodeDefinitions.map(n => ({ ...n, color: NODE_COLORS[n.id] }));
  const links = linkDefinitions.map(l => ({
    source: idToIndex[l.source],
    target: idToIndex[l.target],
    value:  l.value,
  }));

  // ── Dimensions ────────────────────────────────────────────────────────────
  const containerW = container.offsetWidth || 760;
  const width      = Math.min(containerW, 860);
  // Scale height with total, clamped to a reasonable range
  const height     = Math.max(220, Math.min(480, Math.round(total * 2.8)));
  const margin     = { top: 16, right: 200, bottom: 16, left: 16 };
  const innerW     = width  - margin.left - margin.right;
  const innerH     = height - margin.top  - margin.bottom;

  // ── Layout ────────────────────────────────────────────────────────────────
  const sankeyLayout = createSankey()
    .nodeWidth(22)
    .nodePadding(20)
    .extent([[0, 0], [innerW, innerH]]);

  const graph = sankeyLayout({
    nodes: nodes.map(n => ({ ...n })),
    links: links.map(l => ({ ...l })),
  });

  // ── SVG ───────────────────────────────────────────────────────────────────
  const svg = select(container)
    .append('svg')
    .attr('width',   width)
    .attr('height',  height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('height', 'auto');

  const g = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // ── Links ─────────────────────────────────────────────────────────────────
  const linkGroup = g.append('g').attr('fill', 'none');

  linkGroup
    .selectAll('path')
    .data(graph.links)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke',       d => d.source.color)
    .attr('stroke-width', d => Math.max(1, d.width))
    .attr('opacity', 0.38)
    .on('mouseenter', function () {
      select(this).attr('opacity', 0.68);
    })
    .on('mouseleave', function () {
      select(this).attr('opacity', 0.38);
    })
    .append('title')
    .text(d => `${d.source.name} → ${d.target.name}: ${d.value} matches`);

  // ── Nodes ─────────────────────────────────────────────────────────────────
  const nodeGroup = g
    .selectAll('g.node')
    .data(graph.nodes)
    .join('g')
    .attr('class', 'node');

  nodeGroup
    .append('rect')
    .attr('x',      d => d.x0)
    .attr('y',      d => d.y0)
    .attr('height', d => Math.max(1, d.y1 - d.y0))
    .attr('width',  d => d.x1 - d.x0)
    .attr('fill',   d => d.color)
    .attr('rx', 3)
    .attr('ry', 3)
    .append('title')
    .text(d => `${d.name}: ${d.value} matches`);

  // ── Labels ────────────────────────────────────────────────────────────────
  const isLeft = d => d.x0 < innerW / 2;

  nodeGroup
    .append('text')
    .attr('x',           d => isLeft(d) ? d.x1 + 8 : d.x0 - 8)
    .attr('y',           d => (d.y0 + d.y1) / 2)
    .attr('dy',          '0.35em')
    .attr('text-anchor', d => isLeft(d) ? 'start' : 'end')
    .attr('font-size',   '13px')
    .attr('font-family', "inherit")
    .attr('fill',        '#1a1a2e')
    .text(d => `${d.name} (${d.value})`);
}
