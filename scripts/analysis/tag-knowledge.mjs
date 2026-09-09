const MAX_TERMS_PER_NOTE = 160;
const MAX_HISTORY_MATCHES = 4;
const MAX_MATCH_TEXT_LENGTH = 2400;
const MAX_MATCH_COMMENT_LENGTH = 900;

const STOP_WORDS = new Set([
  '一个', '一些', '这个', '那个', '这些', '那些', '因为', '所以', '但是', '然后', '还是', '已经',
  '就是', '其实', '可能', '觉得', '感觉', '如果', '没有', '不是', '自己', '我们', '他们', '什么',
  '怎么', '可以', '应该', '比较', '时候', '事情', '今天', '昨天', '现在', '后来', '一下', '这样',
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'just', 'about', 'into', 'then', 'when',
]);

export function cleanTag(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/^#+/, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeTagKey(value) {
  return cleanTag(value).toLocaleLowerCase('zh-CN');
}

export function createEmptyAliasState(userId) {
  return {
    schemaVersion: 1,
    userId,
    updatedAt: Date.now(),
    groups: [],
  };
}

function validAliasGroups(state) {
  return Array.isArray(state?.groups) ? state.groups : [];
}

function groupValues(group) {
  return [group?.canonical, ...(Array.isArray(group?.aliases) ? group.aliases : [])]
    .map(cleanTag)
    .filter(Boolean);
}

export function addConfirmedAlias(state, canonicalInput, aliasInput, now = Date.now()) {
  const canonical = cleanTag(canonicalInput);
  const alias = cleanTag(aliasInput);
  if (!canonical || !alias) throw new Error('标准标签和别名都不能为空。');

  const canonicalKey = normalizeTagKey(canonical);
  const aliasKey = normalizeTagKey(alias);
  if (canonicalKey === aliasKey) return { ...state, updatedAt: now };

  const groups = validAliasGroups(state);
  const matched = groups.filter((group) => {
    const keys = new Set(groupValues(group).map(normalizeTagKey));
    return keys.has(canonicalKey) || keys.has(aliasKey);
  });
  const untouched = groups.filter((group) => !matched.includes(group));
  const values = new Map();

  for (const group of matched) {
    for (const value of groupValues(group)) values.set(normalizeTagKey(value), value);
  }
  values.set(aliasKey, alias);
  values.set(canonicalKey, canonical);
  values.delete(canonicalKey);

  const confirmedAt = matched.reduce(
    (earliest, group) => Math.min(earliest, Number(group.confirmedAt) || now),
    now,
  );
  const nextGroup = {
    canonical,
    aliases: Array.from(values.values()).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    confirmedAt,
    updatedAt: now,
  };

  return {
    schemaVersion: 1,
    userId: state.userId,
    updatedAt: now,
    groups: [...untouched, nextGroup]
      .sort((a, b) => a.canonical.localeCompare(b.canonical, 'zh-CN')),
  };
}

function aliasLookup(state) {
  const lookup = new Map();
  for (const group of validAliasGroups(state)) {
    const canonical = cleanTag(group.canonical);
    if (!canonical) continue;
    for (const value of groupValues(group)) lookup.set(normalizeTagKey(value), canonical);
  }
  return lookup;
}

export function canonicalizeTag(tag, state) {
  const cleaned = cleanTag(tag);
  if (!cleaned) return '';
  return aliasLookup(state).get(normalizeTagKey(cleaned)) ?? cleaned;
}

function normalizeComment(comment) {
  if (!comment || typeof comment !== 'object') return undefined;
  const text = String(comment.text ?? '').trim();
  if (!text) return undefined;
  const createdAt = Number(comment.createdAt ?? comment.created_at);
  return {
    id: String(comment.id ?? ''),
    text,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
  };
}

function normalizeSourceNote(source) {
  const createdAt = Number(source.createdAt ?? source.created_at);
  const updatedAt = Number(source.updatedAt ?? source.updated_at);
  const tags = Array.isArray(source.rawTags)
    ? source.rawTags
    : Array.isArray(source.tags) ? source.tags : [];
  const comments = Array.isArray(source.comments)
    ? source.comments.map(normalizeComment).filter(Boolean)
    : [];

  return {
    id: String(source.id ?? ''),
    text: String(source.text ?? ''),
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    tags: Array.from(new Set(tags.map(cleanTag).filter(Boolean))),
    location: source.location ? String(source.location) : undefined,
    comments,
  };
}

function tokenizer() {
  try {
    return new Intl.Segmenter('zh-CN', { granularity: 'word' });
  } catch {
    return undefined;
  }
}

const WORD_SEGMENTER = tokenizer();

export function tokenizeForHistory(text) {
  const normalized = String(text ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN');
  const terms = new Set();

  if (WORD_SEGMENTER) {
    for (const part of WORD_SEGMENTER.segment(normalized)) {
      if (!part.isWordLike) continue;
      const term = part.segment.trim();
      if (!term || STOP_WORDS.has(term)) continue;
      if (/^[\p{Script=Han}]+$/u.test(term)) {
        if (term.length >= 2) terms.add(term);
      } else if (/^[\p{Letter}\p{Number}]+$/u.test(term) && term.length >= 3) {
        terms.add(term);
      }
      if (terms.size >= MAX_TERMS_PER_NOTE) break;
    }
  } else {
    for (const term of normalized.match(/[\p{Script=Han}]{2,}|[\p{Letter}\p{Number}]{3,}/gu) ?? []) {
      if (!STOP_WORDS.has(term)) terms.add(term);
      if (terms.size >= MAX_TERMS_PER_NOTE) break;
    }
  }

  return Array.from(terms);
}

function canonicalTags(tags, aliases) {
  const byKey = new Map();
  for (const tag of tags) {
    const canonical = canonicalizeTag(tag, aliases);
    if (canonical) byKey.set(normalizeTagKey(canonical), canonical);
  }
  return Array.from(byKey.values());
}

export function buildHistoryIndex(sources, aliases, userId, builtAt = Date.now()) {
  const notes = sources
    .map(normalizeSourceNote)
    .filter((note) => note.id && note.createdAt > 0)
    .map((note) => {
      const combinedText = [note.text, ...note.comments.map((comment) => comment.text)].join('\n');
      return {
        ...note,
        canonicalTags: canonicalTags(note.tags, aliases),
        terms: tokenizeForHistory(combinedText),
      };
    })
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  const tagMap = new Map();
  const relatedMap = new Map();
  const termDocumentFrequency = new Map();

  for (const note of notes) {
    for (const term of new Set(note.terms)) {
      termDocumentFrequency.set(term, (termDocumentFrequency.get(term) ?? 0) + 1);
    }

    for (const tag of note.canonicalTags) {
      const key = normalizeTagKey(tag);
      const current = tagMap.get(key) ?? {
        canonical: tag,
        count: 0,
        firstUsedAt: note.createdAt,
        lastUsedAt: note.createdAt,
        rawVariants: new Set(),
        noteIds: [],
      };
      current.count += 1;
      current.firstUsedAt = Math.min(current.firstUsedAt, note.createdAt);
      current.lastUsedAt = Math.max(current.lastUsedAt, note.createdAt);
      current.noteIds.push(note.id);
      for (const rawTag of note.tags) {
        if (normalizeTagKey(canonicalizeTag(rawTag, aliases)) === key) current.rawVariants.add(rawTag);
      }
      tagMap.set(key, current);
    }

    for (let left = 0; left < note.canonicalTags.length; left += 1) {
      for (let right = left + 1; right < note.canonicalTags.length; right += 1) {
        const a = normalizeTagKey(note.canonicalTags[left]);
        const b = normalizeTagKey(note.canonicalTags[right]);
        if (!relatedMap.has(a)) relatedMap.set(a, new Map());
        if (!relatedMap.has(b)) relatedMap.set(b, new Map());
        relatedMap.get(a).set(b, (relatedMap.get(a).get(b) ?? 0) + 1);
        relatedMap.get(b).set(a, (relatedMap.get(b).get(a) ?? 0) + 1);
      }
    }
  }

  const tags = Array.from(tagMap.entries())
    .map(([key, value]) => ({
      canonical: value.canonical,
      count: value.count,
      firstUsedAt: value.firstUsedAt,
      lastUsedAt: value.lastUsedAt,
      rawVariants: Array.from(value.rawVariants).sort((a, b) => a.localeCompare(b, 'zh-CN')),
      noteIds: value.noteIds,
      related: Array.from(relatedMap.get(key)?.entries() ?? [])
        .map(([relatedKey, count]) => ({
          tag: tagMap.get(relatedKey)?.canonical ?? relatedKey,
          count,
        }))
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'))
        .slice(0, 12),
    }))
    .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt || a.canonical.localeCompare(b.canonical, 'zh-CN'));

  return {
    schemaVersion: 1,
    userId,
    builtAt,
    noteCount: notes.length,
    sourceUpdatedThrough: notes.reduce((latest, note) => Math.max(latest, note.updatedAt), 0),
    aliasesUpdatedAt: Number(aliases?.updatedAt) || 0,
    notes,
    tags,
    termDocumentFrequency: Object.fromEntries(termDocumentFrequency),
  };
}

function truncate(value, limit) {
  const text = String(value ?? '');
  return text.length <= limit
    ? { text, truncated: false }
    : { text: text.slice(0, limit), truncated: true };
}

function findMatches(current, index) {
  const currentTags = new Set(current.canonicalTags.map(normalizeTagKey));
  const currentTerms = new Set(current.terms);
  const noteCount = Math.max(1, Number(index.noteCount) || index.notes.length || 1);
  const tagEntries = new Map((index.tags ?? []).map((tag) => [normalizeTagKey(tag.canonical), tag]));
  const candidates = [];

  for (const historical of index.notes ?? []) {
    if (historical.id === current.id || historical.createdAt >= current.createdAt) continue;

    const historicalTags = new Set((historical.canonicalTags ?? []).map(normalizeTagKey));
    const sharedTags = Array.from(currentTags).filter((tag) => historicalTags.has(tag));
    const sharedTerms = (historical.terms ?? []).filter((term) => currentTerms.has(term));
    const weightedTerms = sharedTerms.reduce((score, term) => {
      const frequency = Number(index.termDocumentFrequency?.[term]) || 1;
      return score + Math.log((noteCount + 1) / (frequency + 1)) + 0.2;
    }, 0);

    let relatedScore = 0;
    const relatedPairs = [];
    for (const currentTag of currentTags) {
      const related = tagEntries.get(currentTag)?.related ?? [];
      for (const relation of related) {
        const relatedKey = normalizeTagKey(relation.tag);
        if (!historicalTags.has(relatedKey) || currentTags.has(relatedKey)) continue;
        relatedScore += Math.min(2.4, Number(relation.count) * 0.4);
        relatedPairs.push(`${tagEntries.get(currentTag)?.canonical ?? currentTag} ↔ ${relation.tag}`);
      }
    }

    const qualifies = sharedTags.length > 0 || (sharedTerms.length >= 2 && weightedTerms >= 1.6);
    if (!qualifies) continue;
    const score = sharedTags.length * 12 + Math.min(weightedTerms, 10) + Math.min(relatedScore, 4);
    const textResult = truncate(historical.text, MAX_MATCH_TEXT_LENGTH);

    candidates.push({
      id: historical.id,
      createdAt: historical.createdAt,
      tags: historical.tags,
      canonicalTags: historical.canonicalTags,
      text: textResult.text,
      textTruncated: textResult.truncated,
      comments: (historical.comments ?? []).map((comment) => ({
        ...comment,
        text: truncate(comment.text, MAX_MATCH_COMMENT_LENGTH).text,
      })),
      score: Number(score.toFixed(3)),
      reasons: [
        ...(sharedTags.length
          ? [`同一主题：${sharedTags.map((key) => `#${tagEntries.get(key)?.canonical ?? key}`).join('、')}`]
          : []),
        ...(sharedTerms.length ? [`共同关键词：${sharedTerms.slice(0, 5).join('、')}`] : []),
        ...(relatedPairs.length ? [`历史标签关联：${Array.from(new Set(relatedPairs)).slice(0, 3).join('、')}`] : []),
      ],
    });
  }

  return candidates
    .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
    .slice(0, MAX_HISTORY_MATCHES);
}

export function buildAnalysisTagKnowledge(rows, aliases, index) {
  const current = rows.map(normalizeSourceNote).map((note) => ({
    ...note,
    canonicalTags: canonicalTags(note.tags, aliases),
    terms: tokenizeForHistory([note.text, ...note.comments.map((comment) => comment.text)].join('\n')),
  }));
  const aliasGroups = validAliasGroups(aliases).map((group) => ({
    canonical: cleanTag(group.canonical),
    aliases: groupValues(group).filter((value) => normalizeTagKey(value) !== normalizeTagKey(group.canonical)),
  }));

  if (!index || !Array.isArray(index.notes)) {
    return {
      schemaVersion: 1,
      indexReady: false,
      aliasGroups,
      currentTags: current.map((note) => ({ id: note.id, tags: note.tags, canonicalTags: note.canonicalTags })),
      historyMatches: [],
    };
  }

  const requestedTagKeys = new Set(current.flatMap((note) => note.canonicalTags.map(normalizeTagKey)));
  const relatedTags = (index.tags ?? [])
    .filter((tag) => requestedTagKeys.has(normalizeTagKey(tag.canonical)))
    .map((tag) => ({ tag: tag.canonical, related: tag.related ?? [] }));

  return {
    schemaVersion: 1,
    indexReady: true,
    indexBuiltAt: index.builtAt,
    indexedNoteCount: index.noteCount,
    aliasGroups,
    currentTags: current.map((note) => ({ id: note.id, tags: note.tags, canonicalTags: note.canonicalTags })),
    relatedTags,
    historyMatches: current.map((note) => ({
      noteId: note.id,
      matches: findMatches(note, index),
    })).filter((item) => item.matches.length > 0),
  };
}
