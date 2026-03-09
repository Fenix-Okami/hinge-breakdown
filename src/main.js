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
const statsCards    = document.getElementById('stats-cards');
const sampleNotice  = document.getElementById('sample-notice');
const errorMsg      = document.getElementById('error-message');
const yearFilters   = document.getElementById('year-filters');
const monthFilters  = document.getElementById('month-filters');
const clearDateFiltersBtn = document.getElementById('clear-date-filters');

let sourceData = null;
let selectedYears = new Set();
let selectedMonths = new Set();

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
  selectedMonths = new Set(MONTHS.map(m => m.key));

  renderFilterButtons(years);
  renderFilteredDashboard();

  hideError();

  uploadSection.classList.add('hidden');
  dashboard.classList.remove('hidden');

  if (isSample) {
    sampleNotice.classList.remove('hidden');
  } else {
    sampleNotice.classList.add('hidden');
  }

}

function renderFilteredDashboard() {
  if (!sourceData) return;

  let stats;
  try {
    const filteredData = filterMatches(sourceData, selectedYears, selectedMonths);
    stats = filteredData.length > 0 ? parseMatches(filteredData) : createEmptyStats();
  } catch (err) {
    showError(/** @type {Error} */ (err).message);
    return;
  }

  hideError();
  renderStatsCards(stats);

  const sankeyContainer = document.getElementById('sankey-chart');
  renderSankey(sankeyContainer, stats);

  renderMonthlyChart('monthly-chart', stats.monthlyMatches);
  renderDayOfWeekChart('dayofweek-chart', stats.dayOfWeekCounts);
  renderConvLengthChart('convlength-chart', stats.conversationLengths);
  renderHourlyChart('hourly-chart', stats.hourlyCounts);
}

// ── Stats cards ───────────────────────────────────────────────────────────────

function renderStatsCards(stats) {
  const {
    total,
    chatted,
    neverChatted,
    weMet,
    unmatched,
    theyUnmatchedMe,
    ignored,
    ignoredByMe,
    rejected,
    sentMessages,
    receivedMessages,
    likesSent,
    likesReceived,
    sentLikesWithOpener,
    likesSentWithComment,
    likesSentBlank,
    likesReceivedWithComment,
    likesReceivedBlank,
    avgMessages, maxMessages,
  } = stats;

  const pct = (n, d) =>
    d > 0 ? `${Math.round((n / d) * 100)}%` : '—';

  statsCards.innerHTML = `
    <div class="stat-card">
      <div class="stat-number">${total}</div>
      <div class="stat-label">Total Matches</div>
    </div>

    <div class="stat-card blue">
      <div class="stat-number">${chatted}</div>
      <div class="stat-label">Conversations</div>
      <div class="stat-pct">${pct(chatted, total)} of matches</div>
    </div>

    <div class="stat-card red">
      <div class="stat-number">${rejected}</div>
      <div class="stat-label">Rejected</div>
      <div class="stat-pct">matches removed</div>
    </div>

    <div class="stat-card blue">
      <div class="stat-number">${sentMessages}</div>
      <div class="stat-label">Messages Sent</div>
      <div class="stat-pct">total</div>
    </div>

    <div class="stat-card blue">
      <div class="stat-number">${likesSent}</div>
      <div class="stat-label">Likes Sent</div>
      <div class="stat-pct">initial likes from you</div>
    </div>

    <div class="stat-card green">
      <div class="stat-number">${likesReceived}</div>
      <div class="stat-label">Likes Received</div>
      <div class="stat-pct">initial likes to you</div>
    </div>

    <div class="stat-card amber">
      <div class="stat-number">${sentLikesWithOpener}</div>
      <div class="stat-label">Sent with Opener</div>
      <div class="stat-pct">likes with a message</div>
    </div>

    <div class="stat-card blue">
      <div class="stat-number">${likesSentWithComment}</div>
      <div class="stat-label">Sent: Comment</div>
      <div class="stat-pct">likes with comment</div>
    </div>

    <div class="stat-card blue">
      <div class="stat-number">${likesSentBlank}</div>
      <div class="stat-label">Sent: Blank</div>
      <div class="stat-pct">likes without comment</div>
    </div>

    <div class="stat-card green">
      <div class="stat-number">${likesReceivedWithComment}</div>
      <div class="stat-label">Received: Comment</div>
      <div class="stat-pct">likes with comment</div>
    </div>

    <div class="stat-card green">
      <div class="stat-number">${likesReceivedBlank}</div>
      <div class="stat-label">Received: Blank</div>
      <div class="stat-pct">likes without comment</div>
    </div>

    <div class="stat-card green">
      <div class="stat-number">${receivedMessages}</div>
      <div class="stat-label">Messages Received</div>
      <div class="stat-pct">total</div>
    </div>

    <div class="stat-card gray">
      <div class="stat-number">${ignored}</div>
      <div class="stat-label">Ignored</div>
      <div class="stat-pct">you sent like, no reply</div>
    </div>

    <div class="stat-card amber">
      <div class="stat-number">${ignoredByMe}</div>
      <div class="stat-label">Ignored by You</div>
      <div class="stat-pct">started with remove</div>
    </div>

    <div class="stat-card gray">
      <div class="stat-number">${neverChatted}</div>
      <div class="stat-label">No Messages</div>
      <div class="stat-pct">${pct(neverChatted, total)} of matches</div>
    </div>

    <div class="stat-card green">
      <div class="stat-number">${weMet}</div>
      <div class="stat-label">We Met 🎉</div>
      <div class="stat-pct">${pct(weMet, chatted)} of conversations</div>
    </div>

    <div class="stat-card amber">
      <div class="stat-number">${theyUnmatchedMe}</div>
      <div class="stat-label">They Unmatched Me</div>
      <div class="stat-pct">${pct(theyUnmatchedMe, chatted)} of conversations</div>
    </div>

    <div class="stat-card red">
      <div class="stat-number">${unmatched}</div>
      <div class="stat-label">I Unmatched</div>
      <div class="stat-pct">${pct(unmatched, chatted)} of conversations</div>
    </div>

    <div class="stat-card blue">
      <div class="stat-number">${avgMessages}</div>
      <div class="stat-label">Avg Messages</div>
      <div class="stat-pct">per conversation</div>
    </div>

    <div class="stat-card blue">
      <div class="stat-number">${maxMessages}</div>
      <div class="stat-label">Longest Convo</div>
      <div class="stat-pct">messages</div>
    </div>
  `;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

function resetDashboard() {
  dashboard.classList.add('hidden');
  uploadSection.classList.remove('hidden');
  fileInput.value = '';
  statsCards.innerHTML = '';
  if (yearFilters) yearFilters.innerHTML = '';
  if (monthFilters) monthFilters.innerHTML = '';
  sourceData = null;
  selectedYears = new Set();
  selectedMonths = new Set();
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

  for (const month of MONTHS) {
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
    const monthKey = MONTHS[index].key;
    btn.classList.toggle('active', selectedMonths.has(monthKey));
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

function clearDateFilters() {
  selectedYears.clear();
  selectedMonths.clear();
  const years = sourceData ? getAvailableYears(sourceData) : [];
  refreshFilterUI(years);
  renderFilteredDashboard();
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
