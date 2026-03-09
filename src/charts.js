import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// ── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  primary:   '#e8234a',
  blue:      '#3b82f6',
  green:     '#10b981',
  amber:     '#f59e0b',
};

const BASE_FONT = {
  family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  size: 12,
};

const GRID_COLOR = 'rgba(0,0,0,0.06)';

/** Keep track of active Chart.js instances so we can destroy before re-rendering. */
const chartInstances = {};

function destroyIfExists(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ── Monthly timeline ─────────────────────────────────────────────────────────

/**
 * Renders a bar chart of matches per calendar month.
 *
 * @param {string} canvasId
 * @param {Record<string, number>} monthlyMatches  YYYY-MM → count
 */
export function renderMonthlyChart(canvasId, monthlyMatches) {
  destroyIfExists(canvasId);

  const sortedMonths = Object.keys(monthlyMatches).sort();
  const labels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    return new Date(+year, +month - 1, 1).toLocaleString('default', {
      month: 'short',
      year: '2-digit',
    });
  });
  const values = sortedMonths.map(m => monthlyMatches[m]);

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Matches',
          data: values,
          backgroundColor: COLORS.primary,
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: commonBarOptions('Matches'),
  });
}

// ── Day of week ───────────────────────────────────────────────────────────────

/**
 * Renders a bar chart of matches by day of the week.
 *
 * @param {string} canvasId
 * @param {Record<string, number>} dayOfWeekCounts
 */
export function renderDayOfWeekChart(canvasId, dayOfWeekCounts) {
  destroyIfExists(canvasId);

  const days   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const values = days.map(d => dayOfWeekCounts[d] || 0);

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Matches',
          data: values,
          backgroundColor: COLORS.blue,
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: commonBarOptions('Matches'),
  });
}

// ── Conversation length distribution ─────────────────────────────────────────

/**
 * Renders a histogram of conversation lengths (message counts).
 *
 * @param {string} canvasId
 * @param {number[]} conversationLengths
 */
export function renderConvLengthChart(canvasId, conversationLengths) {
  destroyIfExists(canvasId);

  const buckets = [
    { label: '1',    min: 1,  max: 1         },
    { label: '2–5',  min: 2,  max: 5         },
    { label: '6–10', min: 6,  max: 10        },
    { label: '11–20', min: 11, max: 20        },
    { label: '21–50', min: 21, max: 50        },
    { label: '51+',  min: 51, max: Infinity  },
  ];

  const counts = buckets.map(b =>
    conversationLengths.filter(v => v >= b.min && v <= b.max).length
  );

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: buckets.map(b => b.label),
      datasets: [
        {
          label: 'Conversations',
          data: counts,
          backgroundColor: COLORS.green,
          borderRadius: 5,
          borderSkipped: false,
        },
      ],
    },
    options: {
      ...commonBarOptions('Conversations'),
      scales: {
        x: {
          title: {
            display: true,
            text: 'Messages exchanged',
            font: BASE_FONT,
            color: '#6b7280',
          },
          grid:  { display: false },
          ticks: { font: BASE_FONT },
        },
        y: {
          beginAtZero: true,
          grid:  { color: GRID_COLOR },
          ticks: { font: BASE_FONT, stepSize: 1 },
        },
      },
    },
  });
}

// ── Matches by hour ───────────────────────────────────────────────────────────

/**
 * Renders a bar chart of matches by hour of the day (0–23).
 *
 * @param {string} canvasId
 * @param {number[]} hourlyCounts  24-element array indexed by hour
 */
export function renderHourlyChart(canvasId, hourlyCounts) {
  destroyIfExists(canvasId);

  const labels = Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 || 12;
    const suffix = i < 12 ? 'am' : 'pm';
    return i % 6 === 0 ? `${h}${suffix}` : '';
  });

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Matches',
          data: hourlyCounts,
          backgroundColor: COLORS.amber,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: commonBarOptions('Matches'),
  });
}

// ── Shared options helper ─────────────────────────────────────────────────────

/**
 * Common Chart.js options for bar charts.
 * @param {string} unit  Label for individual items (used in tooltip)
 */
function commonBarOptions(unit) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.raw} ${unit.toLowerCase()}`,
        },
      },
    },
    scales: {
      x: {
        grid:  { display: false },
        ticks: { font: BASE_FONT, maxRotation: 45 },
      },
      y: {
        beginAtZero: true,
        grid:  { color: GRID_COLOR },
        ticks: { font: BASE_FONT, stepSize: 1 },
      },
    },
  };
}
