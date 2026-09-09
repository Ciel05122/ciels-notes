import { formatInTimeZone } from './lib.mjs';
import {
  ANALYSIS_DATA_DIR,
  loadSession,
  loadState,
  loadTagAliases,
  loadTagHistoryIndex,
} from './private-store.mjs';

const session = await loadSession();
const state = await loadState();
const aliases = session?.userId ? await loadTagAliases(session.userId) : undefined;
const historyIndex = session?.userId ? await loadTagHistoryIndex(session.userId) : undefined;

console.log(JSON.stringify({
  connected: Boolean(session?.accessToken && session?.refreshToken && session?.userId),
  sessionSavedAt: session?.savedAt ? formatInTimeZone(session.savedAt) : null,
  lastSuccessfulAt: state?.lastSuccessfulAt ? formatInTimeZone(state.lastSuccessfulAt) : null,
  pendingRun: state?.pendingRun
    ? {
        id: state.pendingRun.id,
        through: formatInTimeZone(state.pendingRun.through),
        noteCount: state.pendingRun.noteCount,
      }
    : null,
  tagKnowledge: {
    aliasGroupCount: aliases?.groups?.length ?? 0,
    indexedNoteCount: historyIndex?.noteCount ?? 0,
    indexBuiltAt: historyIndex?.builtAt ? formatInTimeZone(historyIndex.builtAt) : null,
  },
  privateDataDirectory: ANALYSIS_DATA_DIR,
}, null, 2));
