import type { NovelProject } from '../types/novelPlanner';

export interface UnresolvedThreadItem {
  id: string;
  what: string;
  plantedEp: number;
  plantedScene: string;
  plannedPayoff: string;
  plannedPayoffEp: number | null;
  isOverdue: boolean;
}

export interface ResolvedThreadItem {
  what: string;
  plantedEp: number;
  payoffEp: number;
  payoffScene: string;
}

export interface CharacterRelationStep {
  epNum: number;
  from: string;
  to: string;
}

export interface LatestCharacterState {
  who: string;
  role?: string;
  archetypeName?: string;
  initialStatus: string;
  currentStatus: string;
  lastUpdatedEp: number;
  history: CharacterRelationStep[];
}

export interface CumulativeTermItem {
  term: string;
  meaning: string;
  source: '세팅 바이블' | '회차 씬' | '공통';
  episodes: number[];
}

export interface SeriesMemorySnapshot {
  workTitle: string;
  latestEpisodeNumber: number;
  blueprintCount: number;
  coreIrony: string;
  infoGap: string;
  worldRules: string[];
  unresolvedThreads: UnresolvedThreadItem[];
  resolvedThreads: ResolvedThreadItem[];
  overdueThreadCount: number;
  latestCharacterStates: LatestCharacterState[];
  cumulativeTerms: CumulativeTermItem[];
}

function normalizeMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\-_.,!?()[\]"'“”‘’·:;/\\]/g, '')
    .trim();
}

function extractTokens(text: string): string[] {
  const raw = text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  return Array.from(
    new Set(
      raw
        .map((w) =>
          w.replace(
            /(으로|에서|까지|부터|에게|한테|에는|에도|과는|와는|이며|이고|이자|들의|들을|들이|이다|하다|하는|하고|한다|된다|되는|은|는|이|가|을|를|의|에|로|과|와|도|만)$/,
            ''
          )
        )
        .filter((w) => w.length >= 2)
    )
  );
}

/**
 * Extracts a target payoff episode number from freeform Korean strings
 * like "3화 회수", "10~15화", "ep.12", "25화 전환점".
 */
export function parsePlannedPayoffEpisode(toText: string): number | null {
  const trimmed = (toText ?? '').trim();
  if (!trimmed) return null;

  const rangeMatch = trimmed.match(/(\d+)\s*[~-]\s*(\d+)\s*화?/);
  if (rangeMatch) {
    const upper = Number(rangeMatch[2]);
    return Number.isFinite(upper) && upper > 0 ? upper : null;
  }

  const epMatch = trimmed.match(/(?:ep\.?\s*|제\s*)?(\d+)\s*화/i) ?? trimmed.match(/ep\.?\s*(\d+)/i);
  if (epMatch) {
    const num = Number(epMatch[1]);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  return null;
}

function isThreadMatchedByPayoff(plantWhat: string, payoffWhat: string): boolean {
  const normPlant = normalizeMatchText(plantWhat);
  const normPayoff = normalizeMatchText(payoffWhat);
  if (!normPlant || !normPayoff) return false;
  if (normPlant === normPayoff) return true;
  if (normPlant.length >= 4 && (normPayoff.includes(normPlant) || normPlant.includes(normPayoff))) {
    return true;
  }

  const plantTokens = extractTokens(plantWhat);
  const payoffTokens = new Set(extractTokens(payoffWhat));
  if (plantTokens.length >= 2 && payoffTokens.size >= 2) {
    const overlap = plantTokens.filter((t) => payoffTokens.has(t)).length;
    if (overlap >= 2) return true;
  }
  return false;
}

/**
 * Pure aggregation engine that builds the cumulative Series Memory (누적 시리즈 바이블)
 * across Phase 2 (Setting Bible) and all Episode Blueprints (1화 ~ 최신 화).
 */
export function buildSeriesMemory(project: NovelProject): SeriesMemorySnapshot {
  const workTitle =
    project.phase2?.title?.trim() || project.phase0.workingTitle?.trim() || '제목 미정';

  const blueprintEntries = Object.entries(project.blueprints || {})
    .map(([key, bp]) => ({ epNum: Number(key), bp }))
    .filter((entry) => Number.isFinite(entry.epNum) && entry.epNum > 0 && Boolean(entry.bp))
    .sort((a, b) => a.epNum - b.epNum);

  const maxBlueprintEp =
    blueprintEntries.length > 0 ? blueprintEntries[blueprintEntries.length - 1].epNum : 0;
  const maxBlockGuideEp = (project.phase4Blocks ?? []).reduce((max, blk) => {
    const blkMax = (blk.episodes ?? []).reduce((m, row) => Math.max(m, row.episodeNumber || 0), 0);
    return Math.max(max, blkMax);
  }, 0);
  const latestEpisodeNumber = Math.max(maxBlueprintEp, maxBlockGuideEp);

  // 1. Collect all payoff records across all blueprints
  const allPayoffs: Array<{ epNum: number; what: string; scene: string }> = [];
  for (const { epNum, bp } of blueprintEntries) {
    for (const pf of bp.threads?.payoff ?? []) {
      const what = (pf.what ?? '').trim();
      if (!what) continue;
      allPayoffs.push({ epNum, what, scene: (pf.scene ?? '').trim() });
    }
  }

  // 1-b. Classify planted threads into unresolved vs resolved
  const unresolvedThreads: UnresolvedThreadItem[] = [];
  const resolvedThreads: ResolvedThreadItem[] = [];

  for (const { epNum, bp } of blueprintEntries) {
    (bp.threads?.plant ?? []).forEach((pl, idx) => {
      const what = (pl.what ?? '').trim();
      if (!what) return;

      const matchedPayoff = allPayoffs.find(
        (pf) => pf.epNum >= epNum && isThreadMatchedByPayoff(what, pf.what)
      );

      if (matchedPayoff) {
        resolvedThreads.push({
          what,
          plantedEp: epNum,
          payoffEp: matchedPayoff.epNum,
          payoffScene: matchedPayoff.scene,
        });
      } else {
        const plannedPayoff = (pl.to ?? '').trim();
        const plannedPayoffEp = parsePlannedPayoffEpisode(plannedPayoff);
        const isOverdue = plannedPayoffEp !== null && latestEpisodeNumber > plannedPayoffEp;

        unresolvedThreads.push({
          id: `thread-${epNum}-${idx}`,
          what,
          plantedEp: epNum,
          plantedScene: (pl.scene ?? '').trim(),
          plannedPayoff,
          plannedPayoffEp,
          isOverdue,
        });
      }
    });
  }

  // 2. Cumulative Character Relation States (1화 ~ 최신 화 chronological tracking)
  const settingCharLookup = new Map<string, { role: string; archetypeName: string }>();
  for (const ch of project.phase2?.characters ?? []) {
    const cleanName = ch.name.replace(/\([^)]*\)/g, '').trim();
    if (cleanName) {
      settingCharLookup.set(cleanName, {
        role: ch.role,
        archetypeName: ch.archetypeName,
      });
    }
    if (ch.name.trim()) {
      settingCharLookup.set(ch.name.trim(), {
        role: ch.role,
        archetypeName: ch.archetypeName,
      });
    }
  }

  const charStateMap = new Map<string, LatestCharacterState>();
  for (const { epNum, bp } of blueprintEntries) {
    for (const rel of bp.relation ?? []) {
      const who = (rel.who ?? '').trim();
      const from = (rel.from ?? '').trim();
      const to = (rel.to ?? '').trim();
      if (!who || (!from && !to)) continue;

      const existing = charStateMap.get(who);
      const step: CharacterRelationStep = { epNum, from, to };

      if (!existing) {
        const meta =
          settingCharLookup.get(who) ??
          settingCharLookup.get(who.replace(/\([^)]*\)/g, '').trim());
        charStateMap.set(who, {
          who,
          role: meta?.role,
          archetypeName: meta?.archetypeName,
          initialStatus: from || to,
          currentStatus: to || from,
          lastUpdatedEp: epNum,
          history: [step],
        });
      } else {
        existing.history.push(step);
        if (to) existing.currentStatus = to;
        existing.lastUpdatedEp = epNum;
      }
    }
  }

  const latestCharacterStates = Array.from(charStateMap.values()).sort(
    (a, b) => b.lastUpdatedEp - a.lastUpdatedEp
  );

  // 3. Cumulative Glossary Terms (phase2.worldview.terminology + all scenes[].terms)
  const normalizeTermKey = (value: string) =>
    value
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+/g, '')
      .toLowerCase()
      .trim();

  const termMap = new Map<string, CumulativeTermItem>();

  for (const item of project.phase2?.worldview?.terminology ?? []) {
    const term = (item.term ?? '').trim();
    if (!term) continue;
    const key = normalizeTermKey(term) || term.toLowerCase();
    termMap.set(key, {
      term,
      meaning: (item.meaning ?? '').trim(),
      source: '세팅 바이블',
      episodes: [],
    });
  }

  for (const { epNum, bp } of blueprintEntries) {
    for (const sc of bp.scenes ?? []) {
      for (const rawTerm of sc.terms ?? []) {
        const term = (rawTerm ?? '').trim();
        if (!term) continue;
        const key = normalizeTermKey(term) || term.toLowerCase();
        const existing = termMap.get(key);
        if (!existing) {
          termMap.set(key, {
            term,
            meaning: '',
            source: '회차 씬',
            episodes: [epNum],
          });
        } else {
          if (!existing.episodes.includes(epNum)) {
            existing.episodes.push(epNum);
          }
          if (existing.source === '세팅 바이블') {
            existing.source = '공통';
          }
        }
      }
    }
  }

  const cumulativeTerms = Array.from(termMap.values()).sort((a, b) =>
    a.term.localeCompare(b.term, 'ko')
  );

  const worldRules = (project.phase2?.worldview?.coreRules ?? [])
    .map((r) => r.trim())
    .filter(Boolean);

  return {
    workTitle,
    latestEpisodeNumber,
    blueprintCount: blueprintEntries.length,
    coreIrony: project.phase2?.narrativeEngine?.coreIrony?.trim() ?? '',
    infoGap: project.phase2?.narrativeEngine?.infoGap?.trim() ?? '',
    worldRules,
    unresolvedThreads,
    resolvedThreads,
    overdueThreadCount: unresolvedThreads.filter((t) => t.isOverdue).length,
    latestCharacterStates,
    cumulativeTerms,
  };
}

/**
 * Compresses the cumulative Series Memory snapshot into a concise, structured Korean block
 * ready to be injected at the top of Gemini prompts to prevent continuity drift.
 */
export function formatSeriesMemoryPrompt(memory: SeriesMemorySnapshot): string {
  const lines: string[] = [];

  const hasContent =
    memory.worldRules.length > 0 ||
    memory.unresolvedThreads.length > 0 ||
    memory.latestCharacterStates.length > 0 ||
    memory.cumulativeTerms.length > 0 ||
    Boolean(memory.coreIrony) ||
    Boolean(memory.infoGap);

  if (!hasContent) return '';

  lines.push(
    `[작품] ${memory.workTitle} (최신 설계 회차: ${memory.latestEpisodeNumber > 0 ? `${memory.latestEpisodeNumber}화` : '초기 세팅'} · 설계도 ${memory.blueprintCount}화 누적)`
  );

  if (memory.coreIrony || memory.infoGap) {
    lines.push(
      `[핵심 서사 축] 아이러니: ${memory.coreIrony || '미정'} | 정보 낙차: ${memory.infoGap || '미정'}`
    );
  }

  if (memory.worldRules.length > 0) {
    lines.push(`[확정 세계관 규칙]`);
    memory.worldRules.slice(0, 8).forEach((rule, i) => {
      lines.push(`- ${i + 1}. ${rule}`);
    });
  }

  if (memory.latestCharacterStates.length > 0) {
    lines.push(`[인물 최신 관계 상태 (최근 회차 기준)]`);
    memory.latestCharacterStates.slice(0, 12).forEach((st) => {
      const meta = st.role ? `(${st.role})` : '';
      const flow =
        st.initialStatus && st.initialStatus !== st.currentStatus
          ? `${st.initialStatus} → ${st.currentStatus}`
          : st.currentStatus;
      lines.push(`- ${st.who}${meta}: 현재 "${st.currentStatus}" [흐름: ${flow} · ${st.lastUpdatedEp}화 갱신]`);
    });
  }

  if (memory.unresolvedThreads.length > 0) {
    lines.push(`[미회수 복선 장부 (${memory.unresolvedThreads.length}건)]`);
    memory.unresolvedThreads.slice(0, 15).forEach((th) => {
      const overdueTag = th.isOverdue ? ' [회수 기한 경과 - 우선 회수 검토]' : '';
      const targetStr = th.plannedPayoff ? ` (예정: ${th.plannedPayoff})` : '';
      lines.push(`- ${th.plantedEp}화 매설: ${th.what}${targetStr}${overdueTag}`);
    });
  }

  if (memory.cumulativeTerms.length > 0) {
    lines.push(`[확정 고유명사 표기 사전 — 절대 철자/용어 변형 금지]`);
    const formattedTerms = memory.cumulativeTerms.slice(0, 30).map((t) =>
      t.meaning ? `${t.term}(${t.meaning})` : t.term
    );
    lines.push(`- ${formattedTerms.join(', ')}`);
  }

  return lines.join('\n');
}
