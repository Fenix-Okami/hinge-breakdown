import { select, pointer } from 'd3-selection';
import { sankey as createSankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey';

/** Node colour palette (keyed by node id) */
const NODE_COLORS = {
  sent:      '#3b82f6', // Blue       – Likes Sent
  received:  '#06b6d4', // Cyan       – Likes Received
  sentcomment: '#60a5fa', // Light blue – Sent with comment
  sentblank: '#1d4ed8', // Dark blue  – Sent blank
  matched:   '#7c3aed', // Burple     – Matched
  ignored: '#ef4444', // Red      – Ignored
  chatted:   '#3b82f6', // Blue       – Had a conversation
  never:     '#9ca3af', // Gray       – No chat after matching
  wemet:     '#10b981', // Green      – We Met
  unmatched: '#f59e0b', // Amber      – I unmatched
  theyunmatched: '#ef4444', // Red    – They unmatched me
};

const NODE_ORDER = {
  received: 1,
  sent: 2,
  sentcomment: 3,
  sentblank: 4,
  matched: 7,
  ignored: 8,
  chatted: 9,
  never: 10,
  wemet: 11,
  unmatched: 12,
  theyunmatched: 13,
};

/**
 * Renders a Sankey chart showing how matches progressed through the funnel.
 *
 * @param {HTMLElement} container
 * @param {{
 *   likesSent: number,
 *   likesReceived: number,
 *   likesSentWithCommentMatched: number,
 *   likesSentWithCommentIgnored: number,
 *   likesSentBlankMatched: number,
 *   likesSentBlankIgnored: number,
 *   likesReceivedWithCommentMatched: number,
 *   likesReceivedWithCommentIgnored: number,
 *   likesReceivedBlankMatched: number,
 *   likesReceivedBlankIgnored: number,
 *   likesSentWithComment: number,
 *   likesSentBlank: number,
 *   likesReceivedWithComment: number,
 *   likesReceivedBlank: number,
 *   matchedTotal: number,
 *   matchedChatted: number,
 *   matchedNoChat: number,
 *   weMet: number,
 *   unmatched: number,
 *   theyUnmatchedMe: number
 * }} stats
 */
export function renderSankey(container, stats) {
  const {
    likesSent,
    likesReceived,
    likesSentWithCommentMatched,
    likesSentWithCommentIgnored,
    likesSentBlankMatched,
    likesSentBlankIgnored,
    likesReceivedWithCommentMatched,
    likesReceivedWithCommentIgnored,
    likesReceivedBlankMatched,
    likesReceivedBlankIgnored,
    likesSentWithComment,
    likesSentBlank,
    likesReceivedWithComment,
    likesReceivedBlank,
    matchedTotal,
    matchedChatted,
    matchedNoChat,
    weMet,
    unmatched,
    theyUnmatchedMe,
  } = stats;
  const likesSentIgnored = likesSentWithCommentIgnored + likesSentBlankIgnored;
  const likesReceivedIgnored = likesReceivedWithCommentIgnored + likesReceivedBlankIgnored;
  const ignoredTotal = likesSentIgnored + likesReceivedIgnored;
  const likesReceivedMatched = likesReceivedWithCommentMatched + likesReceivedBlankMatched;
  const flowTotal = likesSent + likesReceived;

  // Clear any previous render
  select(container).selectAll('*').remove();

  // ── Build node / link arrays ──────────────────────────────────────────────
  // Only include a node/link if its value is > 0 to keep the chart clean.

  /** @type {{id: string, name: string, color: string}[]} */
  const nodeDefinitions = [
    likesSent > 0 && { id: 'sent', name: 'Likes sent' },
    likesReceived > 0 && { id: 'received', name: 'Likes received' },
    likesSentWithComment > 0 && { id: 'sentcomment', name: 'W/ Opener' },
    likesSentBlank > 0 && { id: 'sentblank', name: 'W/O Opener' },
    ignoredTotal > 0 && { id: 'ignored', name: 'Ignored' },
    matchedTotal > 0 && { id: 'matched', name: 'Matched' },
    matchedChatted > 0 && { id: 'chatted', name: 'Chatted' },
    matchedNoChat > 0 && { id: 'never', name: 'No chat' },
    weMet       > 0 && { id: 'wemet',     name: 'Met with'      },
    unmatched   > 0 && { id: 'unmatched', name: 'I unmatched'   },
    theyUnmatchedMe > 0 && { id: 'theyunmatched', name: 'They unmatched me' },
  ].filter(Boolean);

  const linkDefinitions = [
    likesSentWithComment > 0 && { source: 'sent', target: 'sentcomment', value: likesSentWithComment },
    likesSentBlank > 0 && { source: 'sent', target: 'sentblank', value: likesSentBlank },

    likesSentWithCommentMatched > 0 && { source: 'sentcomment', target: 'matched', value: likesSentWithCommentMatched },
    likesSentWithCommentIgnored > 0 && { source: 'sentcomment', target: 'ignored', value: likesSentWithCommentIgnored },

    likesSentBlankMatched > 0 && { source: 'sentblank', target: 'matched', value: likesSentBlankMatched },
    likesSentBlankIgnored > 0 && { source: 'sentblank', target: 'ignored', value: likesSentBlankIgnored },

    likesReceivedMatched > 0 && { source: 'received', target: 'matched', value: likesReceivedMatched },
    likesReceivedIgnored > 0 && { source: 'received', target: 'ignored', value: likesReceivedIgnored },

    matchedChatted > 0 && { source: 'matched', target: 'chatted', value: matchedChatted },
    matchedNoChat > 0 && { source: 'matched', target: 'never', value: matchedNoChat },

    weMet > 0 && { source: 'chatted', target: 'wemet', value: weMet },
    unmatched > 0 && { source: 'chatted', target: 'unmatched', value: unmatched },
    theyUnmatchedMe > 0 && { source: 'chatted', target: 'theyunmatched', value: theyUnmatchedMe },
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
  const width      = container.offsetWidth || 760;
  // Scale height with total flow volume, clamped to a reasonable range
  const height     = Math.max(300, Math.min(620, Math.round(flowTotal * 3.1)));
  const margin     = { top: 16, right: 28, bottom: 16, left: 220 };
  const innerW     = width  - margin.left - margin.right;
  const innerH     = height - margin.top  - margin.bottom;

  // ── Layout ────────────────────────────────────────────────────────────────
  const sankeyLayout = createSankey()
    .nodeAlign(sankeyLeft)
    .nodeWidth(22)
    .nodePadding(26)
    .nodeSort((a, b) => (NODE_ORDER[a.id] || 999) - (NODE_ORDER[b.id] || 999))
    .linkSort((a, b) => {
      const rank = (link) => {
        const targetId = link.target?.id;
        const sourceId = link.source?.id;
        if (targetId === 'matched' && sourceId === 'received') return 0;
        if (targetId === 'matched' && sourceId === 'sentcomment') return 1;
        if (targetId === 'matched' && sourceId === 'sentblank') return 2;
        if (targetId === 'chatted') return 3;
        if (targetId === 'ignored') return 4;
        if (targetId === 'never') return 5;
        if (targetId === 'wemet') return 6;
        if (targetId === 'unmatched') return 7;
        if (targetId === 'theyunmatched') return 8;
        return 20;
      };
      return rank(a) - rank(b);
    })
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

  const defs = svg.append('defs');
  const gradientIdPrefix = `link-gradient-${Math.random().toString(36).slice(2, 10)}`;

  const hoverCallout = g
    .append('g')
    .style('pointer-events', 'none')
    .style('opacity', 0);

  const hoverBg = hoverCallout
    .append('rect')
    .attr('rx', 10)
    .attr('ry', 10)
    .attr('fill', 'rgba(255,255,255,0.95)')
    .attr('stroke', '#c7d2fe')
    .attr('stroke-width', 1.5)
    .attr('filter', 'drop-shadow(0 6px 10px rgba(60, 30, 120, 0.18))');

  const hoverValue = hoverCallout
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('font-size', '28px')
    .attr('font-weight', '800')
    .attr('font-family', 'inherit')
    .attr('fill', '#312e81');

  function showHoverCallout(x, y, value, color) {
    hoverValue
      .text(String(value))
      .attr('x', 0)
      .attr('y', 6)
      .attr('fill', color || '#312e81');

    const valueBox = hoverValue.node().getBBox();
    const boxWidth = valueBox.width + 26;
    const boxHeight = 44;

    const minX = boxWidth / 2;
    const maxX = innerW - boxWidth / 2;
    const minY = boxHeight / 2;
    const maxY = innerH - boxHeight / 2;
    const clampedX = Math.max(minX, Math.min(maxX, x));
    const clampedY = Math.max(minY, Math.min(maxY, y - 26));

    hoverBg
      .attr('x', -boxWidth / 2)
      .attr('y', -boxHeight / 2)
      .attr('width', boxWidth)
      .attr('height', boxHeight);

    hoverCallout
      .attr('transform', `translate(${clampedX},${clampedY})`)
      .style('opacity', 1);

    hoverCallout.raise();
  }

  function hideHoverCallout() {
    hoverCallout.style('opacity', 0);
  }

  // ── Links ─────────────────────────────────────────────────────────────────
  const linkGroup = g.append('g').attr('fill', 'none');

  const linkGradients = defs
    .selectAll('linearGradient')
    .data(graph.links)
    .join('linearGradient')
    .attr('id', (_d, i) => `${gradientIdPrefix}-${i}`)
    .attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', d => d.source.x1 + margin.left)
    .attr('x2', d => d.target.x0 + margin.left)
    .attr('y1', d => d.y0 + margin.top)
    .attr('y2', d => d.y1 + margin.top);

  linkGradients
    .selectAll('stop')
    .data(d => [
      { offset: '0%', color: d.source.color },
      { offset: '100%', color: d.target.color },
    ])
    .join('stop')
    .attr('offset', d => d.offset)
    .attr('stop-color', d => d.color);

  linkGroup
    .selectAll('path')
    .data(graph.links)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke',       (_d, i) => `url(#${gradientIdPrefix}-${i})`)
    .attr('stroke-width', d => Math.max(1, d.width))
    .attr('opacity', 0.58)
    .on('mouseenter', function (event, d) {
      const [mx, my] = pointer(event, g.node());
      select(this)
        .attr('opacity', 0.95)
        .attr('stroke-width', Math.max(2, d.width + 2));
      showHoverCallout(mx, my, d.value, d.target.color);
    })
    .on('mousemove', function (event, d) {
      const [mx, my] = pointer(event, g.node());
      showHoverCallout(mx, my, d.value, d.target.color);
    })
    .on('mouseleave', function (event, d) {
      select(this)
        .attr('opacity', 0.58)
        .attr('stroke-width', Math.max(1, d.width));
      hideHoverCallout();
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
  const labelGroup = nodeGroup
    .append('g')
    .attr('transform', d => `translate(${d.x0 - 12},${(d.y0 + d.y1) / 2})`);

  labelGroup
    .append('text')
    .attr('x', 0)
    .attr('y', -10)
    .attr('text-anchor', 'end')
    .attr('font-size', '15px')
    .attr('font-weight', '700')
    .attr('font-family', 'inherit')
    .attr('fill', '#111827')
    .text(d => d.name);

  const valueText = labelGroup
    .append('text')
    .attr('x', 0)
    .attr('y', 12)
    .attr('text-anchor', 'end')
    .attr('font-size', '14px')
    .attr('font-weight', '800')
    .attr('font-family', 'inherit')
    .attr('fill', d => d.color)
    .text(d => String(d.value));

  valueText.each(function () {
    const value = select(this);
    const box = this.getBBox();
    select(this.parentNode)
      .insert('rect', 'text')
      .attr('x', box.x - 9)
      .attr('y', box.y - 4)
      .attr('width', box.width + 18)
      .attr('height', box.height + 8)
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('fill', 'rgba(255,255,255,0.96)')
      .attr('stroke', d => d.color)
      .attr('stroke-width', 1.2);
    value.raise();
  });
}
