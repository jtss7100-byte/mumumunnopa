import { CHARACTER_ARCHETYPES } from '../data/munpiaReferences';
import type {
  ArcPlan,
  BrainDumpAuditFlag,
  BrainDumpAuditMissingItem,
  BrainDumpAuditResult,
  BrainDumpAuditStatus,
  BrainDumpFlagIssueType,
  BrainDumpMissingCategory,
  BrainDumpParseResult,
  BrainDumpReport,
  CharacterCard,
  EpisodeBlockGuide,
  EpisodeNarrativeBlueprint,
  NovelProject,
  SettingBible,
} from '../types/novelPlanner';
import { syncBlueprintSceneNames } from './munpiaEngine';

export interface BrainDumpGuideChip {
  id: string;
  label: string;
  snippet: string;
}

export const BRAIN_DUMP_GUIDE_CHIPS: BrainDumpGuideChip[] = [
  {
    id: 'protagonist',
    label: '+ 주인공/능력 메모',
    snippet:
      '\n\n--- [주인공 / 핵심 능력 · 성격 낙차] ---\n이름·처지: \n겉 성격 vs 속 성격: \n핵심 무기·능력(정보 낙차): \n',
  },
  {
    id: 'relations',
    label: '+ 조연/빌런 관계',
    snippet:
      '\n\n--- [주요 조연(메인 서브1) / 중간 빌런 관계] ---\n조연 이름·역할 (처음 태도 → 나중 태도): \n빌런 이름·목적 (주인공과 충돌 지점): \n',
  },
  {
    id: 'ep1',
    label: '+ 1화 도입/사이다 장면',
    snippet:
      '\n\n--- [1화 도입 / 첫 사이다 & 직필 명대사] ---\n1화 시작 위기: \n통쾌한 돌파 장면: \n직필 대사 예시: "여기에 꼭 쓰고 싶은 원문 대사를 큰따옴표로 적어두세요."\n',
  },
  {
    id: 'ep25',
    label: '+ 25화 핵심 사건',
    snippet:
      '\n\n--- [1권(25화) 클라이맥스 & 유료 전환 훅] ---\n11~15화 전환점(투베 피크): \n21~25화 빌런 격파 & 보상 공개 후 다음 행동 절단신공: \n',
  },
];

/**
 * Inserts a guide snippet at the current cursor/selection range in the Brain Dump textarea.
 */
export function insertSnippetAtCursor(
  currentText: string,
  selectionStart: number,
  selectionEnd: number,
  snippet: string
): { nextText: string; nextCursorPos: number } {
  const safeStart = Math.max(0, Math.min(selectionStart, currentText.length));
  const safeEnd = Math.max(safeStart, Math.min(selectionEnd, currentText.length));
  const before = currentText.slice(0, safeStart);
  const after = currentText.slice(safeEnd);

  const normalizedSnippet = before.trim().length === 0 ? snippet.replace(/^\n+/, '') : snippet;
  const nextText = `${before}${normalizedSnippet}${after}`;
  const nextCursorPos = before.length + normalizedSnippet.length;
  return { nextText, nextCursorPos };
}

/**
 * Extracts verbatim quoted dialogue/monologue lines ("..." or “...”) written by the author
 * so AI parsing preserves them unmodified inside `scenes[].key_lines`.
 */
export function extractQuotedLines(memo: string): string[] {
  const found: string[] = [];
  const regex = /"([^"\n]{3,160})"|“([^”\n]{3,160})”/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(memo)) !== null) {
    const inner = (match[1] ?? match[2] ?? '').trim();
    if (!inner) continue;
    // Ignore untouched template placeholder line
    if (inner.includes('여기에 꼭 쓰고 싶은 원문 대사를')) continue;
    const quoted = `"${inner}"`;
    if (!found.includes(quoted)) {
      found.push(quoted);
    }
  }
  return found;
}

/**
 * Ensures character archetype numbers & names strictly match the built-in 18 Munpia archetypes.
 */
function normalizeCharacters(characters: CharacterCard[]): CharacterCard[] {
  return characters.map((char, idx) => {
    const validNum =
      typeof char.archetypeNumber === 'number' &&
      char.archetypeNumber >= 1 &&
      char.archetypeNumber <= 18
        ? Math.round(char.archetypeNumber)
        : char.role === '주인공'
          ? 7
          : char.role === '빌런'
            ? 15
            : 9;
    const preset = CHARACTER_ARCHETYPES.find((a) => a.number === validNum) ?? CHARACTER_ARCHETYPES[6];
    return {
      ...char,
      id: char.id?.trim() ? char.id.trim() : `char-bd-${idx + 1}`,
      archetypeNumber: preset.number,
      archetypeName: preset.name,
    };
  });
}

/**
 * Ensures any verbatim writer quotes from the memo that weren't already placed in a blueprint's
 * `key_lines` get preserved intact in the first blueprint's climax/relevant scene.
 */
function ensureVerbatimQuotesInBlueprints(
  blueprints: Record<number, EpisodeNarrativeBlueprint>,
  memoQuotes: string[]
): { blueprints: Record<number, EpisodeNarrativeBlueprint>; totalKeyLines: number } {
  const epNums = Object.keys(blueprints)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  if (epNums.length === 0) {
    return { blueprints, totalKeyLines: 0 };
  }

  const nextMap: Record<number, EpisodeNarrativeBlueprint> = { ...blueprints };
  const existingLines = new Set<string>();
  for (const epNum of epNums) {
    for (const sc of nextMap[epNum].scenes) {
      for (const line of sc.key_lines ?? []) {
        existingLines.add(line.replace(/["“”]/g, '').trim());
      }
    }
  }

  const missingQuotes = memoQuotes.filter(
    (q) => !existingLines.has(q.replace(/["“”]/g, '').trim())
  );

  if (missingQuotes.length > 0) {
    const firstEp = epNums[0];
    const targetBp = structuredClone(nextMap[firstEp]);
    if (targetBp.scenes.length > 0) {
      const targetSceneIdx = Math.min(2, targetBp.scenes.length - 1);
      const sc = targetBp.scenes[targetSceneIdx];
      sc.key_lines = [...(sc.key_lines ?? []), ...missingQuotes];
      nextMap[firstEp] = targetBp;
    }
  }

  let totalKeyLines = 0;
  for (const epNum of epNums) {
    for (const sc of nextMap[epNum].scenes) {
      totalKeyLines += (sc.key_lines ?? []).filter((l) => l.trim().length > 0).length;
    }
  }

  return { blueprints: nextMap, totalKeyLines };
}

/**
 * Maps symbolic inferred field tokens (e.g. "char.0.archetype") onto concrete character IDs
 * so Phase 2/3/4 UI badges match reliably even after character reordering or edits.
 */
function resolveEstimatedFields(
  rawInferred: string[],
  characters: CharacterCard[],
  epNums: number[]
): string[] {
  const resolved = new Set<string>();
  for (const token of rawInferred) {
    const clean = token.trim();
    if (!clean) continue;
    const charMatch = clean.match(/^char\.(\d+)\.(archetype|personality|relation)$/);
    if (charMatch) {
      const idx = Number(charMatch[1]);
      const char = characters[idx];
      if (char) {
        resolved.add(`char.${char.id}.${charMatch[2]}`);
      }
      continue;
    }
    resolved.add(clean);
  }

  // Ensure sensible fallback badges if AI returned an empty list on sparse memos
  if (resolved.size === 0 && epNums.length > 0) {
    resolved.add('arc.block.4.cliffhanger');
  }
  return Array.from(resolved);
}

/**
 * Removes a single field key from `aiEstimatedFields` when the writer edits that field.
 */
export function clearEstimatedField(
  fields: string[] | undefined,
  fieldKey: string
): string[] {
  if (!fields || fields.length === 0) return [];
  return fields.filter((k) => k !== fieldKey);
}

/**
 * Creates a brand-new NovelProject populated across Phase 0~4 from a BrainDumpParseResult.
 */
export function buildProjectFromBrainDump(
  memo: string,
  result: BrainDumpParseResult
): NovelProject {
  const targetChars = result.phase2?.basicInfo?.targetCharsPerEp || 5000;
  const normalizedChars = normalizeCharacters(result.phase2?.characters ?? []);
  const phase2: SettingBible = {
    ...result.phase2,
    characters: normalizedChars,
    confirmed: false,
  };

  const phase3: ArcPlan = {
    ...result.phase3,
    confirmed: false,
  };

  const rawBlueprintMap: Record<number, EpisodeNarrativeBlueprint> = {};
  for (const item of result.blueprints ?? []) {
    const epNum = Math.max(1, Math.round(item.episodeNumber || 1));
    const enriched: EpisodeNarrativeBlueprint = {
      ...item.blueprint,
      prose_tone: item.blueprint.prose_tone?.trim() || result.proseTone || '',
      info_gap: item.blueprint.info_gap?.trim() || phase2.narrativeEngine.infoGap || '',
      avoid:
        item.blueprint.avoid && item.blueprint.avoid.length > 0
          ? item.blueprint.avoid
          : result.avoid ?? [],
    };
    rawBlueprintMap[epNum] = syncBlueprintSceneNames(enriched, targetChars);
  }

  const memoQuotes = extractQuotedLines(memo);
  const { blueprints, totalKeyLines } = ensureVerbatimQuotesInBlueprints(
    rawBlueprintMap,
    memoQuotes
  );
  const epNums = Object.keys(blueprints)
    .map(Number)
    .sort((a, b) => a - b);

  const aiEstimatedFields = resolveEstimatedFields(
    result.inferredFields ?? [],
    normalizedChars,
    epNums
  );

  const workingTitle =
    result.workingTitle?.trim() || phase2.title?.trim() || '신규 아이디어 연재 기획';

  const report: BrainDumpReport = {
    mode: 'new',
    parsedAt: new Date().toISOString(),
    workingTitle,
    settingReady: Boolean(phase2.title),
    characterCount: normalizedChars.length,
    arcBlockCount: phase3.blocks?.length ?? 0,
    kickEventCount: phase3.kickEvents?.length ?? 0,
    blueprintEpisodes: epNums,
    quotedKeyLinesCount: totalKeyLines,
    estimatedFieldCount: aiEstimatedFields.length,
  };

  return {
    id: `proj-bd-${Date.now()}`,
    updatedAt: new Date().toISOString(),
    currentPhase: 'dump',
    brainDumpText: memo,
    aiEstimatedFields,
    lastBrainDumpReport: report,
    phase0: {
      workingTitle,
      rawIdeaOrPrologue: memo,
      selectedGenres:
        result.genres?.length > 0 ? result.genres : phase2.basicInfo.genres ?? ['현대 판타지(현판)'],
      selectedKeywords:
        result.keywords?.length > 0 ? result.keywords : phase2.basicInfo.keywords ?? [],
      selectedHookPatternId: 'regression-A',
      targetVolumePlan:
        result.targetVolumePlan === '200화 단축형 (8권)'
          ? '200화 단축형 (8권)'
          : '500화 표준 3막 (20권)',
      authorNotes: (result.avoid ?? []).join(' / '),
    },
    phase1: { ...result.phase1, confirmed: false },
    phase2,
    phase3,
    phase4Blocks: Array.isArray(result.phase4Blocks) ? result.phase4Blocks : [],
    blueprints,
  };
}

/**
 * Non-destructively merges newly parsed Brain Dump content into an existing NovelProject,
 * preserving writer-edited settings/characters while appending new characters, kick events,
 * rules, terms, and episode blueprints.
 */
export function mergeBrainDumpIntoProject(
  existing: NovelProject,
  memo: string,
  result: BrainDumpParseResult
): NovelProject {
  const targetChars =
    existing.phase2?.basicInfo.targetCharsPerEp ||
    result.phase2?.basicInfo.targetCharsPerEp ||
    5000;

  // 1. Merge Phase 2 (preserve existing edits, append new characters/rules/terms)
  const incomingChars = normalizeCharacters(result.phase2?.characters ?? []);
  let mergedPhase2: SettingBible;
  let addedCharCount = 0;

  if (!existing.phase2) {
    mergedPhase2 = { ...result.phase2, characters: incomingChars, confirmed: false };
    addedCharCount = incomingChars.length;
  } else {
    const existingCharNames = new Set(
      existing.phase2.characters.map((c) => c.name.replace(/\([^)]*\)/g, '').trim())
    );
    const newChars = incomingChars.filter((c) => {
      const clean = c.name.replace(/\([^)]*\)/g, '').trim();
      return clean.length > 0 && !existingCharNames.has(clean);
    });
    addedCharCount = newChars.length;

    const existingRules = new Set(existing.phase2.worldview.coreRules.map((r) => r.trim()));
    const newRules = (result.phase2?.worldview?.coreRules ?? []).filter(
      (r) => r.trim() && !existingRules.has(r.trim())
    );

    const existingTerms = new Set(
      existing.phase2.worldview.terminology.map((t) => t.term.trim())
    );
    const newTerms = (result.phase2?.worldview?.terminology ?? []).filter(
      (t) => t.term.trim() && !existingTerms.has(t.term.trim())
    );

    mergedPhase2 = {
      ...existing.phase2,
      title: existing.phase2.title.trim() || result.phase2?.title || existing.phase0.workingTitle,
      subtitleOrLogline:
        existing.phase2.subtitleOrLogline.trim() || result.phase2?.subtitleOrLogline || '',
      narrativeEngine: {
        coreIrony:
          existing.phase2.narrativeEngine.coreIrony.trim() ||
          result.phase2?.narrativeEngine?.coreIrony ||
          '',
        infoGap:
          existing.phase2.narrativeEngine.infoGap.trim() ||
          result.phase2?.narrativeEngine?.infoGap ||
          '',
        payPerEpDriver:
          existing.phase2.narrativeEngine.payPerEpDriver.trim() ||
          result.phase2?.narrativeEngine?.payPerEpDriver ||
          '',
        oneLineAnswer:
          existing.phase2.narrativeEngine.oneLineAnswer.trim() ||
          result.phase2?.narrativeEngine?.oneLineAnswer ||
          '',
      },
      worldview: {
        eraAndSetting:
          existing.phase2.worldview.eraAndSetting.trim() ||
          result.phase2?.worldview?.eraAndSetting ||
          '',
        coreRules: [...existing.phase2.worldview.coreRules, ...newRules],
        terminology: [...existing.phase2.worldview.terminology, ...newTerms],
      },
      characters: [...existing.phase2.characters, ...newChars],
    };
  }

  // 2. Merge Phase 3 (preserve existing blocks & kick events, fill blanks & append new kicks)
  let mergedPhase3: ArcPlan;
  if (!existing.phase3) {
    mergedPhase3 = { ...result.phase3, confirmed: false };
  } else {
    const existingKickTitles = new Set(existing.phase3.kickEvents.map((k) => k.title.trim()));
    const newKicks = (result.phase3?.kickEvents ?? [])
      .filter((k) => k.title.trim() && !existingKickTitles.has(k.title.trim()))
      .map((k, idx) => ({ ...k, id: `ke-merge-${Date.now()}-${idx}` }));

    const mergedBlocks = existing.phase3.blocks.map((blk) => {
      const inc = result.phase3?.blocks?.find((b) => b.blockIndex === blk.blockIndex);
      if (!inc) return blk;
      return {
        ...blk,
        goal: blk.goal.trim() ? blk.goal : inc.goal,
        keyBeat: blk.keyBeat.trim() ? blk.keyBeat : inc.keyBeat,
        cliffhanger: blk.cliffhanger.trim() ? blk.cliffhanger : inc.cliffhanger,
      };
    });

    mergedPhase3 = {
      ...existing.phase3,
      arcGoal: existing.phase3.arcGoal.trim() || result.phase3?.arcGoal || '',
      kickEvents: [...existing.phase3.kickEvents, ...newKicks],
      blocks: mergedBlocks,
    };
  }

  // 3. Merge Phase 4 Block Guides (only add blocks not already present)
  const existingBlockIndices = new Set(existing.phase4Blocks.map((b) => b.blockIndex));
  const mergedPhase4Blocks: EpisodeBlockGuide[] = [
    ...existing.phase4Blocks,
    ...(result.phase4Blocks ?? []).filter((b) => !existingBlockIndices.has(b.blockIndex)),
  ].sort((a, b) => a.blockIndex - b.blockIndex);

  // 4. Merge Episode Blueprints (add new episodes; for existing episodes, preserve writer edits and append new scenes/quotes)
  const nextBlueprints: Record<number, EpisodeNarrativeBlueprint> = { ...existing.blueprints };
  const touchedEpisodes: number[] = [];

  for (const item of result.blueprints ?? []) {
    const epNum = Math.max(1, Math.round(item.episodeNumber || 1));
    touchedEpisodes.push(epNum);
    const existingBp = nextBlueprints[epNum];

    if (!existingBp) {
      nextBlueprints[epNum] = syncBlueprintSceneNames(
        {
          ...item.blueprint,
          prose_tone: item.blueprint.prose_tone?.trim() || result.proseTone || '',
          info_gap: item.blueprint.info_gap?.trim() || mergedPhase2.narrativeEngine.infoGap || '',
          avoid:
            item.blueprint.avoid && item.blueprint.avoid.length > 0
              ? item.blueprint.avoid
              : result.avoid ?? [],
        },
        targetChars
      );
    } else {
      const existingSceneNames = new Set(existingBp.scenes.map((s) => s.name.trim()));
      const extraScenes = item.blueprint.scenes.filter(
        (s) => s.name.trim() && !existingSceneNames.has(s.name.trim())
      );
      const existingAvoid = new Set((existingBp.avoid ?? []).map((a) => a.trim()));
      const extraAvoid = (item.blueprint.avoid ?? []).filter(
        (a) => a.trim() && !existingAvoid.has(a.trim())
      );

      nextBlueprints[epNum] = syncBlueprintSceneNames(
        {
          ...existingBp,
          prose_tone: existingBp.prose_tone?.trim() || item.blueprint.prose_tone || result.proseTone || '',
          info_gap: existingBp.info_gap?.trim() || item.blueprint.info_gap || '',
          avoid: [...(existingBp.avoid ?? []), ...extraAvoid],
          scenes: [...existingBp.scenes, ...extraScenes],
        },
        targetChars
      );
    }
  }

  const memoQuotes = extractQuotedLines(memo);
  const { blueprints: finalBlueprints, totalKeyLines } = ensureVerbatimQuotesInBlueprints(
    nextBlueprints,
    memoQuotes
  );

  const newlyEstimated = resolveEstimatedFields(
    result.inferredFields ?? [],
    mergedPhase2.characters,
    touchedEpisodes
  );
  const combinedEstimated = Array.from(
    new Set([...(existing.aiEstimatedFields ?? []), ...newlyEstimated])
  );

  const mergedMemo = existing.phase0.rawIdeaOrPrologue.includes(memo.trim())
    ? existing.phase0.rawIdeaOrPrologue
    : existing.phase0.rawIdeaOrPrologue.trim()
      ? `${existing.phase0.rawIdeaOrPrologue.trim()}\n\n---\n${memo.trim()}`
      : memo.trim();

  const report: BrainDumpReport = {
    mode: 'merge',
    parsedAt: new Date().toISOString(),
    workingTitle: mergedPhase2.title || existing.phase0.workingTitle,
    settingReady: Boolean(mergedPhase2.title),
    characterCount: addedCharCount > 0 ? mergedPhase2.characters.length : mergedPhase2.characters.length,
    arcBlockCount: mergedPhase3.blocks.length,
    kickEventCount: mergedPhase3.kickEvents.length,
    blueprintEpisodes: Array.from(new Set(touchedEpisodes)).sort((a, b) => a - b),
    quotedKeyLinesCount: totalKeyLines,
    estimatedFieldCount: combinedEstimated.length,
  };

  return {
    ...existing,
    updatedAt: new Date().toISOString(),
    brainDumpText: memo,
    aiEstimatedFields: combinedEstimated,
    lastBrainDumpReport: report,
    phase0: {
      ...existing.phase0,
      rawIdeaOrPrologue: mergedMemo,
    },
    phase1: existing.phase1 ?? { ...result.phase1, confirmed: false },
    phase2: mergedPhase2,
    phase3: mergedPhase3,
    phase4Blocks: mergedPhase4Blocks,
    blueprints: finalBlueprints,
  };
}

const VALID_MISSING_CATEGORIES: BrainDumpMissingCategory[] = [
  '주인공/욕망',
  '능력/제약',
  '갈등/빌런',
  '1화 사건',
  '세계관 룰',
  '톤/타깃',
];

const VALID_FLAG_ISSUE_TYPES: BrainDumpFlagIssueType[] = [
  '설정 모순',
  '상업/이탈 위험',
  '플랫폼/수위 주의',
  '규칙 충돌',
];

/**
 * Normalizes and validates raw AI audit output so score bounds, IDs, enums,
 * and status severity rules (any high-severity flag forces 'warning') are always consistent.
 */
export function normalizeBrainDumpAuditResult(
  raw: Partial<BrainDumpAuditResult> | null | undefined
): BrainDumpAuditResult {
  const scoreRaw = typeof raw?.sufficiencyScore === 'number' ? raw.sufficiencyScore : 50;
  const sufficiencyScore = Math.max(0, Math.min(100, Math.round(scoreRaw)));

  const missingItems: BrainDumpAuditMissingItem[] = Array.isArray(raw?.missingItems)
    ? raw.missingItems
        .filter((item): item is BrainDumpAuditMissingItem => Boolean(item && typeof item === 'object'))
        .map((item, idx) => ({
          id: item.id?.trim() || `missing-${idx + 1}`,
          category: VALID_MISSING_CATEGORIES.includes(item.category)
            ? item.category
            : '주인공/욕망',
          reason: String(item.reason ?? '').trim(),
          question: String(item.question ?? '').trim(),
          quickOptions: Array.isArray(item.quickOptions)
            ? item.quickOptions.map((o) => String(o).trim()).filter(Boolean)
            : [],
        }))
        .filter((item) => item.question.length > 0 || item.reason.length > 0)
    : [];

  const inappropriateFlags: BrainDumpAuditFlag[] = Array.isArray(raw?.inappropriateFlags)
    ? raw.inappropriateFlags
        .filter((flag): flag is BrainDumpAuditFlag => Boolean(flag && typeof flag === 'object'))
        .map((flag, idx): BrainDumpAuditFlag => ({
          id: flag.id?.trim() || `flag-${idx + 1}`,
          severity: flag.severity === 'high' ? 'high' : 'medium',
          issueType: VALID_FLAG_ISSUE_TYPES.includes(flag.issueType)
            ? flag.issueType
            : '상업/이탈 위험',
          quotedPart: String(flag.quotedPart ?? '').trim(),
          reason: String(flag.reason ?? '').trim(),
          fixSuggestions: Array.isArray(flag.fixSuggestions)
            ? flag.fixSuggestions.map((s) => String(s).trim()).filter(Boolean)
            : [],
        }))
        .filter((flag) => flag.reason.length > 0)
    : [];

  const hasHighFlag = inappropriateFlags.some((f) => f.severity === 'high');
  let status: BrainDumpAuditStatus =
    raw?.status === 'ready' || raw?.status === 'needs_more' || raw?.status === 'warning'
      ? raw.status
      : 'needs_more';

  if (hasHighFlag) {
    status = 'warning';
  } else if (status === 'ready' && missingItems.length > 0 && sufficiencyScore < 65) {
    status = 'needs_more';
  }

  const verdictSummary =
    String(raw?.verdictSummary ?? '').trim() ||
    (status === 'warning'
      ? '설계도 생성 전 확인이 필요한 설정 모순 또는 위험 요소가 감지되었습니다.'
      : status === 'needs_more'
        ? '억지 추론을 줄이려면 몇 가지 핵심 재료를 조금 더 보충해 주세요.'
        : '핵심 재료가 충분해 바로 전체 자동 세팅을 진행할 수 있습니다.');

  return {
    status,
    sufficiencyScore,
    verdictSummary,
    missingItems,
    inappropriateFlags,
  };
}

export interface BrainDumpAuditAnswer {
  selectedOption?: string;
  customText?: string;
}

/**
 * Formats writer-selected quick options and custom answers from the pre-audit report
 * into a clean [보충·수정 메모] block ready to append to the Brain Dump notepad.
 */
export function buildSupplementMemoBlock(
  audit: BrainDumpAuditResult,
  missingAnswers: Record<string, BrainDumpAuditAnswer>,
  flagAnswers: Record<string, BrainDumpAuditAnswer>
): string {
  const lines: string[] = [];

  for (const item of audit.missingItems) {
    const ans = missingAnswers[item.id];
    const parts = [ans?.selectedOption?.trim(), ans?.customText?.trim()].filter(
      (v): v is string => Boolean(v)
    );
    if (parts.length === 0) continue;
    lines.push(`- [보충 · ${item.category}] ${item.question} → ${parts.join(' / ')}`);
  }

  for (const flag of audit.inappropriateFlags) {
    const ans = flagAnswers[flag.id];
    const parts = [ans?.selectedOption?.trim(), ans?.customText?.trim()].filter(
      (v): v is string => Boolean(v)
    );
    if (parts.length === 0) continue;
    const quoteRef = flag.quotedPart ? ` (대상: "${flag.quotedPart.slice(0, 48)}")` : '';
    lines.push(`- [수정 반영 · ${flag.issueType}]${quoteRef} → ${parts.join(' / ')}`);
  }

  if (lines.length === 0) return '';
  return `[보충·수정 메모]\n${lines.join('\n')}`;
}

/**
 * Appends a [보충·수정 메모] block cleanly to the end of the writer's Brain Dump memo.
 */
export function appendSupplementToMemo(originalMemo: string, supplementBlock: string): string {
  const trimmedBlock = supplementBlock.trim();
  if (!trimmedBlock) return originalMemo;
  const trimmedOrig = originalMemo.trimEnd();
  if (!trimmedOrig) return trimmedBlock;
  return `${trimmedOrig}\n\n${trimmedBlock}`;
}
