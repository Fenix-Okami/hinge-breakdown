import { parseMatches, generateSampleData } from './parser.js';
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

// ── Event listeners ───────────────────────────────────────────────────────────
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
demoBtn.addEventListener('click', loadSampleData);
resetBtn.addEventListener('click', resetDashboard);

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
  let stats;
  try {
    stats = parseMatches(data);
  } catch (err) {
    showError(/** @type {Error} */ (err).message);
    return;
  }

  hideError();

  uploadSection.classList.add('hidden');
  dashboard.classList.remove('hidden');

  if (isSample) {
    sampleNotice.classList.remove('hidden');
  } else {
    sampleNotice.classList.add('hidden');
  }

  renderStatsCards(stats);

  const sankeyContainer = document.getElementById('sankey-chart');
  renderSankey(sankeyContainer, stats);

  renderMonthlyChart('monthly-chart',   stats.monthlyMatches);
  renderDayOfWeekChart('dayofweek-chart', stats.dayOfWeekCounts);
  renderConvLengthChart('convlength-chart', stats.conversationLengths);
  renderHourlyChart('hourly-chart',     stats.hourlyCounts);
}

// ── Stats cards ───────────────────────────────────────────────────────────────

function renderStatsCards(stats) {
  const {
    total, chatted, neverChatted, weMet, unmatched, ongoing,
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

    <div class="stat-card gray">
      <div class="stat-number">${neverChatted}</div>
      <div class="stat-label">Never Messaged</div>
      <div class="stat-pct">${pct(neverChatted, total)} of matches</div>
    </div>

    <div class="stat-card green">
      <div class="stat-number">${weMet}</div>
      <div class="stat-label">We Met 🎉</div>
      <div class="stat-pct">${pct(weMet, chatted)} of conversations</div>
    </div>

    <div class="stat-card amber">
      <div class="stat-number">${ongoing}</div>
      <div class="stat-label">Ongoing 💬</div>
      <div class="stat-pct">${pct(ongoing, chatted)} of conversations</div>
    </div>

    <div class="stat-card red">
      <div class="stat-number">${unmatched}</div>
      <div class="stat-label">Unmatched</div>
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
  const sankeyContainer = document.getElementById('sankey-chart');
  if (sankeyContainer) sankeyContainer.innerHTML = '';
  hideError();
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
