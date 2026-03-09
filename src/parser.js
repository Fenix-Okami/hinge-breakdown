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
  let theyUnmatchedMe = 0;
  let ignored = 0;
  let ignoredByMe = 0;
  let rejected = 0;
  let sentMessages = 0;
  let receivedMessages = 0;
  let likesSent = 0;
  let likesReceived = 0;
  let sentLikesWithOpener = 0;
  let likesSentWithComment = 0;
  let likesSentBlank = 0;
  let likesReceivedWithComment = 0;
  let likesReceivedBlank = 0;
  let likesSentMatched = 0;
  let likesSentIgnored = 0;
  let likesReceivedMatched = 0;
  let likesReceivedIgnored = 0;
  let likesSentWithCommentMatched = 0;
  let likesSentWithCommentIgnored = 0;
  let likesSentBlankMatched = 0;
  let likesSentBlankIgnored = 0;
  let likesReceivedWithCommentMatched = 0;
  let likesReceivedWithCommentIgnored = 0;
  let likesReceivedBlankMatched = 0;
  let likesReceivedBlankIgnored = 0;
  let matchedTotal = 0;
  let matchedChatted = 0;
  let matchedNoChat = 0;

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
    const initEvent = (match.match || match.like || [])[0];
    const anchorDate = getMatchAnchorDate(match);
    if (anchorDate) {
      const monthKey =
        `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, '0')}`;
      monthlyMatches[monthKey] = (monthlyMatches[monthKey] || 0) + 1;
      dayOfWeekCounts[DAY_NAMES[anchorDate.getDay()]]++;
      hourlyCounts[anchorDate.getHours()]++;
    }

    const hasLike = Array.isArray(match.like) && match.like.length > 0;
    const hasMatch = Array.isArray(match.match) && match.match.length > 0;
    const isLikeOnly = hasLike && !hasMatch;
    const likeComment = getLikeComment(match);
    const receivedLikeComment = getReceivedLikeComment(match);
    const sentHasComment = hasCommentText(likeComment);
    const receivedHasComment = hasCommentText(receivedLikeComment);

    if (hasLike) {
      likesSent++;
      if (sentHasComment) {
        likesSentWithComment++;
      } else {
        likesSentBlank++;
      }

      if (hasOpener(likeComment)) {
        sentLikesWithOpener++;
      }

      if (hasMatch) {
        likesSentMatched++;
        if (sentHasComment) {
          likesSentWithCommentMatched++;
        } else {
          likesSentBlankMatched++;
        }
      } else {
        likesSentIgnored++;
        if (sentHasComment) {
          likesSentWithCommentIgnored++;
        } else {
          likesSentBlankIgnored++;
        }
      }
    } else {
      likesReceived++;
      if (receivedHasComment) {
        likesReceivedWithComment++;
      } else {
        likesReceivedBlank++;
      }

      if (hasMatch) {
        likesReceivedMatched++;
        if (receivedHasComment) {
          likesReceivedWithCommentMatched++;
        } else {
          likesReceivedBlankMatched++;
        }
      } else {
        likesReceivedIgnored++;
        if (receivedHasComment) {
          likesReceivedWithCommentIgnored++;
        } else {
          likesReceivedBlankIgnored++;
        }
      }
    }

    const chats = match.chats || [];
    const msgCount = chats.length;
    totalMessages += msgCount;

    for (let i = 0; i < chats.length; i++) {
      const direction = getMessageDirection(chats[i], i);
      if (direction === 'sent') {
        sentMessages++;
      } else {
        receivedMessages++;
      }
    }

    const hasChatted = msgCount > 0;
    const hasWeMet = (match.we_met || []).length > 0;
    const hasBlock = (match.block || []).length > 0;

    if (hasMatch) {
      matchedTotal++;
      if (hasChatted) {
        matchedChatted++;
      } else {
        matchedNoChat++;
      }
    }

    if (hasChatted) {
      chatted++;
      conversationLengths.push(msgCount);
    } else {
      if (isLikeOnly) {
        if (startsWithRemove(likeComment)) {
          ignoredByMe++;
        } else {
          ignored++;
        }
      } else {
        neverChatted++;
      }
    }

    // Determine outcome (we_met takes priority, then block, then ongoing)
    if (hasBlock) {
      rejected++;
    }

    if (hasWeMet) {
      weMet++;
    } else if (hasBlock && hasChatted) {
      unmatched++;
    } else if (hasChatted) {
      theyUnmatchedMe++;
    }
  }

  return {
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
    likesSentMatched,
    likesSentIgnored,
    likesReceivedMatched,
    likesReceivedIgnored,
    likesSentWithCommentMatched,
    likesSentWithCommentIgnored,
    likesSentBlankMatched,
    likesSentBlankIgnored,
    likesReceivedWithCommentMatched,
    likesReceivedWithCommentIgnored,
    likesReceivedBlankMatched,
    likesReceivedBlankIgnored,
    matchedTotal,
    matchedChatted,
    matchedNoChat,
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
 * @param {unknown} value
 * @returns {boolean}
 */
function startsWithRemove(value) {
  return typeof value === 'string' && value.trim().toLowerCase().startsWith('remove');
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function hasOpener(value) {
  return typeof value === 'string' && value.trim().length > 0 && !startsWithRemove(value);
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function hasCommentText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Extract comment text from Hinge like payload.
 * Some exports store it at like[0].like[0].comment.
 *
 * @param {Record<string, unknown>} match
 * @returns {string}
 */
function getLikeComment(match) {
  const outerLike = Array.isArray(match.like) ? match.like[0] : null;
  if (!outerLike || typeof outerLike !== 'object') return '';

  if (typeof outerLike.comment === 'string') {
    return outerLike.comment;
  }

  const nestedLike = Array.isArray(outerLike.like) ? outerLike.like[0] : null;
  if (nestedLike && typeof nestedLike === 'object' && typeof nestedLike.comment === 'string') {
    return nestedLike.comment;
  }

  return '';
}

/**
 * Extract comment text from received-like payload when present.
 *
 * @param {Record<string, unknown>} match
 * @returns {string}
 */
function getReceivedLikeComment(match) {
  const matchEntry = Array.isArray(match.match) ? match.match[0] : null;
  if (!matchEntry || typeof matchEntry !== 'object') return '';

  if (typeof matchEntry.comment === 'string') {
    return matchEntry.comment;
  }

  const nestedMatch = Array.isArray(matchEntry.match) ? matchEntry.match[0] : null;
  if (nestedMatch && typeof nestedMatch === 'object' && typeof nestedMatch.comment === 'string') {
    return nestedMatch.comment;
  }

  return '';
}

/**
 * Best-effort detection for who initiated the like.
 *
 * @param {Record<string, unknown> | undefined} initEvent
 * @param {Record<string, unknown>} match
 * @returns {'sent' | 'received' | 'unknown'}
 */
function getLikeDirection(initEvent, match) {
  const event = initEvent && typeof initEvent === 'object' ? initEvent : {};

  const booleanKeys = ['is_sender', 'is_me', 'from_me', 'sent_by_me'];
  for (const key of booleanKeys) {
    if (typeof event[key] === 'boolean') {
      return event[key] ? 'sent' : 'received';
    }
  }

  const stringKeys = ['sender', 'from', 'author', 'participant', 'direction', 'like_type'];
  for (const key of stringKeys) {
    if (typeof event[key] === 'string') {
      const value = event[key].toLowerCase();
      if (
        value.includes('sent') ||
        value.includes('outbound') ||
        value.includes('me') ||
        value.includes('self') ||
        value.includes('you')
      ) {
        return 'sent';
      }
      if (
        value.includes('received') ||
        value.includes('inbound') ||
        value.includes('them') ||
        value.includes('other') ||
        value.includes('match')
      ) {
        return 'received';
      }
    }
  }

  if (startsWithRemove(event.comment)) {
    return 'received';
  }

  if (Array.isArray(match.like) && match.like.length > 0 && !(Array.isArray(match.match) && match.match.length > 0)) {
    return 'sent';
  }

  return 'unknown';
}

/**
 * Parse Hinge's timestamp format "2021-03-15 14:23:11.000000+00:00"
 * as well as standard ISO 8601 strings.
 *
 * @param {string} timestamp
 * @returns {Date|null}
 */
export function parseHingeDate(timestamp) {
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
 * Returns the best available date for a record so filters/charts include
 * records that only have remove/block events.
 *
 * @param {Record<string, unknown>} match
 * @returns {Date|null}
 */
export function getMatchAnchorDate(match) {
  const timestamp =
    getTimestampFromArray(match.match) ||
    getTimestampFromArray(match.like) ||
    getTimestampFromArray(match.block) ||
    getTimestampFromArray(match.chats);

  return parseHingeDate(timestamp);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function getTimestampFromArray(value) {
  if (!Array.isArray(value) || value.length === 0) return '';
  const first = value[0];
  if (!first || typeof first !== 'object') return '';
  return typeof first.timestamp === 'string' ? first.timestamp : '';
}

/**
 * Best-effort message direction detection from Hinge export fields.
 * Falls back to alternating direction when not explicitly present.
 *
 * @param {Record<string, unknown>} chat
 * @param {number} index
 * @returns {'sent' | 'received'}
 */
function getMessageDirection(chat, index) {
  if (!chat || typeof chat !== 'object') {
    return index % 2 === 0 ? 'received' : 'sent';
  }

  const booleanKeys = ['is_sender', 'is_me', 'from_me', 'sent_by_me'];
  for (const key of booleanKeys) {
    if (typeof chat[key] === 'boolean') {
      return chat[key] ? 'sent' : 'received';
    }
  }

  const stringKeys = ['sender', 'from', 'author', 'participant'];
  for (const key of stringKeys) {
    if (typeof chat[key] === 'string') {
      const value = chat[key].toLowerCase();
      if (value.includes('me') || value.includes('self') || value.includes('you')) {
        return 'sent';
      }
      if (
        value.includes('them') ||
        value.includes('match') ||
        value.includes('other') ||
        value.includes('partner')
      ) {
        return 'received';
      }
    }
  }

  return index % 2 === 0 ? 'received' : 'sent';
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
      // remaining ~50 % → They unmatched me (in this app's interpretation)
    }

    matches.push(entry);
  }

  return matches;
}

/** @param {Date} date @returns {string} */
function toHingeTimestamp(date) {
  return date.toISOString().replace('T', ' ').replace('Z', '+00:00');
}
