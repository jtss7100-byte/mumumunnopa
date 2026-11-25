import type {
  EpisodeManuscript,
  EpisodeNarrativeBlueprint,
  SceneDraft,
} from '../types/novelPlanner';

export interface ManuscriptCharCounts {
  withSpaces: number;
  noSpaces: number;
}

export interface KeyLineCheckItem {
  id: string;
  sceneId: string;
  sceneName: string;
  line: string;
  found: boolean;
}

export interface AvoidCheckItem {
  id: string;
  rule: string;
  triggered: boolean;
  reasons: string[];
}

/**
 * Counts characters with spaces (CRLF normalized to LF) and without any whitespace.
 */
export function countManuscriptChars(text: string): ManuscriptCharCounts {
  const normalized = (text ?? '').replace(/\r\n/g, '\n');
  const withSpaces = normalized.length;
  const noSpaces = normalized.replace(/\s+/g, '').length;
  return { withSpaces, noSpaces };
}

/**
 * Computes the target character count for a specific scene based on its line share.
 * Formula: Math.round(targetCharsPerEp * (scene.lines / totalLines))
 */
export function computeSceneTargetChars(
  blueprint: EpisodeNarrativeBlueprint,
  sceneIndex: number,
  targetCharsPerEp = 5000
): number {
  const scenes = blueprint.scenes ?? [];
  const scene = scenes[sceneIndex];
  if (!scene) return 0;

  const safeTarget = Math.max(1000, Math.round(targetCharsPerEp || 5000));
  const totalLines = scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.lines || 0)), 0);
  if (totalLines <= 0) {
    return Math.round(safeTarget / Math.max(1, scenes.length));
  }
  const sceneLines = Math.max(1, Math.round(scene.lines || 0));
  return Math.round(safeTarget * (sceneLines / totalLines));
}

export function createEmptyManuscript(
  episodeNumber: number,
  blueprint?: EpisodeNarrativeBlueprint | null
): EpisodeManuscript {
  return {
    episodeNumber,
    title: blueprint?.title?.trim() || `${episodeNumber}화`,
    sceneDrafts: {},
    customFullText: null,
    styleMemo: '',
    updatedAt: new Date().toISOString(),
  };
}

export function upsertSceneDraft(
  manuscript: EpisodeManuscript,
  sceneId: string,
  sceneName: string,
  text: string,
  summaryLine?: string
): EpisodeManuscript {
  const now = new Date().toISOString();
  const counts = countManuscriptChars(text);
  const existing = manuscript.sceneDrafts[sceneId];
  const nextDraft: SceneDraft = {
    sceneId,
    sceneName,
    text,
    updatedAt: now,
    charCountWithSpaces: counts.withSpaces,
    charCountNoSpaces: counts.noSpaces,
  };
  const nextSummaries = { ...(manuscript.sceneSummaries ?? {}) };
  if (summaryLine && summaryLine.trim()) {
    nextSummaries[sceneId] = summaryLine.trim();
  }
  return {
    ...manuscript,
    sceneDrafts: {
      ...manuscript.sceneDrafts,
      [sceneId]: {
        ...existing,
        ...nextDraft,
      },
    },
    sceneSummaries: nextSummaries,
    // When a scene card is updated directly, sync back to scene-based assembly
    customFullText: null,
    updatedAt: now,
  };
}

/**
 * Joins all scene drafts in blueprint order for reading/export.
 * If the author explicitly edited the unified text (`customFullText`), returns that text.
 */
export function assembleFullManuscriptText(
  blueprint: EpisodeNarrativeBlueprint | null,
  manuscript: EpisodeManuscript | null
): string {
  if (!manuscript) return '';
  if (typeof manuscript.customFullText === 'string') {
    return manuscript.customFullText;
  }
  return joinSceneDraftsText(blueprint, manuscript);
}

/**
 * Always joins scene drafts in scene order, ignoring `customFullText`.
 */
export function joinSceneDraftsText(
  blueprint: EpisodeNarrativeBlueprint | null,
  manuscript: EpisodeManuscript | null
): string {
  if (!manuscript) return '';
  const orderedIds =
    blueprint && blueprint.scenes.length > 0
      ? blueprint.scenes.map((sc, idx) => sc.id || `S${idx + 1}`)
      : Object.keys(manuscript.sceneDrafts).sort();

  const parts: string[] = [];
  for (const id of orderedIds) {
    const draftText = (manuscript.sceneDrafts[id]?.text ?? '').trim();
    if (draftText) {
      parts.push(draftText);
    }
  }
  return parts.join('\n\n');
}

/**
 * Returns the trailing ~1,500 characters from preceding scenes (0 .. sceneIndex - 1)
 * for seamless continuation when generating the current scene.
 */
export function getPreviousScenesContext(
  blueprint: EpisodeNarrativeBlueprint,
  manuscript: EpisodeManuscript | null,
  sceneIndex: number,
  maxChars = 1500
): string {
  if (!manuscript || sceneIndex <= 0) return '';
  const prevParts: string[] = [];
  for (let i = 0; i < sceneIndex; i++) {
    const sc = blueprint.scenes[i];
    if (!sc) continue;
    const sid = sc.id || `S${i + 1}`;
    const txt = (manuscript.sceneDrafts[sid]?.text ?? '').trim();
    if (txt) {
      prevParts.push(txt);
    }
  }
  const combined = prevParts.join('\n\n');
  if (combined.length <= maxChars) return combined;
  return combined.slice(-maxChars).trimStart();
}

/**
 * Normalizes quote marks, ellipses, and whitespace for reliable `key_lines` verification.
 */
export function normalizeTextForKeyLineCheck(text: string): string {
  return (text ?? '')
    .replace(/[“”「」『』]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether every `key_lines` entry across all scenes of the blueprint
 * appears verbatim (after quote/whitespace normalization) in the manuscript text.
 */
export function checkKeyLinesInManuscript(
  blueprint: EpisodeNarrativeBlueprint | null,
  fullText: string
): KeyLineCheckItem[] {
  if (!blueprint) return [];
  const normalizedBody = normalizeTextForKeyLineCheck(fullText);
  const normalizedBodyNoOuterQuotes = normalizedBody.replace(/"/g, '');
  const items: KeyLineCheckItem[] = [];

  blueprint.scenes.forEach((sc, sIdx) => {
    const sceneId = sc.id || `S${sIdx + 1}`;
    (sc.key_lines ?? []).forEach((rawLine, lIdx) => {
      const line = (rawLine ?? '').trim();
      if (!line) return;
      const normLine = normalizeTextForKeyLineCheck(line);
      const normLineNoQuotes = normLine.replace(/^["']|["']$/g, '').trim();
      const found =
        normalizedBody.length > 0 &&
        (normalizedBody.includes(normLine) ||
          (normLineNoQuotes.length >= 4 &&
            (normalizedBody.includes(normLineNoQuotes) ||
              normalizedBodyNoOuterQuotes.includes(normLineNoQuotes.replace(/"/g, '')))));

      items.push({
        id: `${sceneId}-kl-${lIdx}`,
        sceneId,
        sceneName: sc.name,
        line,
        found,
      });
    });
  });

  return items;
}

const AVOID_STOPWORDS = new Set([
  '금지',
  '하지',
  '말것',
  '마라',
  '절대',
  '과도한',
  '불필요한',
  '너무',
  '이상',
  '이하',
  '사용',
  '표현',
  '서술',
  '장면',
  '분량',
  '느낌',
  '전개',
  '문장',
  '지문',
  '대사',
  '방식',
  '위주',
  '중심',
  '세계관',
  '설정',
  '늘어놓지',
  '쓰지',
  '피할',
  '주의',
  '배제',
  '자제',
]);

function extractAvoidKeywords(rule: string): string[] {
  // Prefer quoted tokens if author explicitly wrote e.g. "'크윽' 같은 감탄사 금지"
  const quoted: string[] = [];
  const quoteRegex = /["'“”‘’「」]([^"'“”‘’「」]{2,20})["'“”‘’「」]/g;
  let m: RegExpExecArray | null;
  while ((m = quoteRegex.exec(rule)) !== null) {
    const token = m[1].trim();
    if (token) quoted.push(token);
  }
  if (quoted.length > 0) return Array.from(new Set(quoted));

  const words = rule.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  return Array.from(
    new Set(
      words
        .map((w) =>
          w.replace(
            /(으로|에서|까지|부터|에게|한테|에는|에도|과는|와는|이며|이고|이자|들의|들을|들이|이다|하다|하는|하고|한다|된다|되는|은|는|이|가|을|를|의|에|로|과|와|도|만)$/,
            ''
          )
        )
        .filter((w) => w.length >= 2 && !AVOID_STOPWORDS.has(w))
    )
  );
}

/**
 * Local real-time guardrail checker for blueprint `avoid` items.
 * Detects structural/stylistic violations (excessive ellipses, exclamation spam, long infodump blocks)
 * as well as explicit forbidden keywords mentioned in `avoid`.
 */
export function checkAvoidViolationsInManuscript(
  blueprint: EpisodeNarrativeBlueprint | null,
  fullText: string
): AvoidCheckItem[] {
  if (!blueprint) return [];
  const avoidList = (blueprint.avoid ?? []).map((a) => a.trim()).filter(Boolean);
  if (avoidList.length === 0) return [];

  const text = (fullText ?? '').replace(/\r\n/g, '\n');
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return avoidList.map((rule, idx) => {
    const reasons: string[] = [];

    if (text.trim().length > 0) {
      // Heuristic 1: Ellipsis overuse
      if (/말줄임표|\.\.\.|…/.test(rule)) {
        const ellipsisMatches = text.match(/\.{3,}|…/g) ?? [];
        if (ellipsisMatches.length >= 4) {
          reasons.push(`말줄임표(.../…) ${ellipsisMatches.length}회 감지`);
        }
      }

      // Heuristic 2: Infodump / overly long exposition paragraphs
      if (/설명충|장황|3줄\s*이상|설명을\s*길게|논문|분자식/.test(rule)) {
        const longNarrationCount = paragraphs.filter(
          (p) => !p.startsWith('"') && !p.startsWith('“') && p.length >= 220
        ).length;
        if (longNarrationCount > 0) {
          reasons.push(`긴 설명형 지문 문단(220자 이상) ${longNarrationCount}개 감지`);
        }
      }

      // Heuristic 3: Exclamation mark spam
      if (/느낌표|과장된\s*감탄|라노벨/.test(rule)) {
        const exclCount = (text.match(/!/g) ?? []).length;
        if (exclCount >= 8) {
          reasons.push(`느낌표(!) ${exclCount}회 감지`);
        }
      }

      // Heuristic 4: Direct forbidden keyword hits from avoid text
      const keywords = extractAvoidKeywords(rule);
      const matchedKeywords = keywords.filter((kw) => {
        // Avoid false positives for generic category words already handled by heuristics
        if (['말줄임표', '설명충', '감정', '독백', '느낌표', '라노벨', '부사', '접속사'].includes(kw)) {
          return false;
        }
        return text.includes(kw);
      });

      if (matchedKeywords.length > 0) {
        reasons.push(`금지 키워드 감지: ${matchedKeywords.slice(0, 4).join(', ')}`);
      }
    }

    return {
      id: `avoid-${idx}`,
      rule,
      triggered: reasons.length > 0,
      reasons,
    };
  });
}

/**
 * Formats the manuscript cleanly for Munpia mobile webnovel publishing:
 * strips stray markdown formatting, ensures clean blank-line paragraph breathing.
 */
export function formatMunpiaExportText(
  blueprint: EpisodeNarrativeBlueprint | null,
  manuscript: EpisodeManuscript | null
): string {
  const raw = assembleFullManuscriptText(blueprint, manuscript);
  if (!raw.trim()) return '';

  const cleaned = raw
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n\n');

  return cleaned;
}

/**
 * Builds a concise 1~2 sentence `prev` summary for the next episode from the current
 * episode's generated scene summaries, manuscript text, and blueprint win/ending.
 */
export function buildNextEpisodePrevSummary(
  blueprint: EpisodeNarrativeBlueprint,
  manuscript: EpisodeManuscript | null
): string {
  const summaries: string[] = [];
  if (manuscript?.sceneSummaries) {
    blueprint.scenes.forEach((sc, idx) => {
      const sid = sc.id || `S${idx + 1}`;
      const line = manuscript.sceneSummaries?.[sid]?.trim();
      if (line) summaries.push(line);
    });
  }

  if (summaries.length > 0) {
    const joined = summaries.join(' ');
    return joined.length > 260 ? `${joined.slice(0, 257)}...` : joined;
  }

  const parts: string[] = [];
  if (blueprint.win?.what?.trim()) {
    parts.push(blueprint.win.what.trim());
  }
  if (blueprint.ending?.what?.trim()) {
    parts.push(`직후 ${blueprint.ending.what.trim()}`);
  }

  const fullText = assembleFullManuscriptText(blueprint, manuscript).trim();
  if (parts.length === 0 && fullText) {
    const paragraphs = fullText
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const tail = paragraphs.slice(-2).join(' ');
    return tail.length > 220 ? `${tail.slice(0, 217)}...` : tail;
  }

  const combined = parts.join(' / ');
  return combined || `${blueprint.episode} ${blueprint.title} 직후 이어짐`;
}
