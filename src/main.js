import {
  parseMatches,
  parseHingeDate,
  getMatchAnchorDate,
  generateSampleData,
} from './parser.js';
import { renderSankey } from './sankey.js';
import {
  renderMonthlyChart,
  renderDayOfWeekChart,
  renderConvLengthChart,
  renderHourlyChart,
} from './charts.js';

// ── DOM references ────────────────────────────────────────────────────────────
const uploadSection = /** @type {HTMLElement} */ (document.getElementById('upload-section'));
const dashboard     = /** @type {HTMLElement} */ (document.getElementById('dashboard'));
const fileInput     = /** @type {HTMLInputElement} */ (document.getElementById('file-input'));
const uploadBtn     = document.getElementById('upload-btn');
const dropZone      = document.getElementById('drop-zone');
const demoBtn       = document.getElementById('demo-btn');
const resetBtn      = document.getElementById('reset-btn');
const sampleNotice  = document.getElementById('sample-notice');
const errorMsg      = document.getElementById('error-message');
const yearFilters   = document.getElementById('year-filters');
const monthFilters  = document.getElementById('month-filters');
const clearDateFiltersBtn = document.getElementById('clear-date-filters');
const calendarHeatmap = document.getElementById('calendar-heatmap');
const heatmapLikesBtn = document.getElementById('heatmap-likes-btn');
const heatmapMatchesBtn = document.getElementById('heatmap-matches-btn');
const sankeyMetrics = document.getElementById('sankey-metrics');
const openerInsights = document.getElementById('opener-insights');
const conversationInsights = document.getElementById('conversation-insights');
const conversationOutcomeFilters = document.getElementById('conversation-outcome-filters');
const conversationList = document.getElementById('conversation-list');
const conversationViewer = document.getElementById('conversation-viewer');

let sourceData = null;
let selectedYears = new Set();
let selectedMonths = new Set();
let heatmapMetric = 'likes';
let selectedConversationOutcome = 'met';
let selectedConversationIndex = 0;
let availableMonths = [];

const heatmapTooltip = document.createElement('div');
heatmapTooltip.id = 'heatmap-tooltip';
heatmapTooltip.className = 'heatmap-tooltip hidden';
document.body.appendChild(heatmapTooltip);

const MONTHS = [
  { key: 1, label: 'Jan' },
  { key: 2, label: 'Feb' },
  { key: 3, label: 'Mar' },
  { key: 4, label: 'Apr' },
  { key: 5, label: 'May' },
  { key: 6, label: 'Jun' },
  { key: 7, label: 'Jul' },
  { key: 8, label: 'Aug' },
  { key: 9, label: 'Sep' },
  { key: 10, label: 'Oct' },
  { key: 11, label: 'Nov' },
  { key: 12, label: 'Dec' },
];

// ── Event listeners ───────────────────────────────────────────────────────────
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
demoBtn.addEventListener('click', loadSampleData);
resetBtn.addEventListener('click', resetDashboard);
if (clearDateFiltersBtn) {
  clearDateFiltersBtn.addEventListener('click', clearDateFilters);
}
if (heatmapLikesBtn) {
  heatmapLikesBtn.addEventListener('click', () => {
    heatmapMetric = 'likes';
    refreshHeatmapMetricButtons();
    renderFilteredDashboard();
  });
}
if (heatmapMatchesBtn) {
  heatmapMatchesBtn.addEventListener('click', () => {
    heatmapMetric = 'matches';
    refreshHeatmapMetricButtons();
    renderFilteredDashboard();
  });
}

// Drag and drop
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file) processFile(file);
});

// Clicking anywhere on the drop zone (except the button itself) opens the picker
dropZone.addEventListener('click', e => {
  if (e.target !== uploadBtn) fileInput.click();
});

if (calendarHeatmap) {
  calendarHeatmap.addEventListener('mouseover', e => {
    const cell = e.target.closest('.heatmap-cell');
    if (cell && !cell.classList.contains('heatmap-cell-outside')) {
      const text = cell.getAttribute('data-tooltip');
      if (text) {
        heatmapTooltip.textContent = text;
        heatmapTooltip.classList.remove('hidden');
      }
    }
  });

  calendarHeatmap.addEventListener('mousemove', e => {
    heatmapTooltip.style.left = `${e.pageX + 10}px`;
    heatmapTooltip.style.top = `${e.pageY - 30}px`;
  });

  calendarHeatmap.addEventListener('mouseout', e => {
    const cell = e.target.closest('.heatmap-cell');
    if (cell) {
      heatmapTooltip.classList.add('hidden');
    }
  });
}

// ── File handling ─────────────────────────────────────────────────────────────

function handleFileSelect(e) {
  const file = e.target.files?.[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.name.endsWith('.json') && file.type !== 'application/json') {
    showError('Please upload a .json file.');
    return;
  }

  const reader = new FileReader();

  reader.onload = e => {
    try {
      const data = JSON.parse(/** @type {string} */ (e.target.result));
      renderDashboard(data, false);
    } catch (err) {
      if (err instanceof SyntaxError) {
        showError(
          'The file does not appear to be valid JSON. Please make sure you uploaded matches.json from your Hinge data export.'
        );
      } else {
        showError(/** @type {Error} */ (err).message);
      }
    }
  };

  reader.onerror = () => showError('Failed to read the file. Please try again.');
  reader.readAsText(file);
}

function loadSampleData() {
  renderDashboard(generateSampleData(), true);
}

// ── Dashboard rendering ───────────────────────────────────────────────────────

function renderDashboard(data, isSample) {
  sourceData = data;

  const years = getAvailableYears(data);
  selectedYears = new Set(years);
  
  const monthsSet = getAvailableMonths(data);
  availableMonths = MONTHS.filter(m => monthsSet.has(m.key));
  selectedMonths = new Set(availableMonths.map(m => m.key));

  uploadSection.classList.add('hidden');
  dashboard.classList.remove('hidden');

  renderFilterButtons(years);
  renderFilteredDashboard();

  hideError();

  if (isSample) {
    sampleNotice.classList.remove('hidden');
  } else {
    sampleNotice.classList.add('hidden');
  }

}

function renderFilteredDashboard() {
  if (!sourceData) return;

  let stats;
  let filteredData = [];
  try {
    filteredData = filterMatches(sourceData, selectedYears, selectedMonths);
    stats = filteredData.length > 0 ? parseMatches(filteredData) : createEmptyStats();
  } catch (err) {
    showError(/** @type {Error} */ (err).message);
    return;
  }

  hideError();
  renderCalendarHeatmap(filteredData, heatmapMetric);

  const activitySeries = buildActivitySeries(filteredData);
  renderSankeyMetrics(stats);
  renderBottomInsights(filteredData);

  const sankeyContainer = document.getElementById('sankey-chart');
  renderSankey(sankeyContainer, stats);

  renderMonthlyChart('monthly-chart', activitySeries.monthly.likes, activitySeries.monthly.matches);
  renderDayOfWeekChart('dayofweek-chart', activitySeries.dayOfWeek.likes, activitySeries.dayOfWeek.matches);
  renderConvLengthChart('convlength-chart', activitySeries.yearly.likes, activitySeries.yearly.matches);
  renderHourlyChart('hourly-chart', activitySeries.hourly.likes, activitySeries.hourly.matches);
}

// ── Calendar heatmap ─────────────────────────────────────────────────────────

function renderCalendarHeatmap(data, metric) {
  if (!calendarHeatmap) return;

  calendarHeatmap.innerHTML = '';
  if (!Array.isArray(data) || data.length === 0) {
    calendarHeatmap.innerHTML = '<p class="heatmap-empty">No activity in current filter.</p>';
    return;
  }

  const dateCounts = new Map();

  for (const item of data) {
    const timestamp = getMetricTimestamp(item, metric);
    const date = parseHingeDate(timestamp);
    if (!date) continue;
    if (!isDateSelected(date)) continue;
    const key = toDateKey(date);
    dateCounts.set(key, (dateCounts.get(key) || 0) + 1);
  }

  if (dateCounts.size === 0) {
    calendarHeatmap.innerHTML = '<p class="heatmap-empty">No activity in current filter.</p>';
    return;
  }
  const maxValue = Math.max(...dateCounts.values(), 1);

  const monthKeys = Array.from(
    new Set(Array.from(dateCounts.keys()).map(key => key.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const chunks = document.createElement('div');
  chunks.className = 'heatmap-chunks';

  for (const monthKey of monthKeys) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const firstOfMonth = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const offset = firstOfMonth.getDay();
    const totalCells = offset + lastDay;
    const totalWeeks = Math.ceil(totalCells / 7);

    const chunk = document.createElement('div');
    chunk.className = 'heatmap-chunk';

    const label = document.createElement('div');
    label.className = 'heatmap-chunk-label';
    label.textContent = firstOfMonth.toLocaleString('default', {
      month: 'short',
      year: 'numeric',
    });
    chunk.appendChild(label);

    const grid = document.createElement('div');
    grid.className = 'heatmap-month-grid';
    grid.style.gridTemplateRows = 'repeat(7, 12px)';
    grid.style.gridTemplateColumns = `repeat(${totalWeeks}, 12px)`;

    for (let cellIndex = 0; cellIndex < totalWeeks * 7; cellIndex++) {
      const weekIndex = Math.floor(cellIndex / 7);
      const dayOfWeek = cellIndex % 7;
      const reversedWeekIndex = totalWeeks - 1 - weekIndex;
      const day = cellIndex - offset + 1;
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.style.gridColumn = String(reversedWeekIndex + 1);
      cell.style.gridRow = String(dayOfWeek + 1);

      if (day < 1 || day > lastDay) {
        cell.classList.add('heatmap-cell-outside');
        grid.appendChild(cell);
        continue;
      }

      const key = `${monthKey}-${String(day).padStart(2, '0')}`;
      const value = dateCounts.get(key) || 0;
      if (value > 0) {
        cell.style.background = metric === 'likes'
          ? `rgba(59,130,246,${0.18 + 0.82 * (value / maxValue)})`
          : `rgba(124,58,237,${0.18 + 0.82 * (value / maxValue)})`;
      }
      cell.setAttribute('data-tooltip', `${key}: ${value} ${metric === 'likes' ? 'likes sent' : 'matches made'}`);
      grid.appendChild(cell);
    }

    chunk.appendChild(grid);
    chunks.appendChild(chunk);
  }

  calendarHeatmap.appendChild(chunks);
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetDashboard() {
  dashboard.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  fileInput.value = '';
  if (yearFilters) yearFilters.innerHTML = '';
  if (monthFilters) monthFilters.innerHTML = '';
  if (calendarHeatmap) calendarHeatmap.innerHTML = '';
  sourceData = null;
  selectedYears = new Set();
  selectedMonths = new Set();
  availableMonths = [];
  const sankeyContainer = document.getElementById('sankey-chart');
  if (sankeyContainer) sankeyContainer.innerHTML = '';
  hideError();
}

function getAvailableYears(data) {
  const years = new Set();

  for (const match of data) {
    const date = getMatchAnchorDate(match);
    if (date) years.add(date.getFullYear());
  }

  return Array.from(years).sort((a, b) => b - a);
}

function getAvailableMonths(data) {
  const months = new Set();

  for (const match of data) {
    const date = getMatchAnchorDate(match);
    if (date) months.add(date.getMonth() + 1);
  }

  return months;
}

function filterMatches(data, yearSet, monthSet) {
  return data.filter(match => {
    const date = getMatchAnchorDate(match);
    if (!date) return false;
    return yearSet.has(date.getFullYear()) && monthSet.has(date.getMonth() + 1);
  });
}

function renderFilterButtons(years) {
  if (!yearFilters || !monthFilters) return;

  yearFilters.innerHTML = '';
  monthFilters.innerHTML = '';

  for (const year of years) {
    yearFilters.appendChild(createFilterButton(String(year), true, () => {
      if (selectedYears.has(year)) {
        selectedYears.delete(year);
      } else {
        selectedYears.add(year);
      }
      refreshFilterUI(years);
      renderFilteredDashboard();
    }));
  }

  for (const month of availableMonths) {
    monthFilters.appendChild(createFilterButton(month.label, true, () => {
      if (selectedMonths.has(month.key)) {
        selectedMonths.delete(month.key);
      } else {
        selectedMonths.add(month.key);
      }
      refreshFilterUI(years);
      renderFilteredDashboard();
    }));
  }

  refreshFilterUI(years);
}

function refreshFilterUI(years) {
  if (!yearFilters || !monthFilters) return;

  const yearButtons = yearFilters.querySelectorAll('button');
  yearButtons.forEach((btn, index) => {
    const year = years[index];
    btn.classList.toggle('active', selectedYears.has(year));
  });

  const monthButtons = monthFilters.querySelectorAll('button');
  monthButtons.forEach((btn, index) => {
    const month = availableMonths[index];
    if (month) {
      btn.classList.toggle('active', selectedMonths.has(month.key));
    }
  });
}

function createFilterButton(label, active, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `filter-btn ${active ? 'active' : ''}`;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function refreshHeatmapMetricButtons() {
  if (heatmapLikesBtn) {
    heatmapLikesBtn.classList.toggle('active', heatmapMetric === 'likes');
  }
  if (heatmapMatchesBtn) {
    heatmapMatchesBtn.classList.toggle('active', heatmapMetric === 'matches');
  }
}

function getTimestampFromArray(value) {
  if (!Array.isArray(value) || value.length === 0) return '';
  const first = value[0];
  if (!first || typeof first !== 'object') return '';
  return typeof first.timestamp === 'string' ? first.timestamp : '';
}

function getMetricTimestamp(item, metric) {
  return metric === 'likes'
    ? getTimestampFromArray(item.like)
    : getTimestampFromArray(item.match);
}

function isDateSelected(date) {
  return selectedYears.has(date.getFullYear()) && selectedMonths.has(date.getMonth() + 1);
}

function buildActivitySeries(data) {
  const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayFromJs = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthly = { likes: {}, matches: {} };
  const yearly = { likes: {}, matches: {} };
  const dayOfWeek = {
    likes: Object.fromEntries(dayKeys.map(day => [day, 0])),
    matches: Object.fromEntries(dayKeys.map(day => [day, 0])),
  };
  const hourly = {
    likes: new Array(24).fill(0),
    matches: new Array(24).fill(0),
  };

  for (const item of data) {
    const likesDate = parseHingeDate(getMetricTimestamp(item, 'likes'));
    if (likesDate) {
      const monthKey = `${likesDate.getFullYear()}-${String(likesDate.getMonth() + 1).padStart(2, '0')}`;
      const yearKey = String(likesDate.getFullYear());
      monthly.likes[monthKey] = (monthly.likes[monthKey] || 0) + 1;
      yearly.likes[yearKey] = (yearly.likes[yearKey] || 0) + 1;
      dayOfWeek.likes[dayFromJs[likesDate.getDay()]]++;
      hourly.likes[likesDate.getHours()]++;
    }

    const matchesDate = parseHingeDate(getMetricTimestamp(item, 'matches'));
    if (matchesDate) {
      const monthKey = `${matchesDate.getFullYear()}-${String(matchesDate.getMonth() + 1).padStart(2, '0')}`;
      const yearKey = String(matchesDate.getFullYear());
      monthly.matches[monthKey] = (monthly.matches[monthKey] || 0) + 1;
      yearly.matches[yearKey] = (yearly.matches[yearKey] || 0) + 1;
      dayOfWeek.matches[dayFromJs[matchesDate.getDay()]]++;
      hourly.matches[matchesDate.getHours()]++;
    }
  }

  return { monthly, yearly, dayOfWeek, hourly };
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clearDateFilters() {
  selectedYears.clear();
  selectedMonths.clear();
  const years = sourceData ? getAvailableYears(sourceData) : [];
  refreshFilterUI(years);
  renderFilteredDashboard();
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function renderSankeyMetrics(stats) {
  if (!sankeyMetrics) return;

  const totalLikes = stats.likesSent + stats.likesReceived;
  const matchedAll = stats.likesSentMatched + stats.likesReceivedMatched;
  const ignoredAll = stats.likesSentIgnored + stats.likesReceivedIgnored;
  const allTotal = matchedAll + ignoredAll;
  const overallMatchRate = percent(matchedAll, allTotal);
  const likesPerMatch = matchedAll > 0 ? (totalLikes / matchedAll) : null;

  const withOpenerTotal = stats.likesSentWithCommentMatched + stats.likesSentWithCommentIgnored;
  const withoutOpenerTotal = stats.likesSentBlankMatched + stats.likesSentBlankIgnored;
  const withOpenerMatchRate = percent(stats.likesSentWithCommentMatched, withOpenerTotal);
  const withoutOpenerMatchRate = percent(stats.likesSentBlankMatched, withoutOpenerTotal);

  const likesSent = stats.likesSent;
  const dates = stats.weMet;
  const likesPerDate = dates > 0 ? (likesSent / dates) : null;
  const dateRate = percent(dates, likesSent);

  const likeToMatchText = matchedAll > 0
    ? `1 match per ${likesPerMatch.toFixed(1)} likes`
    : 'No matches in current filter';
  const dateRatioText = dates > 0
    ? `1 date per ${likesPerDate.toFixed(1)} likes sent`
    : 'No we met outcomes in filter';

  sankeyMetrics.innerHTML = `
    <article class="sankey-metric-card metric-blue">
      <h4>Overall <span class="metric-like">like</span> to <span class="metric-match">match</span> ratio</h4>
      <p class="metric-value">${likeToMatchText}</p>
      <p class="metric-sub">${formatPercent(overallMatchRate)} match rate across sent + received likes</p>
    </article>
    <article class="sankey-metric-card metric-purple">
      <h4><span class="metric-match">Match</span> rate (sent likes only)</h4>
      <p class="metric-value">W/ opener ${formatPercent(withOpenerMatchRate)}</p>
      <p class="metric-value">W/O opener ${formatPercent(withoutOpenerMatchRate)}</p>
    </article>
    <article class="sankey-metric-card metric-green">
      <h4><span class="metric-like">Like</span> to <span class="metric-date">date</span> ratio</h4>
      <p class="metric-value">${dateRatioText}</p>
      <p class="metric-sub">${formatPercent(dateRate)} of likes sent ended in we met</p>
    </article>
  `;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractSentOpener(match) {
  const outerLike = Array.isArray(match.like) ? match.like[0] : null;
  if (!outerLike || typeof outerLike !== 'object') return '';

  if (typeof outerLike.comment === 'string') {
    return normalizeText(outerLike.comment);
  }

  const nestedLike = Array.isArray(outerLike.like) ? outerLike.like[0] : null;
  if (nestedLike && typeof nestedLike === 'object' && typeof nestedLike.comment === 'string') {
    return normalizeText(nestedLike.comment);
  }

  return '';
}

function startsWithRemove(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('remove');
}

function renderBottomInsights(data) {
  renderOpenerInsights(data);
  renderConversationInsights(data);
}

function renderOpenerInsights(data) {
  if (!openerInsights) return;

  const openerMap = new Map();

  for (const item of data) {
    const hasLike = Array.isArray(item.like) && item.like.length > 0;
    const hasMatch = Array.isArray(item.match) && item.match.length > 0;
    if (!hasLike) continue;
    if (!hasMatch) continue;
    const opener = extractSentOpener(item);
    if (!opener || startsWithRemove(opener)) continue;
    const key = opener.toLowerCase();
    if (!openerMap.has(key)) {
      openerMap.set(key, opener);
    }
  }

  const openers = Array.from(openerMap.values());

  if (openers.length === 0) {
    openerInsights.innerHTML = '<p class="insight-empty">No sent openers that converted to matches in this filter.</p>';
    return;
  }

  const listItems = openers.map(opener => {
    return `
      <li class="opener-item" title="${opener.replace(/"/g, '&quot;')}">
        <span class="opener-text">${opener}</span>
      </li>
    `;
  }).join('');

  openerInsights.innerHTML = `<ul class="opener-list">${listItems}</ul>`;
}

function renderConversationInsights(data) {
  if (!conversationInsights || !conversationOutcomeFilters || !conversationList || !conversationViewer) return;

  const outcomes = [
    { key: 'met', label: 'We met' },
    { key: 'iunmatched', label: 'I unmatched' },
    { key: 'theyunmatched', label: 'They unmatched' },
  ];

  const buckets = {
    met: [],
    iunmatched: [],
    theyunmatched: [],
  };

  for (const item of data) {
    const chats = Array.isArray(item.chats) ? item.chats : [];
    if (chats.length === 0) continue;

    const hasWeMet = Array.isArray(item.we_met) && item.we_met.length > 0;
    const hasBlock = Array.isArray(item.block) && item.block.length > 0;
    const key = hasWeMet ? 'met' : hasBlock ? 'iunmatched' : 'theyunmatched';

    const firstChat = chats.find(c => typeof c?.body === 'string' && c.body.trim().length > 0);
    const preview = firstChat ? firstChat.body.trim() : '(No text content)';
    buckets[key].push({
      preview,
      chats,
    });
  }

  const availableOutcome = outcomes.find(outcome => buckets[outcome.key].length > 0);
  if (!availableOutcome) {
    conversationOutcomeFilters.innerHTML = '';
    conversationList.innerHTML = '<p class="insight-empty">No conversations in this filter.</p>';
    conversationViewer.innerHTML = '';
    return;
  }

  if (!buckets[selectedConversationOutcome] || buckets[selectedConversationOutcome].length === 0) {
    selectedConversationOutcome = availableOutcome.key;
    selectedConversationIndex = 0;
  }

  conversationOutcomeFilters.innerHTML = outcomes.map(outcome => {
    const count = buckets[outcome.key].length;
    const activeClass = outcome.key === selectedConversationOutcome ? 'active' : '';
    return `<button type="button" class="conversation-filter-btn ${activeClass}" data-outcome="${outcome.key}">${outcome.label} (${count})</button>`;
  }).join('');

  conversationOutcomeFilters.querySelectorAll('.conversation-filter-btn').forEach(button => {
    button.addEventListener('click', () => {
      const outcome = button.getAttribute('data-outcome');
      if (!outcome || outcome === selectedConversationOutcome) return;
      selectedConversationOutcome = outcome;
      selectedConversationIndex = 0;
      renderConversationInsights(data);
    });
  });

  const conversations = buckets[selectedConversationOutcome] || [];
  if (selectedConversationIndex >= conversations.length) selectedConversationIndex = 0;

  conversationList.innerHTML = conversations.map((conversation, index) => {
    const activeClass = index === selectedConversationIndex ? 'active' : '';
    const trimmed = conversation.preview.length > 70
      ? `${conversation.preview.slice(0, 70)}…`
      : conversation.preview;
    return `<button type="button" class="conversation-item-btn ${activeClass}" data-index="${index}">Chat ${index + 1}: ${trimmed}</button>`;
  }).join('');

  conversationList.querySelectorAll('.conversation-item-btn').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number.parseInt(button.getAttribute('data-index') || '-1', 10);
      if (Number.isNaN(index)) return;
      selectedConversationIndex = index;
      renderConversationInsights(data);
    });
  });

  const selectedConversation = conversations[selectedConversationIndex];
  if (!selectedConversation) {
    conversationViewer.innerHTML = '<p class="insight-empty">Select a conversation to view details.</p>';
    return;
  }

  const orderedChats = selectedConversation.chats
    .map((chat, index) => ({
      chat,
      index,
      parsedDate: typeof chat?.timestamp === 'string' ? parseHingeDate(chat.timestamp) : null,
    }))
    .sort((a, b) => {
      if (a.parsedDate && b.parsedDate) {
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      }
      if (a.parsedDate && !b.parsedDate) return -1;
      if (!a.parsedDate && b.parsedDate) return 1;
      return a.index - b.index;
    });

  const lines = orderedChats.map(({ chat, index, parsedDate }) => {
    const body = typeof chat?.body === 'string' && chat.body.trim().length > 0
      ? chat.body.trim()
      : '(No text)';
    const timeLabel = parsedDate
      ? parsedDate.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
    const speaker = 'You';
    const bubbleClass = 'sent';

    return `
      <article class="chat-line ${bubbleClass}">
        <div class="chat-meta">${speaker}${timeLabel ? ` · ${timeLabel}` : ''}</div>
        <p>${body}</p>
      </article>
    `;
  }).join('');

  conversationViewer.innerHTML = `<div class="chat-thread">${lines}</div>`;
}

function createEmptyStats() {
  return {
    total: 0,
    chatted: 0,
    neverChatted: 0,
    weMet: 0,
    unmatched: 0,
    theyUnmatchedMe: 0,
    ignored: 0,
    ignoredByMe: 0,
    rejected: 0,
    sentMessages: 0,
    receivedMessages: 0,
    likesSent: 0,
    likesReceived: 0,
    sentLikesWithOpener: 0,
    likesSentWithComment: 0,
    likesSentBlank: 0,
    likesReceivedWithComment: 0,
    likesReceivedBlank: 0,
    likesSentMatched: 0,
    likesSentIgnored: 0,
    likesReceivedMatched: 0,
    likesReceivedIgnored: 0,
    likesSentWithCommentMatched: 0,
    likesSentWithCommentIgnored: 0,
    likesSentBlankMatched: 0,
    likesSentBlankIgnored: 0,
    likesReceivedWithCommentMatched: 0,
    likesReceivedWithCommentIgnored: 0,
    likesReceivedBlankMatched: 0,
    likesReceivedBlankIgnored: 0,
    matchedTotal: 0,
    matchedChatted: 0,
    matchedNoChat: 0,
    monthlyMatches: {},
    dayOfWeekCounts: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 },
    hourlyCounts: new Array(24).fill(0),
    conversationLengths: [],
    totalMessages: 0,
    avgMessages: 0,
    maxMessages: 0,
  };
}

// ── Error helpers ─────────────────────────────────────────────────────────────

function showError(message) {
  if (errorMsg) {
    errorMsg.textContent = message;
    errorMsg.classList.remove('hidden');
  }
}

function hideError() {
  if (errorMsg) {
    errorMsg.classList.add('hidden');
    errorMsg.textContent = '';
  }
}
