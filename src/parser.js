/**
 * Parses raw Hinge matches.json data and extracts statistics.
 *
 * Hinge exports matches.json as an array where each entry represents a
 * mutual match. Each entry may contain:
 *   - match  : [{comment, timestamp}]  – when the match happened
 *   - like   : [{comment, timestamp}]  – alternative key used in some exports
 *   - chats  : [{body, timestamp}]     – messages exchanged
 *   - we_met : [{body, timestamp}]     – "We Met" feedback
 *   - block  : [{block_type, timestamp}] – unmatched / removed
 *
 * @param {unknown} data – parsed JSON value from matches.json
 * @returns {object} Computed statistics object
 */
export function parseMatches(data) {
  if (!Array.isArray(data)) {
    throw new Error(
      'Invalid format: expected a JSON array. Make sure you uploaded matches.json from your Hinge data export.'
    );
  }

  if (data.length === 0) {
    throw new Error(
      'The matches array is empty. There are no matches to analyse.'
    );
  }

  const total = data.length;

  let chatted = 0;
  let neverChatted = 0;
  let weMet = 0;
  let unmatched = 0;
  let ongoing = 0;

  /** @type {Record<string, number>} YYYY-MM → count */
  const monthlyMatches = {};

  /** @type {Record<string, number>} */
  const dayOfWeekCounts = {
    Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0,
  };

  /** @type {number[]} 0-23 */
  const hourlyCounts = new Array(24).fill(0);

  /** @type {number[]} message count per chatted conversation */
  const conversationLengths = [];

  let totalMessages = 0;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (const match of data) {
    // Timestamp comes from "match" or "like" array (both appear in the wild)
    const initEvent = (match.match || match.like || [])[0];
    if (initEvent?.timestamp) {
      const date = parseHingeDate(initEvent.timestamp);
      if (date) {
        const monthKey =
          `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyMatches[monthKey] = (monthlyMatches[monthKey] || 0) + 1;
        dayOfWeekCounts[DAY_NAMES[date.getDay()]]++;
        hourlyCounts[date.getHours()]++;
      }
    }

    const chats = match.chats || [];
    const msgCount = chats.length;
    totalMessages += msgCount;

    const hasChatted = msgCount > 0;
    const hasWeMet = (match.we_met || []).length > 0;
    const hasBlock = (match.block || []).length > 0;

    if (hasChatted) {
      chatted++;
      conversationLengths.push(msgCount);
    } else {
      neverChatted++;
    }

    // Determine outcome (we_met takes priority, then block, then ongoing)
    if (hasWeMet) {
      weMet++;
    } else if (hasBlock && hasChatted) {
      unmatched++;
    } else if (hasChatted) {
      ongoing++;
    }
  }

  return {
    total,
    chatted,
    neverChatted,
    weMet,
    unmatched,
    ongoing,
    monthlyMatches,
    dayOfWeekCounts,
    hourlyCounts,
    conversationLengths,
    totalMessages,
    avgMessages:
      chatted > 0
        ? Math.round((totalMessages / chatted) * 10) / 10
        : 0,
    maxMessages:
      conversationLengths.length > 0
        ? Math.max(...conversationLengths)
        : 0,
  };
}

/**
 * Parse Hinge's timestamp format "2021-03-15 14:23:11.000000+00:00"
 * as well as standard ISO 8601 strings.
 *
 * @param {string} timestamp
 * @returns {Date|null}
 */
function parseHingeDate(timestamp) {
  if (!timestamp) return null;
  try {
    // Replace the space separator with T so Date.parse handles it correctly
    const normalized = String(timestamp).replace(' ', 'T');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Generates a realistic synthetic matches dataset for the demo mode.
 *
 * @returns {object[]} Array of match objects compatible with parseMatches()
 */
export function generateSampleData() {
  const now = Date.now();
  const matches = [];

  for (let i = 0; i < 120; i++) {
    // Spread matches over the past ~18 months with a slight recent-skew
    const daysAgo = Math.floor(Math.random() ** 0.7 * 550);
    const matchDate = new Date(now - daysAgo * 86_400_000);
    // Randomise time of day with a slight evening bias (people use dating apps at night)
    const hour = Math.random() < 0.55
      ? 17 + Math.floor(Math.random() * 7)   // 17–23  (~55 %)
      : Math.floor(Math.random() * 17);       //  0–16  (~45 %)
    matchDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
    const ts = toHingeTimestamp(matchDate);

    const entry = {
      match: [{ comment: '', timestamp: ts }],
      chats: [],
    };

    // ~72 % have a conversation
    if (Math.random() < 0.72) {
      // Power-law distribution: most conversations are short
      const msgCount = Math.max(1, Math.round(Math.random() ** 1.6 * 80));
      for (let j = 0; j < msgCount; j++) {
        entry.chats.push({
          body: `Message ${j + 1}`,
          timestamp: toHingeTimestamp(
            new Date(matchDate.getTime() + j * 3_600_000)
          ),
        });
      }

      const roll = Math.random();
      if (roll < 0.22) {
        // ~22 % of chatted → We Met
        entry.we_met = [
          {
            body: 'Yes',
            timestamp: toHingeTimestamp(
              new Date(matchDate.getTime() + 10 * 86_400_000)
            ),
          },
        ];
      } else if (roll < 0.50) {
        // ~28 % of chatted → Unmatched
        entry.block = [
          {
            block_type: 'Removed',
            timestamp: toHingeTimestamp(
              new Date(matchDate.getTime() + 5 * 86_400_000)
            ),
          },
        ];
      }
      // remaining ~50 % → Ongoing
    }

    matches.push(entry);
  }

  return matches;
}

/** @param {Date} date @returns {string} */
function toHingeTimestamp(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '+00:00');
}
