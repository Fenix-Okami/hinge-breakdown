import { select } from 'd3-selection';
import { sankey as createSankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';

/** Node colour palette (keyed by node id) */
const NODE_COLORS = {
  sent:      '#3b82f6', // Blue       – Likes Sent
  received:  '#06b6d4', // Cyan       – Likes Received
  sentcomment: '#60a5fa', // Light blue – Sent with comment
  sentblank: '#1d4ed8', // Dark blue  – Sent blank
  receivedcomment: '#67e8f9', // Light cyan – Received with comment
  receivedblank: '#0891b2', // Dark cyan – Received blank
  matched:   '#84cc16', // Lime       – Matched
  likeignored: '#ef4444', // Red      – Sent like ignored
  receivedignored: '#9ca3af', // Gray – Received like ignored by you / expired
  chatted:   '#3b82f6', // Blue       – Had a conversation
  never:     '#9ca3af', // Gray       – No chat after matching
  wemet:     '#10b981', // Green      – We Met
  unmatched: '#ef4444', // Red        – Unmatched / removed
  theyunmatched: '#f59e0b', // Amber  – They unmatched me
};

const NODE_ORDER = {
  sent: 1,
  received: 2,
  sentcomment: 3,
  sentblank: 4,
  receivedcomment: 5,
  receivedblank: 6,
  likeignored: 7,
  matched: 8,
  chatted: 9,
  wemet: 10,
  unmatched: 11,
  theyunmatched: 12,
  never: 13,
  receivedignored: 14,
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
  const flowTotal = likesSent + likesReceived;

  // Clear any previous render
  select(container).selectAll('*').remove();

  // ── Build node / link arrays ──────────────────────────────────────────────
  // Only include a node/link if its value is > 0 to keep the chart clean.

  /** @type {{id: string, name: string, color: string}[]} */
  const nodeDefinitions = [
    likesSent > 0 && { id: 'sent', name: 'Likes Sent' },
    likesReceived > 0 && { id: 'received', name: 'Likes Received' },
    likesSentWithComment > 0 && { id: 'sentcomment', name: 'Sent w/ Comment' },
    likesSentBlank > 0 && { id: 'sentblank', name: 'Sent Blank' },
    likesReceivedWithComment > 0 && { id: 'receivedcomment', name: 'Received w/ Comment' },
    likesReceivedBlank > 0 && { id: 'receivedblank', name: 'Received Blank' },
    matchedTotal > 0 && { id: 'matched', name: 'Matched' },
    likesSentIgnored > 0 && { id: 'likeignored', name: 'Like Ignored' },
    likesReceivedIgnored > 0 && { id: 'receivedignored', name: 'Received Like Ignored' },
    matchedChatted > 0 && { id: 'chatted', name: 'Chatted' },
    matchedNoChat > 0 && { id: 'never', name: 'No Chat' },
    weMet       > 0 && { id: 'wemet',     name: 'We Met 🎉'      },
    unmatched   > 0 && { id: 'unmatched', name: 'I Unmatched'    },
    theyUnmatchedMe > 0 && { id: 'theyunmatched', name: 'They Unmatched Me' },
  ].filter(Boolean);

  const linkDefinitions = [
    likesSentWithComment > 0 && { source: 'sent', target: 'sentcomment', value: likesSentWithComment },
    likesSentBlank > 0 && { source: 'sent', target: 'sentblank', value: likesSentBlank },

    likesReceivedWithComment > 0 && { source: 'received', target: 'receivedcomment', value: likesReceivedWithComment },
    likesReceivedBlank > 0 && { source: 'received', target: 'receivedblank', value: likesReceivedBlank },

    likesSentWithCommentMatched > 0 && { source: 'sentcomment', target: 'matched', value: likesSentWithCommentMatched },
    likesSentWithCommentIgnored > 0 && { source: 'sentcomment', target: 'likeignored', value: likesSentWithCommentIgnored },

    likesSentBlankMatched > 0 && { source: 'sentblank', target: 'matched', value: likesSentBlankMatched },
    likesSentBlankIgnored > 0 && { source: 'sentblank', target: 'likeignored', value: likesSentBlankIgnored },

    likesReceivedWithCommentMatched > 0 && { source: 'receivedcomment', target: 'matched', value: likesReceivedWithCommentMatched },
    likesReceivedWithCommentIgnored > 0 && { source: 'receivedcomment', target: 'receivedignored', value: likesReceivedWithCommentIgnored },

    likesReceivedBlankMatched > 0 && { source: 'receivedblank', target: 'matched', value: likesReceivedBlankMatched },
    likesReceivedBlankIgnored > 0 && { source: 'receivedblank', target: 'receivedignored', value: likesReceivedBlankIgnored },

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
  const margin     = { top: 16, right: 28, bottom: 16, left: 16 };
  const innerW     = width  - margin.left - margin.right;
  const innerH     = height - margin.top  - margin.bottom;

  // ── Layout ────────────────────────────────────────────────────────────────
  const sankeyLayout = createSankey()
    .nodeAlign(sankeyJustify)
    .nodeWidth(22)
    .nodePadding(26)
    .nodeSort((a, b) => (NODE_ORDER[a.id] || 999) - (NODE_ORDER[b.id] || 999))
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

  const labels = nodeGroup
    .append('text')
    .attr('x',           d => isLeft(d) ? d.x1 + 12 : d.x0 - 12)
    .attr('y',           d => (d.y0 + d.y1) / 2)
    .attr('dy',          '0.35em')
    .attr('text-anchor', d => isLeft(d) ? 'start' : 'end')
    .attr('font-size',   '15px')
    .attr('font-weight', '600')
    .attr('font-family', "inherit")
    .attr('fill',        '#1a1a2e')
    .text(d => `${d.name} (${d.value})`);

  labels.each(function () {
    const label = select(this);
    const box = this.getBBox();
    select(this.parentNode)
      .insert('rect', 'text')
      .attr('x', box.x - 6)
      .attr('y', box.y - 3)
      .attr('width', box.width + 12)
      .attr('height', box.height + 6)
      .attr('rx', 5)
      .attr('ry', 5)
      .attr('fill', 'rgba(255,255,255,0.82)');
    label.raise();
  });
}
