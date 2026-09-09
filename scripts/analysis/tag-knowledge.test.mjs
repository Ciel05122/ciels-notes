import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addConfirmedAlias,
  buildAnalysisTagKnowledge,
  buildHistoryIndex,
  canonicalizeTag,
  createEmptyAliasState,
} from './tag-knowledge.mjs';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function row({ id, text, createdAt, tags }) {
  return {
    id,
    text,
    created_at: createdAt,
    updated_at: createdAt,
    tags,
    location: null,
    comments: [],
  };
}

test('confirmed aliases resolve to one canonical tag', () => {
  const aliases = addConfirmedAlias(
    createEmptyAliasState(USER_ID),
    '聊天总结',
    '聊天经验',
    1000,
  );

  assert.equal(canonicalizeTag('聊天经验', aliases), '聊天总结');
  assert.equal(canonicalizeTag('# 聊天总结', aliases), '聊天总结');
  assert.equal(aliases.groups.length, 1);
});

test('history index merges confirmed aliases without changing raw tags', () => {
  const aliases = addConfirmedAlias(createEmptyAliasState(USER_ID), '聊天总结', '聊天经验');
  const index = buildHistoryIndex([
    row({ id: 'old-1', text: '复盘一次对话', createdAt: 1000, tags: ['聊天经验'] }),
    row({ id: 'old-2', text: '继续复盘对话', createdAt: 2000, tags: ['聊天总结'] }),
  ], aliases, USER_ID, 3000);

  assert.equal(index.noteCount, 2);
  assert.equal(index.tags.length, 1);
  assert.equal(index.tags[0].canonical, '聊天总结');
  assert.equal(index.tags[0].count, 2);
  assert.deepEqual(index.notes[0].tags, ['聊天经验']);
});

test('analysis knowledge returns older notes connected by an alias', () => {
  const aliases = addConfirmedAlias(createEmptyAliasState(USER_ID), '聊天总结', '聊天经验');
  const older = row({
    id: 'older-note',
    text: '那次沟通里，我过早假设对方已经理解了背景。',
    createdAt: 1000,
    tags: ['聊天经验'],
  });
  const current = row({
    id: 'current-note',
    text: '这次对话也出现了信息没有确认的问题。',
    createdAt: 2000,
    tags: ['聊天总结'],
  });
  const index = buildHistoryIndex([older, current], aliases, USER_ID, 3000);
  const knowledge = buildAnalysisTagKnowledge([current], aliases, index);

  assert.equal(knowledge.indexReady, true);
  assert.equal(knowledge.currentTags[0].canonicalTags[0], '聊天总结');
  assert.equal(knowledge.historyMatches[0].matches[0].id, 'older-note');
  assert.match(knowledge.historyMatches[0].matches[0].reasons[0], /同一主题/);
});
