import { Chart, registerables } from 'chart.js';

const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;

    ctx.save();
    ctx.font = "600 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = '#111827';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((barElement, index) => {
        const value = Number(dataset.data[index] || 0);
        if (value <= 0) return;

        const props = barElement.getProps(['x', 'y', 'base', 'height'], true);
        const segmentStart = Math.min(props.x, props.base);
        const segmentEnd = Math.max(props.x, props.base);
        const segmentWidth = segmentEnd - segmentStart;

        const text = `${value}`;
        const textWidth = ctx.measureText(text).width;
        const chipPaddingX = 6;
        const chipPaddingY = 3;
        const chipWidth = textWidth + chipPaddingX * 2;
        const chipHeight = Math.max(14, props.height - 2);

        if (segmentWidth < chipWidth + 6) return;

        const chipX = segmentStart + 4;
        const chipY = props.y - chipHeight / 2;

        roundRect(ctx, chipX, chipY, chipWidth, chipHeight, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fill();
        ctx.strokeStyle = '#4b5563';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#111827';
        ctx.fillText(text, chipX + chipPaddingX, props.y);
      });
    });

    ctx.restore();
  },
};

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

Chart.register(...registerables, valueLabelPlugin);

// ── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  primary:   '#7c3aed',
  blue:      '#3b82f6',
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
 * Renders a stacked horizontal bar chart of likes sent vs matches made per month.
 *
 * @param {string} canvasId
 * @param {Record<string, number>} likesByMonth  YYYY-MM → count
 * @param {Record<string, number>} matchesByMonth  YYYY-MM → count
 */
export function renderMonthlyChart(canvasId, likesByMonth, matchesByMonth) {
  destroyIfExists(canvasId);

  const sortedMonths = Array.from(
    new Set([...Object.keys(likesByMonth), ...Object.keys(matchesByMonth)])
  ).sort();
  const labels = sortedMonths.map(m => {
    const [year, month] = m.split('-');
    return new Date(+year, +month - 1, 1).toLocaleString('default', {
      month: 'short',
    });
  });
  const likesValues = sortedMonths.map(m => likesByMonth[m] || 0);
  const matchesValues = sortedMonths.map(m => matchesByMonth[m] || 0);

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Matches Made',
          data: matchesValues,
          backgroundColor: COLORS.primary,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Likes Sent',
          data: likesValues,
          backgroundColor: COLORS.blue,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: commonStackedHorizontalOptions(),
  });
}

// ── Day of week ───────────────────────────────────────────────────────────────

/**
 * Renders a stacked horizontal bar chart of likes sent vs matches made by day.
 *
 * @param {string} canvasId
 * @param {Record<string, number>} likesByDay
 * @param {Record<string, number>} matchesByDay
 */
export function renderDayOfWeekChart(canvasId, likesByDay, matchesByDay) {
  destroyIfExists(canvasId);

  const days   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const likesValues = days.map(d => likesByDay[d] || 0);
  const matchesValues = days.map(d => matchesByDay[d] || 0);

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [
        {
          label: 'Matches Made',
          data: matchesValues,
          backgroundColor: COLORS.primary,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Likes Sent',
          data: likesValues,
          backgroundColor: COLORS.blue,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: commonStackedHorizontalOptions(),
  });
}

// ── Conversation length distribution ─────────────────────────────────────────

/**
 * Renders a stacked horizontal bar chart of likes sent vs matches made by year.
 *
 * @param {string} canvasId
 * @param {Record<string, number>} likesByYear
 * @param {Record<string, number>} matchesByYear
 */
export function renderConvLengthChart(canvasId, likesByYear, matchesByYear) {
  destroyIfExists(canvasId);

  const years = Array.from(
    new Set([...Object.keys(likesByYear), ...Object.keys(matchesByYear)])
  ).sort();
  const likesValues = years.map(y => likesByYear[y] || 0);
  const matchesValues = years.map(y => matchesByYear[y] || 0);

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Matches Made',
          data: matchesValues,
          backgroundColor: COLORS.primary,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Likes Sent',
          data: likesValues,
          backgroundColor: COLORS.blue,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: commonStackedHorizontalOptions(),
  });
}

// ── Matches by hour ───────────────────────────────────────────────────────────

/**
 * Renders a stacked horizontal bar chart of likes sent vs matches made by hour.
 *
 * @param {string} canvasId
 * @param {number[]} likesHourly  24-element array indexed by hour
 * @param {number[]} matchesHourly  24-element array indexed by hour
 */
export function renderHourlyChart(canvasId, likesHourly, matchesHourly) {
  destroyIfExists(canvasId);

  const labels = Array.from({ length: 24 }, (_, i) => {
    const h = i % 12 || 12;
    const suffix = i < 12 ? 'am' : 'pm';
    return `${h}${suffix}`;
  });

  const ctx = document.getElementById(canvasId);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Matches Made',
          data: matchesHourly,
          backgroundColor: COLORS.primary,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Likes Sent',
          data: likesHourly,
          backgroundColor: COLORS.blue,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: commonStackedHorizontalOptions(),
  });
}

// ── Shared options helper ─────────────────────────────────────────────────────

/**
 * Common Chart.js options for stacked horizontal charts.
 */
function commonStackedHorizontalOptions() {
  return {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.raw}`,
        },
      },
    },
    scales: {
      x: {
        stacked: true,
        beginAtZero: true,
        grid: { color: GRID_COLOR },
        ticks: { display: false },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { font: BASE_FONT },
      },
    },
  };
}
