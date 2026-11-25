import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Download,
  FileJson,
  FileText,
  Loader2,
  Lock,
  PenLine,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Unlock,
  Upload,
  Wand2,
} from 'lucide-react';
import { ALL_ANCHOR_TAGS, ANCHOR_TAG_META, PLOT_STRUCTURES } from '../data/munpiaReferences';
import type {
  AnchorTag,
  EpisodeBlockGuide,
  EpisodeGuideRow,
  EpisodeNarrativeBlueprint,
  NarrativeScene,
  SceneSuggestionResult,
  SettingBible,
  WritingRuleProfile,
} from '../types/novelPlanner';
import {
  analyzeBlueprintWarnings,
  buildNovelWriterMasterPrompt,
  createDefaultBlueprintForEpisode,
  parseBlueprintJson,
  syncBlueprintSceneNames,
  toPureBlueprintJson,
} from '../utils/munpiaEngine';
import { DEFAULT_RULE_PROFILE, normalizeRuleProfile } from '../utils/ruleProfileEngine';
import { requestSceneSuggestionAI } from '../services/aiClient';
import { RuleProfileController } from './RuleProfileController';

interface Props {
  activeBlockIndex: number;
  targetEpNum?: number | null;
  blocks: EpisodeBlockGuide[];
  blueprints: Record<number, EpisodeNarrativeBlueprint>;
  settingBible: SettingBible | null;
  projectRuleProfile?: WritingRuleProfile;
  episodeRuleOverrides?: Record<number, WritingRuleProfile>;
  isGeneratingBlock: boolean;
  isGeneratingBlueprint: boolean;
  errorMessage: string | null;
  aiEstimatedFields?: string[];
  seriesMemoryText?: string;
  onClearEstimatedField?: (fieldKey: string) => void;
  onUpdateEpisodeRuleOverride?: (epNum: number, profile: WritingRuleProfile) => void;
  onClearEpisodeRuleOverride?: (epNum: number) => void;
  onSelectBlock: (blockIndex: number) => void;
  onUpdateBlock: (block: EpisodeBlockGuide) => void;
  onUpdateBlueprint: (epNum: number, bp: EpisodeNarrativeBlueprint) => void;
  onGenerateBlockGuide: (blockIndex: number) => void;
  onGenerateBlueprint: (epRow: EpisodeGuideRow) => void;
  onAssembleFromMemo: (epNum: number, memo: string) => void;
  onOpenInPhase5?: (epNum: number) => void;
}

const ANCHOR_SELECT_STYLES: Record<AnchorTag, string> = {
  상황: 'bg-zinc-900 text-zinc-200 border-zinc-700',
  문제: 'bg-rose-950/50 text-rose-200 border-rose-500/50',
  판단: 'bg-sky-950/50 text-sky-200 border-sky-500/50',
  목표: 'bg-amber-950/50 text-amber-200 border-amber-500/50',
  수쓰기: 'bg-indigo-950/50 text-indigo-200 border-indigo-500/50',
  주고받기: 'bg-violet-950/50 text-violet-200 border-violet-500/50',
  이김: 'bg-emerald-950/50 text-emerald-200 border-emerald-500/50',
  풀이: 'bg-teal-950/50 text-teal-200 border-teal-500/50',
  갈고리: 'bg-orange-950/60 text-amber-200 border-amber-400/70',
};

export const Phase4NarrativeStudioView: React.FC<Props> = ({
  activeBlockIndex,
  targetEpNum = null,
  blocks,
  blueprints,
  settingBible,
  projectRuleProfile = DEFAULT_RULE_PROFILE,
  episodeRuleOverrides = {},
  isGeneratingBlock,
  isGeneratingBlueprint,
  errorMessage,
  aiEstimatedFields = [],
  seriesMemoryText,
  onClearEstimatedField,
  onUpdateEpisodeRuleOverride,
  onClearEpisodeRuleOverride,
  onSelectBlock,
  onUpdateBlock,
  onUpdateBlueprint,
  onGenerateBlockGuide,
  onGenerateBlueprint,
  onAssembleFromMemo,
  onOpenInPhase5,
}) => {
  const startEp = activeBlockIndex * 5 + 1;
  const currentBlock = blocks.find((b) => b.blockIndex === activeBlockIndex) ?? null;

  const [selectedEpNum, setSelectedEpNum] = useState<number>(targetEpNum ?? startEp);

  useEffect(() => {
    if (targetEpNum && targetEpNum >= 1) {
      setSelectedEpNum(targetEpNum);
    }
  }, [targetEpNum]);

  const isEstimated = (key: string) => aiEstimatedFields.includes(key);
  const clearEst = (key: string) => {
    if (isEstimated(key)) {
      onClearEstimatedField?.(key);
    }
  };
  const renderEstimatedBadge = (key: string) =>
    isEstimated(key) ? (
      <span
        data-estimated-field={key}
        className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-400/35 rounded align-middle"
      >
        AI 추정
      </span>
    ) : null;
  const [builderMode, setBuilderMode] = useState<'visual' | 'json'>('visual');
  const [authoringMode, setAuthoringMode] = useState<'manual' | 'auto'>('manual');
  const [quickMemo, setQuickMemo] = useState<string>('');
  const [globalDrawerOpen, setGlobalDrawerOpen] = useState<boolean>(true);
  const [openSceneDrawers, setOpenSceneDrawers] = useState<Record<string, boolean>>({});
  const [sceneSuggestions, setSceneSuggestions] = useState<Record<string, SceneSuggestionResult>>({});
  const [suggestingSceneKey, setSuggestingSceneKey] = useState<string | null>(null);
  const [sceneSuggestError, setSceneSuggestError] = useState<string | null>(null);

  const [jsonDraft, setJsonDraft] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);
  const [copiedMasterFlag, setCopiedMasterFlag] = useState(false);
  const [masterPromptPreview, setMasterPromptPreview] = useState<string | null>(null);

  const effectiveEpNum =
    selectedEpNum >= startEp && selectedEpNum <= startEp + 4 ? selectedEpNum : startEp;

  const currentEpGuide =
    currentBlock?.episodes.find((e) => e.episodeNumber === effectiveEpNum) ?? null;

  const targetTotalChars = settingBible?.basicInfo.targetCharsPerEp || 5000;
  const activeBlueprint = blueprints[effectiveEpNum] ?? null;

  const totalLines = useMemo(
    () => (activeBlueprint ? activeBlueprint.scenes.reduce((s, sc) => s + (sc.lines || 0), 0) : 0),
    [activeBlueprint]
  );
  const totalChars = useMemo(
    () => (activeBlueprint ? activeBlueprint.scenes.reduce((s, sc) => s + (sc.target_chars || 0), 0) : 0),
    [activeBlueprint]
  );

  const globalV2FilledCount = useMemo(() => {
    if (!activeBlueprint) return 0;
    let count = 0;
    if (activeBlueprint.prose_tone?.trim()) count++;
    if (activeBlueprint.info_gap?.trim()) count++;
    if ((activeBlueprint.avoid ?? []).some((a) => a.trim().length > 0)) count++;
    return count;
  }, [activeBlueprint]);

  const isEpisodeOverride = Boolean(episodeRuleOverrides[effectiveEpNum]);
  const effectiveRuleProfile = useMemo(
    () =>
      normalizeRuleProfile(episodeRuleOverrides[effectiveEpNum] ?? projectRuleProfile),
    [episodeRuleOverrides, effectiveEpNum, projectRuleProfile]
  );

  const blueprintWarnings = useMemo(
    () => analyzeBlueprintWarnings(activeBlueprint, effectiveRuleProfile),
    [activeBlueprint, effectiveRuleProfile]
  );

  const commitBlueprint = (next: EpisodeNarrativeBlueprint) => {
    const synced = syncBlueprintSceneNames(next, targetTotalChars);
    onUpdateBlueprint(effectiveEpNum, synced);
  };

  const handleInitDefaultBlueprint = () => {
    const castNames = settingBible?.characters.map((c) => c.name) ?? ['주인공', '조력자'];
    const prevGuide = currentBlock?.episodes.find((e) => e.episodeNumber === effectiveEpNum - 1);
    const bp = createDefaultBlueprintForEpisode(
      effectiveEpNum,
      currentEpGuide?.oneLineTitle || `${effectiveEpNum}화 설계도`,
      effectiveEpNum === 1 ? null : prevGuide?.coreIncident ?? '이전 화 직후 이어짐',
      settingBible?.basicInfo.pov || "1인칭 '나'",
      castNames
    );
    onUpdateBlueprint(effectiveEpNum, bp);
  };

  const handleOpenJsonMode = () => {
    if (activeBlueprint) {
      setJsonDraft(JSON.stringify(toPureBlueprintJson(activeBlueprint), null, 2));
      setJsonError(null);
    }
    setBuilderMode('json');
  };

  const handleApplyJsonDraft = () => {
    const res = parseBlueprintJson(jsonDraft);
    if (!res.ok) {
      setJsonError(res.error);
      return;
    }
    setJsonError(null);
    onUpdateBlueprint(effectiveEpNum, res.data);
    setBuilderMode('visual');
  };

  const handleCopyJson = async () => {
    if (!activeBlueprint) return;
    const pureText = JSON.stringify(toPureBlueprintJson(activeBlueprint), null, 2);
    try {
      await navigator.clipboard.writeText(pureText);
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 1800);
    } catch {
      setJsonDraft(pureText);
      setBuilderMode('json');
    }
  };

  const handleCopyMasterPrompt = async () => {
    if (!activeBlueprint) return;
    const masterPrompt = buildNovelWriterMasterPrompt(
      activeBlueprint,
      settingBible,
      effectiveRuleProfile
    );
    try {
      await navigator.clipboard.writeText(masterPrompt);
      setCopiedMasterFlag(true);
      setMasterPromptPreview(null);
      setTimeout(() => setCopiedMasterFlag(false), 2000);
    } catch {
      setMasterPromptPreview(masterPrompt);
    }
  };

  const handleDownloadBlueprintJson = () => {
    if (!activeBlueprint) return;
    const pure = toPureBlueprintJson(activeBlueprint);
    const blob = new Blob([JSON.stringify(pure, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blueprint-ep${effectiveEpNum}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBlueprintFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result ?? '');
      const res = parseBlueprintJson(content);
      if (!res.ok) {
        setJsonError(res.error);
        setJsonDraft(content);
        setBuilderMode('json');
      } else {
        setJsonError(null);
        onUpdateBlueprint(effectiveEpNum, res.data);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateEpisodeRow = (epNumber: number, patch: Partial<EpisodeGuideRow>) => {
    if (!currentBlock) return;
    onUpdateBlock({
      ...currentBlock,
      episodes: currentBlock.episodes.map((row) =>
        row.episodeNumber === epNumber ? { ...row, ...patch } : row
      ),
    });
  };

  const updateScene = (sceneId: string, patch: Partial<NarrativeScene>) => {
    if (!activeBlueprint) return;
    commitBlueprint({
      ...activeBlueprint,
      scenes: activeBlueprint.scenes.map((sc, idx) =>
        (sc.id || `S${idx + 1}`) === sceneId ? { ...sc, ...patch } : sc
      ),
    });
  };

  const addScene = () => {
    if (!activeBlueprint) return;
    const nextIdx = activeBlueprint.scenes.length + 1;
    const newId = `S${Date.now().toString().slice(-3)}${nextIdx}`;
    const simpleId = activeBlueprint.scenes.some((s) => s.id === `S${nextIdx}`) ? newId : `S${nextIdx}`;
    const newScene: NarrativeScene = {
      id: simpleId,
      name: `신규 씬 ${nextIdx}`,
      lines: 35,
      target_chars: 1000,
      tension: 3,
      cast: [settingBible?.characters[0]?.name || '주인공'],
      hostile: false,
      terms: [],
      note: '',
      sensory: '',
      subtext: '',
      key_lines: [],
      anchors: [['상황', '씬 전개 비트를 입력하세요']],
    };
    commitBlueprint({ ...activeBlueprint, scenes: [...activeBlueprint.scenes, newScene] });
  };

  const removeScene = (sceneId: string) => {
    if (!activeBlueprint || activeBlueprint.scenes.length <= 1) return;
    commitBlueprint({
      ...activeBlueprint,
      scenes: activeBlueprint.scenes.filter((s, idx) => (s.id || `S${idx + 1}`) !== sceneId),
    });
  };

  const moveScene = (index: number, delta: -1 | 1) => {
    if (!activeBlueprint) return;
    const target = index + delta;
    if (target < 0 || target >= activeBlueprint.scenes.length) return;
    const copy = [...activeBlueprint.scenes];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    commitBlueprint({ ...activeBlueprint, scenes: copy });
  };

  const toggleSceneDrawer = (sceneKey: string) => {
    setOpenSceneDrawers((prev) => ({ ...prev, [sceneKey]: !prev[sceneKey] }));
  };

  const handleSuggestForScene = async (sceneKey: string, scene: NarrativeScene) => {
    if (!activeBlueprint) return;
    setSceneSuggestError(null);
    setSuggestingSceneKey(sceneKey);
    try {
      const suggestion = await requestSceneSuggestionAI(activeBlueprint, scene, seriesMemoryText);
      setSceneSuggestions((prev) => ({ ...prev, [sceneKey]: suggestion }));
      setOpenSceneDrawers((prev) => ({ ...prev, [sceneKey]: true }));
    } catch (err) {
      setSceneSuggestError(err instanceof Error ? err.message : '씬 아이디어 추천 호출 실패');
    } finally {
      setSuggestingSceneKey(null);
    }
  };

  return (
    <div className="space-y-10">
      {/* Phase 4 Header & 5-Block Selector */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <p className="text-xs font-medium text-amber-400 tracking-wide mb-1.5">
            Phase 4 · 5화 블록 가이드 & 1화 정밀 서사 제어 설계도 v2
          </p>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            빠른 AI 초안 조립과 정밀 수동 디렉팅을 오가며 회차 설계도를 완성하세요
          </h1>
        </div>
        <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg overflow-x-auto shrink-0">
          {PLOT_STRUCTURES.arc25Blocks.map((b) => {
            const active = b.blockIndex === activeBlockIndex;
            const hasData = blocks.some((blk) => blk.blockIndex === b.blockIndex);
            return (
              <button
                key={b.blockIndex}
                type="button"
                onClick={() => {
                  onSelectBlock(b.blockIndex);
                  setSelectedEpNum(b.blockIndex * 5 + 1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-semibold'
                    : hasData
                      ? 'text-zinc-200 hover:bg-zinc-800'
                      : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {b.epRange} · {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* SECTION A: 5-Episode Block Guide */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              A. {startEp}~{startEp + 4}화 블록 가이드
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              각 회차의 시작·핵심 사건·끝·100원 가치·서비스 씬을 확정하고 하단에서 1화 설계도를 정밀 편집하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGenerateBlockGuide(activeBlockIndex)}
            disabled={isGeneratingBlock}
            className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            {isGeneratingBlock ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{currentBlock ? 'AI 5화 블록 가이드 재생성' : 'AI 5화 블록 가이드 생성'}</span>
          </button>
        </div>

        {!currentBlock ? (
          <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 space-y-3">
            <p className="text-sm text-zinc-300">
              {startEp}~{startEp + 4}화 블록 가이드가 아직 작성되지 않았습니다.
            </p>
            <button
              type="button"
              onClick={() => onGenerateBlockGuide(activeBlockIndex)}
              disabled={isGeneratingBlock}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI로 {startEp}~{startEp + 4}화 가이드 생성</span>
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label htmlFor="block-goal-input" className="block text-xs text-zinc-400 mb-1">
                5화 블록 핵심 목표
              </label>
              <input
                id="block-goal-input"
                type="text"
                value={currentBlock.blockGoal}
                onChange={(e) => onUpdateBlock({ ...currentBlock, blockGoal: e.target.value })}
                className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-400/70"
              />
            </div>

            <div className="border border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-800/70 bg-zinc-900/40">
              {currentBlock.episodes.map((ep) => {
                const isSelected = ep.episodeNumber === effectiveEpNum;
                const hasBp = Boolean(blueprints[ep.episodeNumber]);
                return (
                  <div
                    key={ep.episodeNumber}
                    className={`p-4 space-y-3 transition-colors ${
                      isSelected ? 'bg-amber-400/[0.05]' : 'hover:bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-mono text-xs font-semibold text-amber-400 w-10 shrink-0 tabular-nums">
                          {ep.episodeLabel}
                        </span>
                        <input
                          type="text"
                          aria-label={`${ep.episodeNumber}화 한줄 제목`}
                          value={ep.oneLineTitle}
                          onChange={(e) =>
                            updateEpisodeRow(ep.episodeNumber, { oneLineTitle: e.target.value })
                          }
                          className="text-sm font-semibold text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-amber-400 focus:outline-none flex-1 min-w-[180px]"
                        />
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-zinc-500">
                          {hasBp ? '설계도 작성됨' : '설계도 미작성'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEpNum(ep.episodeNumber);
                            setBuilderMode('visual');
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 font-semibold'
                              : 'bg-zinc-950 text-zinc-200 border border-zinc-800 hover:border-zinc-600'
                          }`}
                        >
                          {isSelected ? '편집 중인 회차' : '서사 설계도 열기'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs">
                      <div className="space-y-1">
                        <span className="text-zinc-500">시작</span>
                        <textarea
                          rows={2}
                          aria-label={`${ep.episodeNumber}화 시작`}
                          value={ep.opening}
                          onChange={(e) => updateEpisodeRow(ep.episodeNumber, { opening: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded text-zinc-300 leading-snug resize-none focus:outline-none focus:border-amber-400/70"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-zinc-500">핵심 사건</span>
                        <textarea
                          rows={2}
                          aria-label={`${ep.episodeNumber}화 핵심 사건`}
                          value={ep.coreIncident}
                          onChange={(e) =>
                            updateEpisodeRow(ep.episodeNumber, { coreIncident: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded text-zinc-200 leading-snug resize-none focus:outline-none focus:border-amber-400/70"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-zinc-500">끝 (갈고리)</span>
                        <textarea
                          rows={2}
                          aria-label={`${ep.episodeNumber}화 끝`}
                          value={ep.ending}
                          onChange={(e) => updateEpisodeRow(ep.episodeNumber, { ending: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded text-zinc-300 leading-snug resize-none focus:outline-none focus:border-amber-400/70"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-amber-300/80">100원 가치</span>
                        <textarea
                          rows={2}
                          aria-label={`${ep.episodeNumber}화 100원 가치`}
                          value={ep.value100Won}
                          onChange={(e) =>
                            updateEpisodeRow(ep.episodeNumber, { value100Won: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded text-amber-200/90 leading-snug resize-none focus:outline-none focus:border-amber-400/70"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-zinc-500">서비스 씬 / 리액션</span>
                        <textarea
                          rows={2}
                          aria-label={`${ep.episodeNumber}화 서비스 씬`}
                          value={ep.serviceScene}
                          onChange={(e) =>
                            updateEpisodeRow(ep.episodeNumber, { serviceScene: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 bg-zinc-950/80 border border-zinc-800/80 rounded text-zinc-300 leading-snug resize-none focus:outline-none focus:border-amber-400/70"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Block Checklist */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-300 pt-1">
              <span className="text-zinc-500 font-medium">블록 체크리스트:</span>
              {currentBlock.checklist.map((chk) => (
                <label key={chk.id} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chk.checked}
                    onChange={(e) =>
                      onUpdateBlock({
                        ...currentBlock,
                        checklist: currentBlock.checklist.map((c) =>
                          c.id === chk.id ? { ...c, checked: e.target.checked } : c
                        ),
                      })
                    }
                    className="accent-amber-400 rounded"
                  />
                  <span className={chk.checked ? 'text-zinc-400 line-through' : 'text-zinc-200'}>
                    {chk.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      <hr className="border-zinc-800/80" />

      {/* SECTION B: 1-Episode Hybrid Precision Narrative Control Blueprint Builder v2 */}
      <section className="space-y-6" aria-label="1화 단위 정밀 서사 제어 설계도 빌더">
        <div className="space-y-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-zinc-100">
              B. {effectiveEpNum}화 정밀 서사 제어 설계도 (v2 하이브리드 JSON 빌더)
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              씬 제목 변경 시 <code className="font-mono text-amber-300">win · laugh · threads</code>의 씬 참조가 자동 동기화되며, 복사·다운로드 시 순수 v2 JSON 스키마로 출력됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left group: Mode & View switchers */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-0.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAuthoringMode('manual')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                    authoringMode === 'manual'
                      ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>정밀 디렉팅 (보호)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuthoringMode('auto')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                    authoringMode === 'auto'
                      ? 'bg-amber-400/20 text-amber-200 border border-amber-400/50'
                      : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <Unlock className="w-3 h-3" />
                  <span>빠른 초안 (AI 조립)</span>
                </button>
              </div>

              <div className="flex items-center gap-0.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setBuilderMode('visual')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                    builderMode === 'visual' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>시각 편집</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenJsonMode}
                  disabled={!activeBlueprint}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap inline-flex items-center gap-1.5 disabled:opacity-40 ${
                    builderMode === 'json' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>순수 JSON</span>
                </button>
              </div>
            </div>

            {/* Right group: Master Prompt Copy & JSON I/O */}
            <div className="flex flex-wrap items-center gap-2">
              {activeBlueprint && (
                <>
                  {onOpenInPhase5 && (
                    <button
                      type="button"
                      data-testid="phase4-open-phase5"
                      onClick={() => onOpenInPhase5(effectiveEpNum)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <PenLine className="w-3.5 h-3.5" />
                      <span>이 설계도로 바로 집필하기</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyMasterPrompt}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-200 bg-amber-400/15 border border-amber-400/50 hover:bg-amber-400/25 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    {copiedMasterFlag ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-amber-300" />
                    )}
                    <span>
                      {copiedMasterFlag
                        ? '마스터 프롬프트 복사됨'
                        : 'Novel Writer 집필 마스터 프롬프트 복사'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {copiedFlag ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedFlag ? '복사됨' : '복사'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadBlueprintJson}
                    className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>내보내기</span>
                  </button>
                </>
              )}

              <label className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                <span>가져오기</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBlueprintFile}
                  className="sr-only"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Episode-Level Collapsible Plot & Writing Rule Profile Controller */}
        {onUpdateEpisodeRuleOverride && onClearEpisodeRuleOverride && (
          <RuleProfileController
            profile={effectiveRuleProfile}
            episodeNumber={effectiveEpNum}
            isEpisodeOverride={isEpisodeOverride}
            onToggleEpisodeOverride={(useOverride) => {
              if (useOverride) {
                onUpdateEpisodeRuleOverride(effectiveEpNum, normalizeRuleProfile(projectRuleProfile));
              } else {
                onClearEpisodeRuleOverride(effectiveEpNum);
              }
            }}
            onResetEpisodeOverride={() => onClearEpisodeRuleOverride(effectiveEpNum)}
            onChange={(nextProfile) => onUpdateEpisodeRuleOverride(effectiveEpNum, nextProfile)}
            testIdPrefix="phase4-rule-controller"
          />
        )}

        {/* Hybrid Quick Auto-Assembly Panel vs Manual Lock Banner */}
        {authoringMode === 'auto' ? (
          <div className="p-5 bg-zinc-900/70 border border-amber-400/35 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-amber-200">
                  빠른 초안 모드 — 한국어 줄거리 메모로 AI 설계도 자동 조립
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  5~6줄 분량의 거친 줄거리 메모를 입력하면 골격(scenes·anchors)과 v2 풍부화 슬롯(prose_tone·info_gap·avoid·sensory·subtext·key_lines)을 한 번에 채웁니다.
                </p>
              </div>
              {currentEpGuide && (
                <button
                  type="button"
                  onClick={() => onGenerateBlueprint(currentEpGuide)}
                  disabled={isGeneratingBlueprint}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-950 border border-zinc-700 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  {isGeneratingBlueprint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  <span>상단 블록 가이드로 자동 조립</span>
                </button>
              )}
            </div>
            <textarea
              aria-label="회차 줄거리 메모 (AI 자동 조립용)"
              rows={4}
              value={quickMemo}
              onChange={(e) => setQuickMemo(e.target.value)}
              placeholder="예: 2화 — 아침에 약탕 시녀가 죽을 들고 찾아온다. 당서진은 식초와 소금물 반응으로 죽에 든 지효독을 그 자리에서 적발한다. 평소 약골인 줄만 알았던 시녀가 공포에 질려 무릎 꿇고, 소매 끝 송진 냄새로 삼장로 약재고 배후를 잡으며 끝난다."
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400/70"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">
                조립 완료 후 [정밀 디렉팅 (보호)] 모드로 전환하면 작가의 수정본을 AI가 절대 덮어쓰지 않습니다.
              </span>
              <button
                type="button"
                onClick={() => onAssembleFromMemo(effectiveEpNum, quickMemo)}
                disabled={isGeneratingBlueprint || !quickMemo.trim()}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                {isGeneratingBlueprint ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>AI 설계도 자동 조립</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-2.5 bg-zinc-900/50 border border-zinc-800/80 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
            <span>
              <strong className="text-emerald-400 font-medium">정밀 디렉팅 보호 활성</strong> · 작가의 수동 입력을 AI가 덮어쓰지 않습니다. 각 씬 서랍 안의 비파괴적 아이디어 추천만 선택적으로 삽입할 수 있습니다.
            </span>
            <button
              type="button"
              onClick={() => setAuthoringMode('auto')}
              className="text-amber-400 hover:text-amber-300 font-medium whitespace-nowrap"
            >
              빠른 초안(AI 조립) 열기
            </button>
          </div>
        )}

        {masterPromptPreview && (
          <div className="p-4 bg-zinc-900/80 border border-amber-400/40 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-amber-300">
                Novel Writer 집필 마스터 프롬프트 (직접 복사 가능)
              </span>
              <button
                type="button"
                onClick={() => setMasterPromptPreview(null)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                닫기
              </button>
            </div>
            <textarea
              readOnly
              aria-label="Novel Writer 집필 마스터 프롬프트 미리보기"
              rows={12}
              value={masterPromptPreview}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg font-mono text-xs text-amber-100/90 leading-relaxed focus:outline-none"
            />
          </div>
        )}

        {!activeBlueprint ? (
          <div className="p-10 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 space-y-4">
            <FileJson className="w-8 h-8 text-zinc-600 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-zinc-200">{effectiveEpNum}화 서사 제어 설계도가 없습니다</p>
              <p className="text-xs text-zinc-400">
                빈 4씬 템플릿으로 수동 디렉팅을 시작하거나 빠른 초안(AI 조립) 모드로 자동 생성할 수 있습니다.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleInitDefaultBlueprint}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg"
              >
                빈 4씬 v2 템플릿으로 시작
              </button>
              <button
                type="button"
                onClick={() => setAuthoringMode('auto')}
                className="px-4 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>줄거리 메모로 AI 조립</span>
              </button>
            </div>
          </div>
        ) : builderMode === 'json' ? (
          /* RAW PURE V2 JSON INSPECTOR & DIRECT EDITOR */
          <div className="space-y-3">
            {jsonError && (
              <div role="alert" className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-200">
                {jsonError}
              </div>
            )}
            <textarea
              aria-label="회차 서사 설계도 JSON 원문"
              rows={26}
              value={jsonDraft}
              onChange={(e) => setJsonDraft(e.target.value)}
              spellCheck={false}
              className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-xs leading-relaxed text-amber-100/90 focus:outline-none focus:border-amber-400/70"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                v1 레거시 JSON을 붙여넣어도 누락된 v2 선택 슬롯(prose_tone, sensory 등)이 안전하게 자동 보정됩니다.
              </p>
              <button
                type="button"
                onClick={handleApplyJsonDraft}
                className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg whitespace-nowrap"
              >
                JSON 변경사항 적용
              </button>
            </div>
          </div>
        ) : (
          /* VISUAL 4-LAYER + V2 ENRICHMENT BLUEPRINT EDITOR */
          <div className="space-y-8">
            {/* Telemetry Strip & Tension Curve SVG */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-zinc-400">회차 분량 환산 & 문피아 기준 (오프라인 자동 계산)</span>
                  <div className="flex items-baseline gap-3 font-mono tabular-nums">
                    <span className="text-2xl font-semibold text-zinc-100">
                      {totalChars.toLocaleString()}자
                    </span>
                    <span className="text-xs text-zinc-400">
                      총 {totalLines}줄 · {activeBlueprint.scenes.length}씬
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400">
                    N마크(3,000자) 충족 · 표준 목표({targetTotalChars.toLocaleString()}자) 비례 자동 배분
                  </p>
                </div>

                {/* Scene proportion bar */}
                <div className="space-y-1.5">
                  <div className="flex h-2.5 rounded-full overflow-hidden bg-zinc-800 gap-0.5">
                    {activeBlueprint.scenes.map((sc, idx) => {
                      const pct = totalLines > 0 ? (sc.lines / totalLines) * 100 : 25;
                      const shades = ['bg-zinc-500', 'bg-amber-500/70', 'bg-amber-400', 'bg-emerald-400/80', 'bg-sky-400/80'];
                      return (
                        <div
                          key={sc.id || `S${idx + 1}`}
                          style={{ width: `${pct}%` }}
                          className={shades[idx % shades.length]}
                          title={`${sc.name}: ${(sc.target_chars ?? 0).toLocaleString()}자`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-400 font-mono tabular-nums">
                    {activeBlueprint.scenes.map((sc, idx) => (
                      <span key={sc.id || `S${idx + 1}`}>
                        {sc.id || `S${idx + 1}`} {(sc.target_chars ?? 0).toLocaleString()}자
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* SVG Tension Curve */}
              <div className="lg:col-span-7 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                  <span>긴장도 곡선 (Tension 1~5)</span>
                  <span className="font-mono tabular-nums">
                    엔딩 유형: <strong className="text-amber-300">{activeBlueprint.ending.type}</strong>
                  </span>
                </div>
                <div className="w-full h-28 bg-zinc-950/70 border border-zinc-800/70 rounded-lg px-4 py-2">
                  <svg viewBox="0 0 420 96" className="w-full h-full overflow-visible" role="img" aria-label="씬별 긴장도 곡선">
                    {[1, 2, 3, 4, 5].map((lvl) => {
                      const y = 78 - (lvl - 1) * 16;
                      return (
                        <g key={lvl}>
                          <line x1="24" y1={y} x2="404" y2={y} stroke="#27272a" strokeDasharray="2 3" />
                          <text x="6" y={y + 3} fill="#71717a" fontSize="9" fontFamily="JetBrains Mono">
                            {lvl}
                          </text>
                        </g>
                      );
                    })}
                    {activeBlueprint.scenes.length > 1 && (
                      <polyline
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2"
                        points={activeBlueprint.scenes
                          .map((sc, i) => {
                            const x =
                              36 +
                              (i / Math.max(1, activeBlueprint.scenes.length - 1)) * 356;
                            const y = 78 - (sc.tension - 1) * 16;
                            return `${x},${y}`;
                          })
                          .join(' ')}
                      />
                    )}
                    {activeBlueprint.scenes.map((sc, i) => {
                      const x =
                        activeBlueprint.scenes.length === 1
                          ? 210
                          : 36 + (i / (activeBlueprint.scenes.length - 1)) * 356;
                      const y = 78 - (sc.tension - 1) * 16;
                      const sKey = sc.id || `S${i + 1}`;
                      return (
                        <g key={sKey}>
                          <circle cx={x} cy={y} r="4.5" fill={sc.hostile ? '#fb7185' : '#fbbf24'} stroke="#090b10" strokeWidth="1.5" />
                          <text
                            x={x}
                            y="92"
                            textAnchor="middle"
                            fill="#a1a1aa"
                            fontSize="9.5"
                            fontFamily="JetBrains Mono"
                          >
                            {sKey} ({sc.tension})
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            </div>

            {/* Munpia 100-Won Value & Tension Live Self-Diagnostic Strip */}
            <div
              role="status"
              aria-label="문피아 100원 가치 및 텐션 자가 진단"
              className={`p-4 rounded-xl border space-y-2 ${
                blueprintWarnings.length > 0
                  ? 'bg-amber-950/20 border-amber-500/35'
                  : 'bg-zinc-900/40 border-zinc-800/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-zinc-200">
                  문피아 100원 가치 & 텐션 자가 진단
                </span>
                {blueprintWarnings.length === 0 ? (
                  <span className="text-emerald-400 inline-flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>엔딩 절단신공 · 씬 사건 밀도 규칙 충족</span>
                  </span>
                ) : (
                  <span className="font-mono tabular-nums text-amber-300">
                    {blueprintWarnings.length}건 점검 권장
                  </span>
                )}
              </div>

              {blueprintWarnings.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-zinc-800/70">
                  {blueprintWarnings.map((w, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <span className="font-semibold text-amber-300 mr-1.5">
                          [{w.severity}] {w.category}
                        </span>
                        <span className="text-zinc-200">{w.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Layer 1: Core Episode Control */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-zinc-200">1계층 · 회차 기본 제어 (목표 · 대가 · 속마음 · 필수 사건)</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="bp-ep" className="block text-xs text-zinc-400 mb-1">회차 표기</label>
                  <input
                    id="bp-ep"
                    type="text"
                    value={activeBlueprint.episode}
                    onChange={(e) => commitBlueprint({ ...activeBlueprint, episode: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-mono text-zinc-100"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="bp-title" className="block text-xs text-zinc-400 mb-1">회차 제목</label>
                  <input
                    id="bp-title"
                    type="text"
                    value={activeBlueprint.title}
                    onChange={(e) => commitBlueprint({ ...activeBlueprint, title: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label htmlFor="bp-pov" className="block text-xs text-zinc-400 mb-1">시점 (POV)</label>
                  <input
                    id="bp-pov"
                    type="text"
                    value={activeBlueprint.pov}
                    onChange={(e) => commitBlueprint({ ...activeBlueprint, pov: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bp-goal" className="block text-xs text-zinc-400 mb-1">주인공 목표와 수단 (goal)</label>
                  <textarea
                    id="bp-goal"
                    rows={2}
                    value={activeBlueprint.goal}
                    onChange={(e) => commitBlueprint({ ...activeBlueprint, goal: e.target.value })}
                    className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label htmlFor="bp-stake" className="block text-xs text-rose-300/90 mb-1">실패 시 치명적 대가 (stake)</label>
                  <textarea
                    id="bp-stake"
                    rows={2}
                    value={activeBlueprint.stake}
                    onChange={(e) => commitBlueprint({ ...activeBlueprint, stake: e.target.value })}
                    className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label htmlFor="bp-inner" className="block text-xs text-zinc-400 mb-1">속마음/독백 비율 가이드 (inner)</label>
                  <input
                    id="bp-inner"
                    type="text"
                    value={activeBlueprint.inner}
                    onChange={(e) => commitBlueprint({ ...activeBlueprint, inner: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200"
                  />
                </div>
                <div>
                  <label htmlFor="bp-prev" className="block text-xs text-zinc-400 mb-1">이전 화 요약 (prev · 1화는 비움/null)</label>
                  <input
                    id="bp-prev"
                    type="text"
                    value={activeBlueprint.prev ?? ''}
                    placeholder="1화는 null로 저장됩니다"
                    onChange={(e) =>
                      commitBlueprint({ ...activeBlueprint, prev: e.target.value.trim() ? e.target.value : null })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200"
                  />
                </div>
              </div>

              {/* Must checklist */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">필수 포함 사건 체크리스트 (must)</span>
                  <button
                    type="button"
                    onClick={() =>
                      commitBlueprint({ ...activeBlueprint, must: [...activeBlueprint.must, ''] })
                    }
                    className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>항목 추가</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeBlueprint.must.map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        aria-label={`필수 사건 ${idx + 1}`}
                        value={m}
                        onChange={(e) => {
                          const next = [...activeBlueprint.must];
                          next[idx] = e.target.value;
                          commitBlueprint({ ...activeBlueprint, must: next });
                        }}
                        className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200"
                      />
                      <button
                        type="button"
                        aria-label={`필수 사건 ${idx + 1} 삭제`}
                        onClick={() =>
                          commitBlueprint({
                            ...activeBlueprint,
                            must: activeBlueprint.must.filter((_, i) => i !== idx),
                          })
                        }
                        className="p-1.5 text-zinc-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* V2 GLOBAL COLLAPSIBLE ENRICHMENT DRAWER (prose_tone, info_gap, avoid) */}
              <div className="border border-zinc-800/90 rounded-xl bg-zinc-900/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGlobalDrawerOpen((v) => !v)}
                  aria-expanded={globalDrawerOpen}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-zinc-900/80 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {globalDrawerOpen ? (
                      <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-zinc-100">
                      v2 전역 디렉팅 서랍 — 문체·호흡(prose_tone) · 정보 낙차(info_gap) · 절대 금지선(avoid)
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-amber-300 shrink-0">
                    {globalV2FilledCount} / 3 슬롯 입력됨
                  </span>
                </button>

                {globalDrawerOpen && (
                  <div className="p-4 pt-3 border-t border-zinc-800/80 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor="v2-prose-tone" className="block text-xs text-sky-300 font-medium">
                          문체 · 호흡 가이드 (prose_tone)
                          {renderEstimatedBadge(`blueprint.${effectiveEpNum}.prose_tone`)}
                        </label>
                        <textarea
                          id="v2-prose-tone"
                          rows={2}
                          value={activeBlueprint.prose_tone ?? ''}
                          onChange={(e) => {
                            clearEst(`blueprint.${effectiveEpNum}.prose_tone`);
                            commitBlueprint({ ...activeBlueprint, prose_tone: e.target.value });
                          }}
                          placeholder="예: 위기 씬은 단문 호흡, 추리는 냉철한 이성 톤"
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-400/70"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="v2-info-gap" className="block text-xs text-amber-300 font-medium">
                          정보 낙차 (info_gap · 주인공·독자만 아는 진실 vs 조연 착각)
                          {renderEstimatedBadge(`blueprint.${effectiveEpNum}.info_gap`)}
                        </label>
                        <textarea
                          id="v2-info-gap"
                          rows={2}
                          value={activeBlueprint.info_gap ?? ''}
                          onChange={(e) => {
                            clearEst(`blueprint.${effectiveEpNum}.info_gap`);
                            commitBlueprint({ ...activeBlueprint, info_gap: e.target.value });
                          }}
                          placeholder="예: 주인공은 활성탄 흡착 원리를 알지만 노복은 도련님이 실성했다고 착각한다"
                          className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-400/70"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-rose-300">
                          절대 금지선 (avoid · AI가 절대 쓰면 안 되는 전개·용어·설명충 규칙)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            commitBlueprint({
                              ...activeBlueprint,
                              avoid: [...(activeBlueprint.avoid ?? []), ''],
                            })
                          }
                          className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>금지선 추가</span>
                        </button>
                      </div>
                      {(activeBlueprint.avoid ?? []).length === 0 ? (
                        <p className="text-xs text-zinc-500">
                          등록된 금지선이 없습니다. 설명충 금지, 특정 용어 배제 등 규칙을 추가하세요.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {(activeBlueprint.avoid ?? []).map((rule, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                aria-label={`절대 금지선 ${idx + 1}`}
                                value={rule}
                                onChange={(e) => {
                                  const next = [...(activeBlueprint.avoid ?? [])];
                                  next[idx] = e.target.value;
                                  commitBlueprint({ ...activeBlueprint, avoid: next });
                                }}
                                placeholder="예: 화학식 논문 설명 3줄 이상 금지"
                                className="flex-1 px-3 py-1.5 bg-zinc-950 border border-rose-500/25 rounded text-xs text-zinc-200 focus:outline-none focus:border-rose-400/60"
                              />
                              <button
                                type="button"
                                aria-label={`절대 금지선 ${idx + 1} 삭제`}
                                onClick={() =>
                                  commitBlueprint({
                                    ...activeBlueprint,
                                    avoid: (activeBlueprint.avoid ?? []).filter((_, i) => i !== idx),
                                  })
                                }
                                className="p-1.5 text-zinc-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <hr className="border-zinc-800/80" />

            {/* Layer 2: Win, Laugh, Relation, Ending, Threads */}
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-zinc-200">
                2계층 · 사이다(win) · 유머(laugh) · 관계(relation) · 엔딩(ending) · 복선(threads)
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Win & Ending */}
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">핵심 사이다 / 성취 (win)</span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeBlueprint.win.stretch}
                        onChange={(e) =>
                          commitBlueprint({
                            ...activeBlueprint,
                            win: { ...activeBlueprint.win, stretch: e.target.checked },
                          })
                        }
                        className="accent-amber-400"
                      />
                      <span>호흡 늘리기 (stretch)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label htmlFor="win-scene" className="block text-[11px] text-zinc-400 mb-1">연결 씬 (scene)</label>
                      <select
                        id="win-scene"
                        value={activeBlueprint.win.scene_id || ''}
                        onChange={(e) => {
                          const sc = activeBlueprint.scenes.find((s, i) => (s.id || `S${i + 1}`) === e.target.value);
                          commitBlueprint({
                            ...activeBlueprint,
                            win: {
                              ...activeBlueprint.win,
                              scene_id: e.target.value,
                              scene: sc?.name ?? activeBlueprint.win.scene,
                            },
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-amber-300"
                      >
                        {activeBlueprint.scenes.map((sc, i) => {
                          const sKey = sc.id || `S${i + 1}`;
                          return (
                            <option key={sKey} value={sKey}>
                              {sKey}: {sc.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="win-what" className="block text-[11px] text-zinc-400 mb-1">성취 내용 (what)</label>
                      <input
                        id="win-what"
                        type="text"
                        value={activeBlueprint.win.what}
                        onChange={(e) =>
                          commitBlueprint({
                            ...activeBlueprint,
                            win: { ...activeBlueprint.win, what: e.target.value },
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="win-reaction" className="block text-[11px] text-zinc-400 mb-1">주변 인물 리액션 (reaction)</label>
                    <input
                      id="win-reaction"
                      type="text"
                      value={activeBlueprint.win.reaction}
                      onChange={(e) =>
                        commitBlueprint({
                          ...activeBlueprint,
                          win: { ...activeBlueprint.win, reaction: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200"
                    />
                  </div>

                  <hr className="border-zinc-800/70" />

                  <div className="space-y-2.5">
                    <span className="block text-xs font-semibold text-amber-300">
                      엔딩 갈고리 (ending){renderEstimatedBadge(`blueprint.${effectiveEpNum}.ending`)}
                    </span>
                    <div className="flex items-center gap-2">
                      {(['위기', '반전', '정보', '감정'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            clearEst(`blueprint.${effectiveEpNum}.ending`);
                            commitBlueprint({
                              ...activeBlueprint,
                              ending: { ...activeBlueprint.ending, type: t },
                            });
                          }}
                          className={`px-3 py-1 text-xs rounded border transition-colors ${
                            activeBlueprint.ending.type === t
                              ? 'bg-amber-400/15 border-amber-400/70 text-amber-200 font-semibold'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      aria-label="엔딩 갈고리 내용"
                      value={activeBlueprint.ending.what}
                      onChange={(e) => {
                        clearEst(`blueprint.${effectiveEpNum}.ending`);
                        commitBlueprint({
                          ...activeBlueprint,
                          ending: { ...activeBlueprint.ending, what: e.target.value },
                        });
                      }}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100"
                    />
                  </div>
                </div>

                {/* Threads (Plant/Payoff), Laugh, Relation */}
                <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-4">
                  {/* Threads Plant */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-sky-300">복선 매설 (threads.plant)</span>
                      <button
                        type="button"
                        onClick={() =>
                          commitBlueprint({
                            ...activeBlueprint,
                            threads: {
                              ...activeBlueprint.threads,
                              plant: [
                                ...activeBlueprint.threads.plant,
                                {
                                  what: '',
                                  scene_id: activeBlueprint.scenes[0]?.id ?? 'S1',
                                  scene: activeBlueprint.scenes[0]?.name ?? '',
                                  to: '',
                                },
                              ],
                            },
                          })
                        }
                        className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>매설 추가</span>
                      </button>
                    </div>
                    {activeBlueprint.threads.plant.map((pl, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                        <select
                          aria-label={`복선 매설 ${idx + 1} 씬`}
                          value={pl.scene_id || ''}
                          onChange={(e) => {
                            const next = [...activeBlueprint.threads.plant];
                            next[idx] = { ...next[idx], scene_id: e.target.value };
                            commitBlueprint({
                              ...activeBlueprint,
                              threads: { ...activeBlueprint.threads, plant: next },
                            });
                          }}
                          className="col-span-3 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-amber-300"
                        >
                          {activeBlueprint.scenes.map((sc, i) => {
                            const sKey = sc.id || `S${i + 1}`;
                            return (
                              <option key={sKey} value={sKey}>
                                {sKey}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="text"
                          aria-label={`복선 매설 ${idx + 1} 단서`}
                          value={pl.what}
                          placeholder="매설 단서"
                          onChange={(e) => {
                            const next = [...activeBlueprint.threads.plant];
                            next[idx] = { ...next[idx], what: e.target.value };
                            commitBlueprint({
                              ...activeBlueprint,
                              threads: { ...activeBlueprint.threads, plant: next },
                            });
                          }}
                          className="col-span-5 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200"
                        />
                        <input
                          type="text"
                          aria-label={`복선 매설 ${idx + 1} 회수 예정`}
                          value={pl.to}
                          placeholder="예: 3화 회수"
                          onChange={(e) => {
                            const next = [...activeBlueprint.threads.plant];
                            next[idx] = { ...next[idx], to: e.target.value };
                            commitBlueprint({
                              ...activeBlueprint,
                              threads: { ...activeBlueprint.threads, plant: next },
                            });
                          }}
                          className="col-span-3 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-sky-200"
                        />
                        <button
                          type="button"
                          aria-label={`복선 매설 ${idx + 1} 삭제`}
                          onClick={() =>
                            commitBlueprint({
                              ...activeBlueprint,
                              threads: {
                                ...activeBlueprint.threads,
                                plant: activeBlueprint.threads.plant.filter((_, i) => i !== idx),
                              },
                            })
                          }
                          className="col-span-1 p-1 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <hr className="border-zinc-800/70" />

                  {/* Laugh points */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200">유머 / 호흡 완화 (laugh)</span>
                      <button
                        type="button"
                        onClick={() =>
                          commitBlueprint({
                            ...activeBlueprint,
                            laugh: [
                              ...activeBlueprint.laugh,
                              {
                                scene_id: activeBlueprint.scenes[0]?.id ?? 'S1',
                                scene: activeBlueprint.scenes[0]?.name ?? '',
                                what: '',
                              },
                            ],
                          })
                        }
                        className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>포인트 추가</span>
                      </button>
                    </div>
                    {activeBlueprint.laugh.map((lg, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                        <select
                          aria-label={`유머 ${idx + 1} 씬`}
                          value={lg.scene_id || ''}
                          onChange={(e) => {
                            const next = [...activeBlueprint.laugh];
                            next[idx] = { ...next[idx], scene_id: e.target.value };
                            commitBlueprint({ ...activeBlueprint, laugh: next });
                          }}
                          className="col-span-3 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-amber-300"
                        >
                          {activeBlueprint.scenes.map((sc, i) => {
                            const sKey = sc.id || `S${i + 1}`;
                            return (
                              <option key={sKey} value={sKey}>
                                {sKey}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="text"
                          aria-label={`유머 ${idx + 1} 내용`}
                          value={lg.what}
                          placeholder="유머/티키타카 포인트"
                          onChange={(e) => {
                            const next = [...activeBlueprint.laugh];
                            next[idx] = { ...next[idx], what: e.target.value };
                            commitBlueprint({ ...activeBlueprint, laugh: next });
                          }}
                          className="col-span-8 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200"
                        />
                        <button
                          type="button"
                          aria-label={`유머 ${idx + 1} 삭제`}
                          onClick={() =>
                            commitBlueprint({
                              ...activeBlueprint,
                              laugh: activeBlueprint.laugh.filter((_, i) => i !== idx),
                            })
                          }
                          className="col-span-1 p-1 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <hr className="border-zinc-800/70" />

                  {/* Relation shifts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200">인물 관계 변화 (relation)</span>
                      <button
                        type="button"
                        onClick={() =>
                          commitBlueprint({
                            ...activeBlueprint,
                            relation: [...activeBlueprint.relation, { who: '', from: '', to: '' }],
                          })
                        }
                        className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>관계 추가</span>
                      </button>
                    </div>
                    {activeBlueprint.relation.map((rel, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                        <input
                          type="text"
                          aria-label={`관계 대상 ${idx + 1}`}
                          value={rel.who}
                          placeholder="인물"
                          onChange={(e) => {
                            const next = [...activeBlueprint.relation];
                            next[idx] = { ...next[idx], who: e.target.value };
                            commitBlueprint({ ...activeBlueprint, relation: next });
                          }}
                          className="col-span-3 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100"
                        />
                        <input
                          type="text"
                          aria-label={`관계 변화 전 ${idx + 1}`}
                          value={rel.from}
                          placeholder="변화 전"
                          onChange={(e) => {
                            const next = [...activeBlueprint.relation];
                            next[idx] = { ...next[idx], from: e.target.value };
                            commitBlueprint({ ...activeBlueprint, relation: next });
                          }}
                          className="col-span-4 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-400"
                        />
                        <input
                          type="text"
                          aria-label={`관계 변화 후 ${idx + 1}`}
                          value={rel.to}
                          placeholder="변화 후"
                          onChange={(e) => {
                            const next = [...activeBlueprint.relation];
                            next[idx] = { ...next[idx], to: e.target.value };
                            commitBlueprint({ ...activeBlueprint, relation: next });
                          }}
                          className="col-span-4 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-amber-200"
                        />
                        <button
                          type="button"
                          aria-label={`관계 ${idx + 1} 삭제`}
                          onClick={() =>
                            commitBlueprint({
                              ...activeBlueprint,
                              relation: activeBlueprint.relation.filter((_, i) => i !== idx),
                            })
                          }
                          className="col-span-1 p-1 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-zinc-800/80" />

            {/* Layer 3 & 4: Scenes, Anchor Beats, and Per-Scene v2 Detail Drawers */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">
                    3~4계층 · 씬 구조(scenes) · 서사 앵커(anchors) · v2 연출 서랍(sensory · subtext · key_lines)
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    각 씬의 줄 수(lines)를 조절하면 전체 합계 {targetTotalChars.toLocaleString()}자에 맞춰 글자 수가 자동 재분배됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addScene}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-lg hover:bg-zinc-800 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>씬 추가</span>
                </button>
              </div>

              {sceneSuggestError && (
                <div role="alert" className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-200">
                  {sceneSuggestError}
                </div>
              )}

              <div className="space-y-4">
                {activeBlueprint.scenes.map((sc, sIdx) => {
                  const sKey = sc.id || `S${sIdx + 1}`;
                  const v2Count =
                    (sc.sensory?.trim() ? 1 : 0) +
                    (sc.subtext?.trim() ? 1 : 0) +
                    ((sc.key_lines ?? []).some((k) => k.trim()) ? 1 : 0);
                  const drawerOpen = Boolean(openSceneDrawers[sKey]);
                  const suggestion = sceneSuggestions[sKey];

                  return (
                    <div
                      key={sKey}
                      className="p-5 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-4"
                    >
                      {/* Scene top row */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/70">
                        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                          <span className="font-mono text-xs font-semibold text-amber-400 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded">
                            {sKey}
                          </span>
                          <input
                            type="text"
                            aria-label={`${sKey} 씬 이름`}
                            value={sc.name}
                            onChange={(e) => updateScene(sKey, { name: e.target.value })}
                            className="text-base font-semibold text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-amber-400 focus:outline-none flex-1"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs">
                          <label className="inline-flex items-center gap-1.5 text-zinc-300">
                            <span className="text-zinc-500">줄 수</span>
                            <input
                              type="number"
                              min={5}
                              max={150}
                              aria-label={`${sKey} 목표 줄 수`}
                              value={sc.lines}
                              onChange={(e) =>
                                updateScene(sKey, { lines: Math.max(5, Number(e.target.value) || 10) })
                              }
                              className="w-16 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono tabular-nums text-zinc-100 text-right"
                            />
                          </label>
                          <span className="font-mono tabular-nums text-amber-300">
                            ≈ {(sc.target_chars ?? 0).toLocaleString()}자
                          </span>

                          <div className="inline-flex items-center gap-1">
                            <span className="text-zinc-500 mr-1">긴장도</span>
                            {([1, 2, 3, 4, 5] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => updateScene(sKey, { tension: t })}
                                aria-label={`${sKey} 긴장도 ${t}`}
                                className={`w-6 h-6 rounded text-xs font-mono tabular-nums transition-colors ${
                                  sc.tension === t
                                    ? 'bg-amber-400 text-slate-950 font-semibold'
                                    : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>

                          <label className="inline-flex items-center gap-1.5 cursor-pointer text-zinc-300">
                            <input
                              type="checkbox"
                              checked={sc.hostile}
                              onChange={(e) => updateScene(sKey, { hostile: e.target.checked })}
                              className="accent-rose-400"
                            />
                            <span className={sc.hostile ? 'text-rose-300 font-medium' : 'text-zinc-400'}>
                              적대 갈등
                            </span>
                          </label>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveScene(sIdx, -1)}
                              disabled={sIdx === 0}
                              aria-label={`${sKey} 위로 이동`}
                              className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveScene(sIdx, 1)}
                              disabled={sIdx === activeBlueprint.scenes.length - 1}
                              aria-label={`${sKey} 아래로 이동`}
                              className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeScene(sKey)}
                              disabled={activeBlueprint.scenes.length <= 1}
                              aria-label={`${sKey} 삭제`}
                              className="p-1 text-zinc-500 hover:text-rose-400 disabled:opacity-30"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Cast, Terms, Note */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label htmlFor={`sc-cast-${sKey}`} className="block text-zinc-500 mb-1">
                            등장인물 화이트리스트 (쉼표 구분)
                          </label>
                          <input
                            id={`sc-cast-${sKey}`}
                            type="text"
                            value={sc.cast.join(', ')}
                            onChange={(e) =>
                              updateScene(sKey, {
                                cast: e.target.value
                                  .split(',')
                                  .map((v) => v.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200"
                          />
                        </div>
                        <div>
                          <label htmlFor={`sc-terms-${sKey}`} className="block text-zinc-500 mb-1">
                            필수 고유명사 표기 (쉼표 구분)
                          </label>
                          <input
                            id={`sc-terms-${sKey}`}
                            type="text"
                            value={sc.terms.join(', ')}
                            onChange={(e) =>
                              updateScene(sKey, {
                                terms: e.target.value
                                  .split(',')
                                  .map((v) => v.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-amber-200/90"
                          />
                        </div>
                        <div>
                          <label htmlFor={`sc-note-${sKey}`} className="block text-zinc-500 mb-1">
                            연출 지시사항 (note)
                          </label>
                          <input
                            id={`sc-note-${sKey}`}
                            type="text"
                            value={sc.note}
                            onChange={(e) => updateScene(sKey, { note: e.target.value })}
                            placeholder="예: 살았다는 걸 깨닫는 순간을 늘려"
                            className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200"
                          />
                        </div>
                      </div>

                      {/* Layer 4: Color-Coded Anchor Beats */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-400">
                            전개 비트 앵커 (anchors · 기능 태그별 컬러 구분)
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateScene(sKey, { anchors: [...sc.anchors, ['수쓰기', '']] })
                            }
                            className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>비트 추가</span>
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {sc.anchors.map(([tag, beat], aIdx) => (
                            <div key={aIdx} className="flex items-center gap-2">
                              <select
                                aria-label={`${sKey} 비트 ${aIdx + 1} 태그`}
                                value={tag}
                                onChange={(e) => {
                                  const next = [...sc.anchors];
                                  next[aIdx] = [e.target.value as AnchorTag, beat];
                                  updateScene(sKey, { anchors: next });
                                }}
                                className={`w-28 shrink-0 px-2 py-1.5 border rounded text-xs font-semibold ${
                                  ANCHOR_SELECT_STYLES[tag] || 'bg-zinc-950 text-zinc-200 border-zinc-800'
                                }`}
                              >
                                {ALL_ANCHOR_TAGS.map((t) => (
                                  <option key={t} value={t} className="bg-zinc-950 text-zinc-100">
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                aria-label={`${sKey} 비트 ${aIdx + 1} 내용`}
                                value={beat}
                                onChange={(e) => {
                                  const next = [...sc.anchors];
                                  next[aIdx] = [tag, e.target.value];
                                  updateScene(sKey, { anchors: next });
                                }}
                                placeholder={ANCHOR_TAG_META[tag]?.purpose || '전개 비트 입력'}
                                className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200"
                              />
                              <button
                                type="button"
                                aria-label={`${sKey} 비트 ${aIdx + 1} 삭제`}
                                onClick={() =>
                                  updateScene(sKey, {
                                    anchors: sc.anchors.filter((_, i) => i !== aIdx),
                                  })
                                }
                                className="p-1.5 text-zinc-500 hover:text-rose-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* PER-SCENE V2 COLLAPSIBLE DETAIL DRAWER (sensory, subtext, key_lines + non-destructive AI suggestion) */}
                      <div className="pt-2 border-t border-zinc-800/70">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSceneDrawer(sKey)}
                            aria-expanded={drawerOpen}
                            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-amber-300 transition-colors"
                          >
                            {drawerOpen ? (
                              <ChevronDown className="w-4 h-4 text-amber-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-zinc-500" />
                            )}
                            <span>
                              {sKey} 연출 디테일 서랍 · 감각(sensory) · 이면(subtext) · 원문 대사(key_lines)
                            </span>
                            <span className="font-mono tabular-nums text-amber-300/90">
                              ({v2Count}/3)
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSuggestForScene(sKey, sc)}
                            disabled={suggestingSceneKey === sKey}
                            className="px-2.5 py-1 text-[11px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/30 hover:bg-amber-400/20 disabled:opacity-50 rounded-md inline-flex items-center gap-1.5 whitespace-nowrap"
                          >
                            {suggestingSceneKey === sKey ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )}
                            <span>AI 감각·앵커 아이디어 추천 (비파괴)</span>
                          </button>
                        </div>

                        {drawerOpen && (
                          <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-3 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label htmlFor={`sc-sensory-${sKey}`} className="block text-teal-300 font-medium">
                                  공간 · 감각 앵커 (sensory · 시각/후각/촉각)
                                </label>
                                <textarea
                                  id={`sc-sensory-${sKey}`}
                                  rows={2}
                                  value={sc.sensory ?? ''}
                                  onChange={(e) => updateScene(sKey, { sensory: e.target.value })}
                                  placeholder="예: 식도를 긁는 금속성 쓴맛, 깨진 탕약 그릇의 검은 얼룩"
                                  className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-teal-400/60"
                                />
                              </div>
                              <div className="space-y-1">
                                <label htmlFor={`sc-subtext-${sKey}`} className="block text-violet-300 font-medium">
                                  장면 이면 · 심리전 (subtext · 겉과 속의 의도 차이)
                                </label>
                                <textarea
                                  id={`sc-subtext-${sKey}`}
                                  rows={2}
                                  value={sc.subtext ?? ''}
                                  onChange={(e) => updateScene(sKey, { subtext: e.target.value })}
                                  placeholder="예: 겉으로는 안부를 묻지만 실제로는 사망 여부를 확인하려는 탐색전"
                                  className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded text-zinc-200 focus:outline-none focus:border-violet-400/60"
                                />
                              </div>
                            </div>

                            {/* Key Lines (Verbatim Writer Lines) */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-amber-300 font-medium">
                                  작가 원문 결정적 대사/독백 (key_lines · 집필 시 토씨 수정 없이 원문 삽입)
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateScene(sKey, { key_lines: [...(sc.key_lines ?? []), ''] })
                                  }
                                  className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>대사 추가</span>
                                </button>
                              </div>
                              {(sc.key_lines ?? []).length === 0 ? (
                                <p className="text-zinc-500">
                                  등록된 원문 대사가 없습니다. 꼭 살려야 할 명대사나 독백을 입력해 두세요.
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {(sc.key_lines ?? []).map((line, lIdx) => (
                                    <div key={lIdx} className="flex items-center gap-2">
                                      <input
                                        type="text"
                                        aria-label={`${sKey} 원문 대사 ${lIdx + 1}`}
                                        value={line}
                                        onChange={(e) => {
                                          const next = [...(sc.key_lines ?? [])];
                                          next[lIdx] = e.target.value;
                                          updateScene(sKey, { key_lines: next });
                                        }}
                                        placeholder='"토씨 하나 바꾸지 않고 삽입할 결정적 대사 또는 독백"'
                                        className="flex-1 px-3 py-1.5 bg-zinc-950 border border-amber-500/25 rounded text-amber-100 focus:outline-none focus:border-amber-400/70"
                                      />
                                      <button
                                        type="button"
                                        aria-label={`${sKey} 원문 대사 ${lIdx + 1} 삭제`}
                                        onClick={() =>
                                          updateScene(sKey, {
                                            key_lines: (sc.key_lines ?? []).filter((_, i) => i !== lIdx),
                                          })
                                        }
                                        className="p-1.5 text-zinc-500 hover:text-rose-400"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Non-Destructive AI Suggestion Tray */}
                            {suggestion && (
                              <div className="p-3.5 bg-zinc-950 border border-amber-400/35 rounded-lg space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-amber-300">
                                    AI 제안 서랍 (클릭한 항목만 선택 반영 · 기존 입력 보존)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSceneSuggestions((prev) => {
                                        const copy = { ...prev };
                                        delete copy[sKey];
                                        return copy;
                                      })
                                    }
                                    className="text-zinc-500 hover:text-zinc-300"
                                  >
                                    닫기
                                  </button>
                                </div>

                                {suggestion.sensory && (
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-zinc-300">
                                      <span className="text-teal-300 mr-1.5">[감각]</span>
                                      {suggestion.sensory}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateScene(sKey, {
                                          sensory: sc.sensory?.trim()
                                            ? `${sc.sensory.trim()} / ${suggestion.sensory}`
                                            : suggestion.sensory,
                                        })
                                      }
                                      className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-200 hover:border-amber-400 shrink-0"
                                    >
                                      + 붙이기
                                    </button>
                                  </div>
                                )}

                                {suggestion.subtext && (
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-zinc-300">
                                      <span className="text-violet-300 mr-1.5">[이면]</span>
                                      {suggestion.subtext}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateScene(sKey, {
                                          subtext: sc.subtext?.trim()
                                            ? `${sc.subtext.trim()} / ${suggestion.subtext}`
                                            : suggestion.subtext,
                                        })
                                      }
                                      className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-200 hover:border-amber-400 shrink-0"
                                    >
                                      + 붙이기
                                    </button>
                                  </div>
                                )}

                                {suggestion.key_lines.map((kl, kIdx) => (
                                  <div key={kIdx} className="flex items-start justify-between gap-3">
                                    <p className="text-amber-100/90">
                                      <span className="text-amber-400 mr-1.5">[대사]</span>
                                      {kl}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateScene(sKey, {
                                          key_lines: [...(sc.key_lines ?? []), kl],
                                        })
                                      }
                                      className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-200 hover:border-amber-400 shrink-0"
                                    >
                                      + 추가
                                    </button>
                                  </div>
                                ))}

                                {suggestion.anchors.map(([aTag, aBeat], idx) => (
                                  <div key={idx} className="flex items-start justify-between gap-3">
                                    <p className="text-zinc-300">
                                      <span className="text-sky-300 mr-1.5">[{aTag}]</span>
                                      {aBeat}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateScene(sKey, {
                                          anchors: [...sc.anchors, [aTag, aBeat]],
                                        })
                                      }
                                      className="px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-[11px] text-zinc-200 hover:border-amber-400 shrink-0"
                                    >
                                      + 앵커 삽입
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
