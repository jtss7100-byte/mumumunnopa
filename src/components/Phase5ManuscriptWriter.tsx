import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileText,
  Layers,
  Loader2,
  Pin,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Square,
  Wand2,
} from 'lucide-react';
import type {
  EpisodeManuscript,
  EpisodeNarrativeBlueprint,
  SettingBible,
  WritingRuleProfile,
} from '../types/novelPlanner';
import {
  PLOT_FRAMEWORK_META,
  RULE_PRESET_META,
  countEnabledRuleToggles,
  normalizeRuleProfile,
} from '../utils/ruleProfileEngine';
import {
  assembleFullManuscriptText,
  buildNextEpisodePrevSummary,
  checkAvoidViolationsInManuscript,
  checkKeyLinesInManuscript,
  computeSceneTargetChars,
  countManuscriptChars,
  createEmptyManuscript,
  formatMunpiaExportText,
  getPreviousScenesContext,
  joinSceneDraftsText,
  upsertSceneDraft,
} from '../utils/manuscriptEngine';
import { writeScene } from '../services/aiClient';
import { RuleProfileController } from './RuleProfileController';

interface Props {
  targetEpNum?: number | null;
  blueprints: Record<number, EpisodeNarrativeBlueprint>;
  manuscripts: Record<number, EpisodeManuscript>;
  settingBible: SettingBible | null;
  projectRuleProfile: WritingRuleProfile;
  episodeRuleOverrides: Record<number, WritingRuleProfile>;
  seriesMemoryText: string;
  onUpdateManuscript: (epNum: number, next: EpisodeManuscript) => void;
  onUpdateEpisodeRuleOverride: (epNum: number, profile: WritingRuleProfile) => void;
  onClearEpisodeRuleOverride: (epNum: number) => void;
  onApplyNextEpisodePrev: (currentEpNum: number, summaryText: string) => void;
  onGoToPhase4: (epNum: number) => void;
  onNotify: (msg: string) => void;
}

export const Phase5ManuscriptWriterView: React.FC<Props> = ({
  targetEpNum = null,
  blueprints,
  manuscripts,
  settingBible,
  projectRuleProfile,
  episodeRuleOverrides,
  seriesMemoryText,
  onUpdateManuscript,
  onUpdateEpisodeRuleOverride,
  onClearEpisodeRuleOverride,
  onApplyNextEpisodePrev,
  onGoToPhase4,
  onNotify,
}) => {
  const availableEpNums = useMemo(
    () =>
      Object.keys(blueprints)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n > 0 && Boolean(blueprints[n]))
        .sort((a, b) => a - b),
    [blueprints]
  );

  const [selectedEpNum, setSelectedEpNum] = useState<number>(
    targetEpNum && blueprints[targetEpNum]
      ? targetEpNum
      : availableEpNums[0] ?? 1
  );

  useEffect(() => {
    if (targetEpNum && blueprints[targetEpNum]) {
      setSelectedEpNum(targetEpNum);
    } else if (availableEpNums.length > 0 && !blueprints[selectedEpNum]) {
      setSelectedEpNum(availableEpNums[0]);
    }
  }, [targetEpNum, availableEpNums, blueprints, selectedEpNum]);

  const activeBlueprint = blueprints[selectedEpNum] ?? null;
  const activeManuscript = useMemo<EpisodeManuscript>(
    () => manuscripts[selectedEpNum] ?? createEmptyManuscript(selectedEpNum, activeBlueprint),
    [manuscripts, selectedEpNum, activeBlueprint]
  );

  const [viewMode, setViewMode] = useState<'scenes' | 'unified'>('scenes');
  const [rulePanelOpen, setRulePanelOpen] = useState<boolean>(false);
  const [expandedGuides, setExpandedGuides] = useState<Record<string, boolean>>({});
  const [revisionInputs, setRevisionInputs] = useState<Record<string, string>>({});

  const [writingSceneId, setWritingSceneId] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    running: boolean;
    currentIndex: number;
    total: number;
    currentSceneName: string;
  } | null>(null);
  const abortBatchRef = useRef<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState<boolean>(false);
  const [prevAppliedNotice, setPrevAppliedNotice] = useState<string | null>(null);

  const targetCharsPerEp = settingBible?.basicInfo.targetCharsPerEp || 5000;
  const isEpisodeOverride = Boolean(episodeRuleOverrides[selectedEpNum]);
  const effectiveRuleProfile = useMemo(
    () => normalizeRuleProfile(episodeRuleOverrides[selectedEpNum] ?? projectRuleProfile),
    [episodeRuleOverrides, selectedEpNum, projectRuleProfile]
  );
  const presetMeta =
    RULE_PRESET_META.find((p) => p.id === effectiveRuleProfile.preset) ?? RULE_PRESET_META[3];
  const frameworkMeta = PLOT_FRAMEWORK_META[effectiveRuleProfile.plotFramework];
  const enabledToggleCount = countEnabledRuleToggles(effectiveRuleProfile);

  const fullText = useMemo(
    () => assembleFullManuscriptText(activeBlueprint, activeManuscript),
    [activeBlueprint, activeManuscript]
  );
  const charCounts = useMemo(() => countManuscriptChars(fullText), [fullText]);
  const progressPct = Math.min(100, Math.round((charCounts.withSpaces / targetCharsPerEp) * 100));
  const nMarkPct = Math.min(100, Math.round((3000 / targetCharsPerEp) * 100));
  const passedNMark = charCounts.withSpaces >= 3000;
  const passedStandard = charCounts.withSpaces >= targetCharsPerEp;

  const keyLineChecks = useMemo(
    () => checkKeyLinesInManuscript(activeBlueprint, fullText),
    [activeBlueprint, fullText]
  );
  const insertedKeyLineCount = keyLineChecks.filter((k) => k.found).length;

  const avoidChecks = useMemo(
    () => checkAvoidViolationsInManuscript(activeBlueprint, fullText),
    [activeBlueprint, fullText]
  );
  const triggeredAvoidCount = avoidChecks.filter((a) => a.triggered).length;

  const isCustomUnified = typeof activeManuscript.customFullText === 'string';

  const handleSceneTextEdit = (sceneId: string, sceneName: string, nextText: string) => {
    const updated = upsertSceneDraft(activeManuscript, sceneId, sceneName, nextText);
    onUpdateManuscript(selectedEpNum, updated);
  };

  const handleUnifiedTextEdit = (nextText: string) => {
    onUpdateManuscript(selectedEpNum, {
      ...activeManuscript,
      title: activeBlueprint?.title || activeManuscript.title,
      customFullText: nextText,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleResetCustomUnified = () => {
    onUpdateManuscript(selectedEpNum, {
      ...activeManuscript,
      customFullText: null,
      updatedAt: new Date().toISOString(),
    });
    onNotify('씬 카드별 원고를 기준으로 통합 본문을 다시 합쳤습니다.');
  };

  const handleStyleMemoChange = (nextMemo: string) => {
    onUpdateManuscript(selectedEpNum, {
      ...activeManuscript,
      styleMemo: nextMemo,
      updatedAt: new Date().toISOString(),
    });
  };

  const runWriteSingleScene = async (
    sceneIdx: number,
    baseManuscript: EpisodeManuscript,
    options?: { revisionNote?: string }
  ): Promise<EpisodeManuscript | null> => {
    if (!activeBlueprint) return null;
    const sc = activeBlueprint.scenes[sceneIdx];
    if (!sc) return null;
    const sid = sc.id || `S${sceneIdx + 1}`;
    const targetChars = computeSceneTargetChars(activeBlueprint, sceneIdx, targetCharsPerEp);
    const prevContext = getPreviousScenesContext(activeBlueprint, baseManuscript, sceneIdx, 1500);
    const currentText = baseManuscript.sceneDrafts[sid]?.text ?? '';

    setWritingSceneId(sid);
    setErrorMsg(null);
    try {
      const result = await writeScene({
        phase2: settingBible,
        blueprint: activeBlueprint,
        sceneIndex: sceneIdx,
        ruleProfile: effectiveRuleProfile,
        seriesMemoryText,
        previousScenesText: prevContext,
        targetChars,
        styleMemo: baseManuscript.styleMemo,
        revisionNote: options?.revisionNote,
        currentSceneText: options?.revisionNote ? currentText : undefined,
      });

      const nextMs = upsertSceneDraft(
        { ...baseManuscript, title: activeBlueprint.title || baseManuscript.title },
        sid,
        sc.name,
        result.text,
        result.summaryLine
      );
      onUpdateManuscript(selectedEpNum, nextMs);
      return nextMs;
    } catch (err) {
      const message = err instanceof Error ? err.message : `${sid} 씬 집필에 실패했습니다.`;
      setErrorMsg(message);
      return null;
    } finally {
      setWritingSceneId(null);
    }
  };

  const handleWriteSingleClick = async (sceneIdx: number) => {
    if (!activeBlueprint || writingSceneId || batchProgress?.running) return;
    const sc = activeBlueprint.scenes[sceneIdx];
    const updated = await runWriteSingleScene(sceneIdx, activeManuscript);
    if (updated && sc) {
      onNotify(`${sc.id || `S${sceneIdx + 1}`} · "${sc.name}" 본문 집필을 완료했습니다.`);
    }
  };

  const handleRewriteSceneClick = async (sceneIdx: number) => {
    if (!activeBlueprint || writingSceneId || batchProgress?.running) return;
    const sc = activeBlueprint.scenes[sceneIdx];
    if (!sc) return;
    const sid = sc.id || `S${sceneIdx + 1}`;
    const note = (revisionInputs[sid] ?? '').trim();
    const currentText = (activeManuscript.sceneDrafts[sid]?.text ?? '').trim();
    if (!note) {
      setErrorMsg(`${sid} 씬의 수정 지시사항을 먼저 입력해 주세요.`);
      return;
    }
    if (!currentText) {
      setErrorMsg(`${sid} 씬에 기존 원고가 없습니다. 먼저 [이 씬 집필]을 실행하거나 초안을 입력해 주세요.`);
      return;
    }
    const updated = await runWriteSingleScene(sceneIdx, activeManuscript, { revisionNote: note });
    if (updated) {
      setRevisionInputs((prev) => ({ ...prev, [sid]: '' }));
      onNotify(`${sid} 씬에 수정 지시를 반영해 재집필했습니다.`);
    }
  };

  const handleSequentialWriteAll = async () => {
    if (!activeBlueprint || writingSceneId || batchProgress?.running) return;
    const total = activeBlueprint.scenes.length;
    if (total === 0) return;

    abortBatchRef.current = false;
    setErrorMsg(null);
    let workingMs = { ...activeManuscript, title: activeBlueprint.title || activeManuscript.title };
    let completedCount = 0;

    for (let i = 0; i < total; i++) {
      if (abortBatchRef.current) {
        onNotify(`전체 순차 집필을 중단했습니다. (${completedCount}/${total}개 씬 저장됨)`);
        break;
      }
      const sc = activeBlueprint.scenes[i];
      setBatchProgress({
        running: true,
        currentIndex: i,
        total,
        currentSceneName: `${sc.id || `S${i + 1}`} · ${sc.name}`,
      });

      const nextMs = await runWriteSingleScene(i, workingMs);
      if (!nextMs) {
        break;
      }
      workingMs = nextMs;
      completedCount++;
    }

    setBatchProgress(null);
    if (!abortBatchRef.current && completedCount === total) {
      onNotify(`${selectedEpNum}화 전체 ${total}개 씬 순차 자동 집필을 완료했습니다.`);
    }
  };

  const handleStopBatch = () => {
    abortBatchRef.current = true;
  };

  const handleCopyMunpiaManuscript = async () => {
    const formatted = formatMunpiaExportText(activeBlueprint, activeManuscript);
    if (!formatted) {
      setErrorMsg('복사할 원고 본문이 아직 없습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(formatted);
      setCopiedFlag(true);
      onNotify(`${selectedEpNum}화 문피아 발행용 원고(${countManuscriptChars(formatted).withSpaces.toLocaleString()}자)를 복사했습니다.`);
      setTimeout(() => setCopiedFlag(false), 2000);
    } catch {
      setViewMode('unified');
      onNotify('클립보드 접근이 제한되어 통합 편집 모드로 전환했습니다. 직접 전체 선택해 복사해 주세요.');
    }
  };

  const handleDownloadTxt = () => {
    const formatted = formatMunpiaExportText(activeBlueprint, activeManuscript);
    if (!formatted) {
      setErrorMsg('다운로드할 원고 본문이 아직 없습니다.');
      return;
    }
    const workName = (settingBible?.title || 'munpia').replace(/[^\w가-힣-]+/g, '_').slice(0, 32);
    const epTitle = (activeBlueprint?.title || `${selectedEpNum}화`).replace(/[^\w가-힣-]+/g, '_').slice(0, 28);
    const content = `${activeBlueprint?.episode || `${selectedEpNum}화`} ${activeBlueprint?.title || ''}\n\n${formatted}\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workName}_ep${selectedEpNum}_${epTitle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`${selectedEpNum}화 원고(.txt)를 내려받았습니다.`);
  };

  const handleApplyPrevToNextEpisode = () => {
    if (!activeBlueprint) return;
    const summary = buildNextEpisodePrevSummary(activeBlueprint, activeManuscript);
    onApplyNextEpisodePrev(selectedEpNum, summary);
    setPrevAppliedNotice(`${selectedEpNum + 1}화 설계도 prev에 반영 완료: "${summary}"`);
    setTimeout(() => setPrevAppliedNotice(null), 5000);
  };

  const handleInsertKeyLineIntoScene = (sceneId: string, sceneName: string, line: string) => {
    const existing = activeManuscript.sceneDrafts[sceneId]?.text ?? '';
    const appended = existing.trim() ? `${existing.trim()}\n\n${line}` : line;
    handleSceneTextEdit(sceneId, sceneName, appended);
    onNotify(`${sceneId} 씬 하단에 원문 대사를 삽입했습니다.`);
  };

  // Empty state if no blueprints exist at all
  if (!activeBlueprint) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Phase 5 · 본문 집필실 (Manuscript Studio)
          </h1>
          <p className="text-sm text-zinc-400">
            Phase 4에서 회차 서사 제어 설계도(Blueprint v2)를 먼저 생성하면, 이곳에서 5,000자 본문을 씬별로 자동 집필·검수·내보내기할 수 있습니다.
          </p>
        </div>

        <div className="p-8 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center space-y-4">
          <BookOpen className="w-8 h-8 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <p className="text-base font-semibold text-zinc-100">아직 준비된 회차 설계도가 없습니다</p>
            <p className="text-xs text-zinc-400">
              Phase 4에서 1화 설계도를 생성하거나, 0단계 아이디어 덤프로 자동 조립한 뒤 다시 방문해 주세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoToPhase4(1)}
            className="px-4 py-2.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Phase 4 회차 설계도로 이동</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Title Row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Phase 5 · 본문 집필실
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            설계도 v2 슬롯(<code className="font-mono text-amber-300">anchors · sensory · subtext · key_lines</code>)과 활성 규칙 프로필을 반영해 5,000자 상업 웹소설 본문을 집필·검수합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onGoToPhase4(selectedEpNum)}
          className="px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span>{selectedEpNum}화 설계도 수정하기</span>
        </button>
      </div>

      {/* Top Control Bar & Munpia Length Gauge */}
      <section
        aria-label="집필 제어 및 분량 계기판"
        className="p-4 sm:p-5 bg-[#0d1017] border border-zinc-800/90 rounded-xl space-y-4"
      >
        {/* Row 1: Episode selector + RuleProfile interactive badge + Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <label htmlFor="phase5-episode-select" className="sr-only">
              집필 회차 선택
            </label>
            <select
              id="phase5-episode-select"
              data-testid="phase5-episode-select"
              value={selectedEpNum}
              onChange={(e) => {
                setSelectedEpNum(Number(e.target.value));
                setErrorMsg(null);
              }}
              disabled={Boolean(batchProgress?.running || writingSceneId)}
              className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-xs sm:text-sm font-semibold text-zinc-100 focus:outline-none focus:border-amber-400/70 max-w-[280px] truncate"
            >
              {availableEpNums.map((ep) => (
                <option key={ep} value={ep}>
                  {ep}화 — {blueprints[ep]?.title || '제목 미정'}
                </option>
              ))}
            </select>

            <button
              type="button"
              data-testid="phase5-rule-badge"
              aria-expanded={rulePanelOpen}
              onClick={() => setRulePanelOpen((v) => !v)}
              className="px-3 py-2 text-xs font-medium text-amber-200 bg-amber-400/12 border border-amber-400/40 hover:bg-amber-400/20 rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <span>
                {presetMeta.emoji} {presetMeta.label}
              </span>
              <span className="text-zinc-500" aria-hidden="true">·</span>
              <span className="hidden sm:inline text-zinc-300">
                {frameworkMeta.label.split('(')[0].trim()}
              </span>
              <span className="font-mono tabular-nums text-[11px] text-amber-300">
                ON {enabledToggleCount}/9
              </span>
              {isEpisodeOverride && (
                <span className="text-[11px] text-sky-300 font-semibold">(개별)</span>
              )}
              {rulePanelOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-amber-300" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-amber-300" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {batchProgress?.running ? (
              <button
                type="button"
                data-testid="phase5-stop-batch"
                onClick={handleStopBatch}
                className="px-3.5 py-2 text-xs font-semibold text-rose-100 bg-rose-600/85 hover:bg-rose-500 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>
                  중단 ({batchProgress.currentIndex + 1}/{batchProgress.total} · {batchProgress.currentSceneName})
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="phase5-write-all"
                disabled={Boolean(writingSceneId)}
                onClick={handleSequentialWriteAll}
                className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>전체 씬 순차 자동 집필</span>
              </button>
            )}

            <button
              type="button"
              data-testid="phase5-copy-munpia"
              onClick={handleCopyMunpiaManuscript}
              className="px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/90 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              {copiedFlag ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{copiedFlag ? '원고 복사됨' : '문피아 발행용 원고 복사'}</span>
            </button>

            <button
              type="button"
              data-testid="phase5-download-txt"
              onClick={handleDownloadTxt}
              className="px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/90 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>.txt 원고 다운로드</span>
            </button>
          </div>
        </div>

        {/* Collapsible Rule Profile Controller (triggered by clicking the RuleProfile badge) */}
        {rulePanelOpen && (
          <div className="pt-1">
            <RuleProfileController
              profile={effectiveRuleProfile}
              episodeNumber={selectedEpNum}
              isEpisodeOverride={isEpisodeOverride}
              defaultOpen={true}
              onToggleEpisodeOverride={(useOverride) => {
                if (useOverride) {
                  onUpdateEpisodeRuleOverride(selectedEpNum, normalizeRuleProfile(projectRuleProfile));
                } else {
                  onClearEpisodeRuleOverride(selectedEpNum);
                }
              }}
              onResetEpisodeOverride={() => onClearEpisodeRuleOverride(selectedEpNum)}
              onChange={(nextProfile) => onUpdateEpisodeRuleOverride(selectedEpNum, nextProfile)}
              testIdPrefix="phase5-rule-controller"
            />
          </div>
        )}

        {/* Row 2: Real-Time Munpia Character Count Gauge */}
        <div className="p-3.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
              <span data-testid="phase5-chars-with-spaces" className="text-zinc-100 font-semibold">
                공백 포함 {charCounts.withSpaces.toLocaleString()}자
              </span>
              <span className="text-zinc-600" aria-hidden="true">/</span>
              <span data-testid="phase5-chars-no-spaces" className="text-zinc-400">
                공백 제외 {charCounts.noSpaces.toLocaleString()}자
              </span>
              <span className="text-zinc-600" aria-hidden="true">·</span>
              <span className="text-amber-300">
                표준 목표({targetCharsPerEp.toLocaleString()}자) {progressPct}%
              </span>
            </div>

            <div className="flex items-center gap-3 text-[11px]">
              <span className={passedNMark ? 'text-emerald-400 font-medium' : 'text-zinc-500'}>
                {passedNMark ? 'N마크(3,000자) 충족' : `N마크까지 ${(3000 - charCounts.withSpaces).toLocaleString()}자`}
              </span>
              <span className="text-zinc-700" aria-hidden="true">|</span>
              <span className={passedStandard ? 'text-amber-300 font-medium' : 'text-zinc-500'}>
                {passedStandard
                  ? '문피아 5,000자 표준 달성'
                  : `표준 목표까지 ${(targetCharsPerEp - charCounts.withSpaces).toLocaleString()}자`}
              </span>
            </div>
          </div>

          <div className="relative h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div
              data-testid="phase5-progress-fill"
              className={`h-full transition-all duration-200 ${
                passedStandard
                  ? 'bg-emerald-400'
                  : passedNMark
                    ? 'bg-amber-400'
                    : 'bg-sky-400'
              }`}
              style={{ width: `${progressPct}%` }}
            />
            {/* N-mark 3,000자 threshold marker */}
            <div
              title="문피아 N마크 최소 기준 (3,000자)"
              className="absolute top-0 bottom-0 w-0.5 bg-zinc-200/80"
              style={{ left: `${nMarkPct}%` }}
            />
          </div>
        </div>

        {/* Row 3: Author Style Memo + View Mode Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <label
              htmlFor="phase5-style-memo"
              className="text-xs font-medium text-zinc-400 whitespace-nowrap shrink-0"
            >
              문체 추가 지시
            </label>
            <input
              id="phase5-style-memo"
              data-testid="phase5-style-memo"
              type="text"
              value={activeManuscript.styleMemo}
              onChange={(e) => handleStyleMemoChange(e.target.value)}
              placeholder='예: 건조한 하드보일드 톤, 1인칭 반말 독백, 대사 호흡을 짧고 날카롭게'
              className="flex-1 min-w-0 px-3 py-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
            />
          </div>

          <div
            role="tablist"
            aria-label="집필실 보기 모드"
            className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg shrink-0 self-start md:self-auto"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'scenes'}
              data-testid="phase5-mode-scenes"
              onClick={() => setViewMode('scenes')}
              className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap inline-flex items-center gap-1.5 ${
                viewMode === 'scenes'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'bg-transparent text-zinc-400 font-medium hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>씬 카드별 정밀 집필</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'unified'}
              data-testid="phase5-mode-unified"
              onClick={() => setViewMode('unified')}
              className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap inline-flex items-center gap-1.5 ${
                viewMode === 'unified'
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'bg-transparent text-zinc-400 font-medium hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>통합 원고 읽기/편집</span>
            </button>
          </div>
        </div>

        {/* Inline Error Alert */}
        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start justify-between gap-2"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-rose-300 hover:text-rose-100 text-[11px] shrink-0"
            >
              닫기
            </button>
          </div>
        )}
      </section>

      {/* Main 2-Column Workspace: Editor (Left 8 cols) + Real-time QA Sidebar (Right 4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left/Main Editor Column */}
        <div className="xl:col-span-8 space-y-4">
          {viewMode === 'scenes' ? (
            <>
              {isCustomUnified && (
                <div className="p-3 bg-sky-950/30 border border-sky-500/35 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-sky-200">
                  <span>
                    통합 원고 모드에서 직접 수정한 본문이 활성 상태입니다. 아래 씬 카드를 수정하거나 다시 집필하면 씬 카드 합본 기준으로 자동 동기화됩니다.
                  </span>
                  <button
                    type="button"
                    onClick={handleResetCustomUnified}
                    className="px-2.5 py-1 text-[11px] font-medium bg-zinc-900 border border-sky-400/40 hover:bg-zinc-800 rounded-md inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>씬 기준으로 동기화</span>
                  </button>
                </div>
              )}

              {activeBlueprint.scenes.map((scene, idx) => {
                const sid = scene.id || `S${idx + 1}`;
                const draft = activeManuscript.sceneDrafts[sid];
                const draftText = draft?.text ?? '';
                const sceneCounts = countManuscriptChars(draftText);
                const targetChars = computeSceneTargetChars(activeBlueprint, idx, targetCharsPerEp);
                const scenePct = targetChars > 0 ? Math.min(100, Math.round((sceneCounts.withSpaces / targetChars) * 100)) : 0;
                const isGuideOpen = Boolean(expandedGuides[sid]);
                const isWritingThis = writingSceneId === sid;
                const isWinScene = Boolean(
                  (activeBlueprint.win.scene_id && activeBlueprint.win.scene_id === sid) ||
                    activeBlueprint.win.scene === scene.name
                );

                return (
                  <article
                    key={sid}
                    data-testid={`phase5-scene-card-${sid}`}
                    className="bg-[#0d1017] border border-zinc-800/90 rounded-xl overflow-hidden"
                  >
                    {/* Scene Card Header */}
                    <div className="px-4 py-3.5 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/40">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-amber-400">{sid}</span>
                          <h2 className="text-sm font-semibold text-zinc-100 truncate">
                            {scene.name}
                          </h2>
                          {isWinScene && (
                            <span className="text-[11px] font-medium text-emerald-300">
                              · 핵심 보상 씬{activeBlueprint.win.stretch ? ' (Showing 확장)' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 font-mono tabular-nums">
                          <span>현재 {sceneCounts.withSpaces.toLocaleString()}자</span>
                          <span aria-hidden="true">/</span>
                          <span>목표 약 {targetChars.toLocaleString()}자 ({scenePct}%)</span>
                          <span aria-hidden="true">·</span>
                          <span>긴장도 {scene.tension}/5</span>
                          {scene.cast.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-sans text-zinc-400">
                                {scene.cast.join(', ')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          aria-expanded={isGuideOpen}
                          onClick={() =>
                            setExpandedGuides((prev) => ({ ...prev, [sid]: !prev[sid] }))
                          }
                          className="px-2.5 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          {isGuideOpen ? (
                            <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
                          )}
                          <span>설계도 요약</span>
                        </button>

                        <button
                          type="button"
                          data-testid={`phase5-write-scene-${sid}`}
                          disabled={Boolean(writingSceneId || batchProgress?.running)}
                          onClick={() => handleWriteSingleClick(idx)}
                          className="px-3 py-1.5 text-xs font-semibold text-amber-200 bg-amber-400/15 border border-amber-400/45 hover:bg-amber-400/25 disabled:opacity-45 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                        >
                          {isWritingThis ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                              <span>집필 중...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>이 씬 집필</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Blueprint Summary Drawer */}
                    {isGuideOpen && (
                      <div className="px-4 py-3.5 bg-zinc-950/65 border-b border-zinc-800/80 space-y-3 text-xs">
                        {scene.note && (
                          <div>
                            <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
                              연출 메모
                            </span>
                            <p className="text-zinc-300 leading-relaxed">{scene.note}</p>
                          </div>
                        )}

                        {scene.anchors.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-medium text-zinc-500 block">
                              전개 앵커 비트 ({scene.anchors.length})
                            </span>
                            <ul className="space-y-1">
                              {scene.anchors.map(([tag, beat], aIdx) => (
                                <li key={`${sid}-a-${aIdx}`} className="flex items-start gap-2 text-zinc-300">
                                  <span className="font-mono text-[11px] text-amber-300 shrink-0">
                                    [{tag}]
                                  </span>
                                  <span className="leading-snug">{beat}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {scene.sensory && (
                            <div>
                              <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
                                감각 앵커 (sensory)
                              </span>
                              <p className="text-zinc-300 leading-relaxed">{scene.sensory}</p>
                            </div>
                          )}
                          {scene.subtext && (
                            <div>
                              <span className="text-[11px] font-medium text-zinc-500 block mb-0.5">
                                이면 심리 (subtext)
                              </span>
                              <p className="text-zinc-300 leading-relaxed">{scene.subtext}</p>
                            </div>
                          )}
                        </div>

                        {(scene.key_lines ?? []).filter((k) => k.trim()).length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[11px] font-medium text-amber-300/90 block">
                              원문 필수 대사/독백 (key_lines)
                            </span>
                            <ul className="space-y-1">
                              {(scene.key_lines ?? [])
                                .filter((k) => k.trim())
                                .map((kl, kIdx) => (
                                  <li
                                    key={`${sid}-kl-ref-${kIdx}`}
                                    className="text-zinc-200 bg-zinc-900/80 border border-zinc-800 rounded px-2.5 py-1.5 leading-snug"
                                  >
                                    {kl}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Direct Scene Textarea Editor */}
                    <div className="p-4 space-y-3">
                      <label htmlFor={`scene-editor-${sid}`} className="sr-only">
                        {sid} {scene.name} 본문 원고
                      </label>
                      <textarea
                        id={`scene-editor-${sid}`}
                        data-testid={`phase5-scene-textarea-${sid}`}
                        value={draftText}
                        onChange={(e) => handleSceneTextEdit(sid, scene.name, e.target.value)}
                        rows={Math.max(8, Math.min(20, Math.ceil(draftText.length / 85) + 2))}
                        placeholder={`[${sid} · ${scene.name}] 상단 '이 씬 집필' 버튼을 눌러 AI로 생성하거나 직접 본문을 작성하세요. (목표 약 ${targetChars.toLocaleString()}자)`}
                        className="w-full px-4 py-3.5 bg-zinc-950/80 border border-zinc-800/90 rounded-lg text-[15px] text-zinc-100 leading-[1.85] placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 resize-y"
                      />

                      {/* Single-line Revision Input + Rewrite Button */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <label htmlFor={`revision-input-${sid}`} className="sr-only">
                          {sid} 씬 수정 지시 입력
                        </label>
                        <input
                          id={`revision-input-${sid}`}
                          data-testid={`phase5-revision-input-${sid}`}
                          type="text"
                          value={revisionInputs[sid] ?? ''}
                          onChange={(e) =>
                            setRevisionInputs((prev) => ({ ...prev, [sid]: e.target.value }))
                          }
                          placeholder="한 줄 수정 지시 예: 노복의 경악 리액션을 더 절박하게 늘리고, 마지막 문장을 더 짧게 끊어줘"
                          className="flex-1 min-w-0 px-3 py-2 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
                        />
                        <button
                          type="button"
                          data-testid={`phase5-rewrite-scene-${sid}`}
                          disabled={
                            Boolean(writingSceneId || batchProgress?.running) ||
                            !draftText.trim() ||
                            !(revisionInputs[sid] ?? '').trim()
                          }
                          onClick={() => handleRewriteSceneClick(idx)}
                          className="px-3 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 disabled:opacity-40 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                          <span>수정 반영 재집필</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </>
          ) : (
            /* Unified Mobile Webnovel Reader / Editor Mode */
            <section
              aria-label="통합 원고 읽기 및 편집"
              className="bg-[#0d1017] border border-zinc-800/90 rounded-xl p-5 sm:p-8 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-zinc-800/80">
                <div>
                  <h2 className="text-base font-semibold text-zinc-100">
                    {activeBlueprint.episode} {activeBlueprint.title} — 모바일 뷰어 통합 편집
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    문피아 모바일 독자 화면 폭(560px) 기준으로 호흡과 줄바꿈을 검수하며 직접 다듬을 수 있습니다.
                  </p>
                </div>
                {isCustomUnified && (
                  <button
                    type="button"
                    onClick={handleResetCustomUnified}
                    className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>씬 원고 기준으로 다시 합치기</span>
                  </button>
                )}
              </div>

              <div className="max-w-[560px] mx-auto space-y-3">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono tabular-nums">
                  <span>{settingBible?.title || '작품 원고'} · {activeBlueprint.episode}</span>
                  <span>
                    {charCounts.withSpaces.toLocaleString()}자 (공백 제외 {charCounts.noSpaces.toLocaleString()}자)
                  </span>
                </div>
                <label htmlFor="phase5-unified-editor" className="sr-only">
                  통합 원고 본문 편집기
                </label>
                <textarea
                  id="phase5-unified-editor"
                  data-testid="phase5-unified-textarea"
                  value={isCustomUnified ? activeManuscript.customFullText ?? '' : joinSceneDraftsText(activeBlueprint, activeManuscript)}
                  onChange={(e) => handleUnifiedTextEdit(e.target.value)}
                  rows={28}
                  placeholder="아직 집필된 본문이 없습니다. 씬 카드별 모드에서 자동 집필하거나 이곳에 직접 본문을 작성하세요."
                  className="w-full px-5 py-6 bg-[#10131c] border border-zinc-800 rounded-xl text-[16px] text-zinc-100 leading-[1.95] tracking-[0.01em] placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/60 resize-y"
                />
              </div>
            </section>
          )}
        </div>

        {/* Right Auto-QA Sidebar (Real-time Local Verification) */}
        <aside
          aria-label="자동 원고 검수 사이드바"
          className="xl:col-span-4 space-y-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto xl:pr-1"
        >
          {/* 1. key_lines Verbatim Insertion Checker */}
          <section
            data-testid="phase5-qa-keylines"
            className="p-4 bg-[#0d1017] border border-zinc-800/90 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                <h2 className="text-sm font-semibold text-zinc-100">
                  key_lines 원문 삽입 체크
                </h2>
              </div>
              <span className="text-xs font-mono tabular-nums text-zinc-300">
                {insertedKeyLineCount}/{keyLineChecks.length}
              </span>
            </div>

            {keyLineChecks.length === 0 ? (
              <p className="text-xs text-zinc-500">
                현재 회차 설계도에 등록된 <code className="font-mono">key_lines</code> 원문 대사가 없습니다.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {keyLineChecks.map((item) => (
                  <li
                    key={item.id}
                    data-testid={`phase5-keyline-${item.id}`}
                    className={`p-3 rounded-lg border text-xs space-y-2 ${
                      item.found
                        ? 'bg-emerald-950/20 border-emerald-500/35'
                        : 'bg-amber-950/20 border-amber-500/35'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-zinc-400 truncate">
                        {item.sceneId} · {item.sceneName}
                      </span>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                          item.found ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {item.found ? '✅ 삽입됨' : '⚠️ 누락됨'}
                      </span>
                    </div>
                    <p className="text-zinc-200 leading-relaxed break-words">{item.line}</p>
                    {!item.found && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            handleInsertKeyLineIntoScene(item.sceneId, item.sceneName, item.line)
                          }
                          className="text-[11px] text-amber-300 hover:text-amber-200 underline underline-offset-2"
                        >
                          {item.sceneId} 씬 하단에 바로 삽입
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 2. avoid Guardrail Checker */}
          <section
            data-testid="phase5-qa-avoid"
            className="p-4 bg-[#0d1017] border border-zinc-800/90 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {triggeredAvoidCount > 0 ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
                <h2 className="text-sm font-semibold text-zinc-100">avoid 금지선 체크</h2>
              </div>
              <span
                className={`text-xs font-mono tabular-nums ${
                  triggeredAvoidCount > 0 ? 'text-rose-300' : 'text-emerald-400'
                }`}
              >
                {triggeredAvoidCount > 0 ? `주의 ${triggeredAvoidCount}건` : '위반 없음'}
              </span>
            </div>

            {avoidChecks.length === 0 ? (
              <p className="text-xs text-zinc-500">
                현재 설계도에 등록된 <code className="font-mono">avoid</code> 금지선 항목이 없습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {avoidChecks.map((item) => (
                  <li
                    key={item.id}
                    data-testid={`phase5-avoid-${item.id}`}
                    className={`p-3 rounded-lg border text-xs space-y-1 ${
                      item.triggered
                        ? 'bg-rose-950/30 border-rose-500/45 text-rose-100'
                        : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="leading-snug">{item.rule}</span>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${
                          item.triggered ? 'text-rose-300' : 'text-emerald-400'
                        }`}
                      >
                        {item.triggered ? '⚠️ 주의' : '✅ 안전'}
                      </span>
                    </div>
                    {item.triggered && item.reasons.length > 0 && (
                      <p className="text-[11px] text-rose-300/95">
                        감지 사유: {item.reasons.join(' · ')}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 3. Next Episode Continuity (`prev`) Reflection */}
          <section
            aria-label="다음 화 연속성 연결"
            className="p-4 bg-[#0d1017] border border-zinc-800/90 rounded-xl space-y-3"
          >
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-zinc-100">다음 화 연속성 연결</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                완성된 {selectedEpNum}화 원고의 핵심 요약을{' '}
                <span className="text-zinc-200 font-medium">{selectedEpNum + 1}화 설계도</span>의{' '}
                <code className="font-mono text-amber-300">prev</code> 필드에 원클릭으로 반영합니다.
              </p>
            </div>

            <button
              type="button"
              data-testid="phase5-apply-next-prev"
              onClick={handleApplyPrevToNextEpisode}
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-amber-200 bg-amber-400/15 border border-amber-400/50 hover:bg-amber-400/25 rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Pin className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>이 회차 원고로 다음 화 prev 요약 자동 반영</span>
            </button>

            {prevAppliedNotice && (
              <p
                data-testid="phase5-prev-applied-notice"
                className="text-[11px] text-emerald-300 bg-emerald-950/30 border border-emerald-500/35 rounded-lg p-2.5 leading-relaxed"
              >
                {prevAppliedNotice}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};
