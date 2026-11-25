import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileCode2,
  GitBranch,
  HelpCircle,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type {
  BrainDumpAuditResult,
  BrainDumpReport,
  WritingRuleProfile,
} from '../types/novelPlanner';
import {
  appendSupplementToMemo,
  BRAIN_DUMP_GUIDE_CHIPS,
  buildSupplementMemoBlock,
  extractQuotedLines,
  insertSnippetAtCursor,
  normalizeBrainDumpAuditResult,
  type BrainDumpAuditAnswer,
} from '../utils/brainDumpEngine';
import { auditBrainDump } from '../services/aiClient';

export type BrainDumpJumpTarget = 'setting' | 'characters' | 'arc' | 'blueprint';

interface Props {
  value: string;
  currentProjectTitle: string;
  ruleProfile: WritingRuleProfile;
  seriesMemoryText?: string;
  report: BrainDumpReport | null;
  remainingEstimatedCount: number;
  isParsing: boolean;
  parsingMode: 'new' | 'merge' | null;
  errorMessage: string | null;
  onChange: (nextText: string) => void;
  onRunParse: (mode: 'new' | 'merge', memoOverride?: string) => void;
  onJumpToTarget: (target: BrainDumpJumpTarget, epNum?: number) => void;
}

export const PhaseBrainDumpView: React.FC<Props> = ({
  value,
  currentProjectTitle,
  ruleProfile,
  seriesMemoryText,
  report,
  remainingEstimatedCount,
  isParsing,
  parsingMode,
  errorMessage,
  onChange,
  onRunParse,
  onJumpToTarget,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const auditSectionRef = useRef<HTMLElement | null>(null);

  const [autoAuditEnabled, setAutoAuditEnabled] = useState<boolean>(true);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [auditingActionLabel, setAuditingActionLabel] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<BrainDumpAuditResult | null>(null);
  const [pendingMode, setPendingMode] = useState<'new' | 'merge'>('new');
  const [missingAnswers, setMissingAnswers] = useState<Record<string, BrainDumpAuditAnswer>>({});
  const [flagAnswers, setFlagAnswers] = useState<Record<string, BrainDumpAuditAnswer>>({});
  const [supplementHint, setSupplementHint] = useState<string | null>(null);

  const detectedQuotes = useMemo(() => extractQuotedLines(value), [value]);
  const charCount = value.trim().length;
  const isBusy = isParsing || isAuditing;

  const answeredCount = useMemo(() => {
    let count = 0;
    for (const ans of Object.values(missingAnswers)) {
      if (ans.selectedOption?.trim() || ans.customText?.trim()) count += 1;
    }
    for (const ans of Object.values(flagAnswers)) {
      if (ans.selectedOption?.trim() || ans.customText?.trim()) count += 1;
    }
    return count;
  }, [missingAnswers, flagAnswers]);

  const handleInsertChip = (snippet: string) => {
    const el = textareaRef.current;
    const start = el ? el.selectionStart : value.length;
    const end = el ? el.selectionEnd : value.length;
    const { nextText, nextCursorPos } = insertSnippetAtCursor(value, start, end, snippet);
    onChange(nextText);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
    });
  };

  const scrollToAuditCard = () => {
    requestAnimationFrame(() => {
      auditSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const runAuditFlow = async (mode: 'new' | 'merge', proceedOnReady: boolean) => {
    const trimmed = value.trim();
    if (trimmed.length < 5) {
      setAuditError('사전 검수를 진행하려면 아이디어 메모를 최소 5자 이상 입력해 주세요.');
      return;
    }
    setAuditError(null);
    setSupplementHint(null);
    setIsAuditing(true);
    setPendingMode(mode);
    setAuditingActionLabel(
      proceedOnReady
        ? mode === 'new'
          ? '재료 검수 중...'
          : '충돌·재료 검수 중...'
        : '사전 검수 실행 중...'
    );

    try {
      const rawAudit = await auditBrainDump({
        memo: trimmed,
        mode,
        ruleProfile,
        seriesMemoryText: mode === 'merge' ? seriesMemoryText : undefined,
      });
      const normalized = normalizeBrainDumpAuditResult(rawAudit);
      setMissingAnswers({});
      setFlagAnswers({});

      if (proceedOnReady && normalized.status === 'ready') {
        setAuditResult(normalized);
        setIsAuditing(false);
        setAuditingActionLabel(null);
        onRunParse(mode, value);
        return;
      }

      setAuditResult(normalized);
      scrollToAuditCard();
    } catch (err) {
      setAuditError(
        err instanceof Error ? err.message : '아이디어 덤프 사전 검수에 실패했습니다.'
      );
    } finally {
      setIsAuditing(false);
      setAuditingActionLabel(null);
    }
  };

  const handleClickSetup = (mode: 'new' | 'merge') => {
    if (charCount < 10) return;
    if (autoAuditEnabled) {
      void runAuditFlow(mode, true);
    } else {
      setAuditError(null);
      setAuditResult(null);
      onRunParse(mode, value);
    }
  };

  const handleManualAudit = () => {
    if (charCount < 5) return;
    void runAuditFlow(pendingMode, false);
  };

  const toggleMissingOption = (itemId: string, option: string) => {
    setSupplementHint(null);
    setMissingAnswers((prev) => {
      const current = prev[itemId] ?? {};
      const nextSelected = current.selectedOption === option ? undefined : option;
      return {
        ...prev,
        [itemId]: { ...current, selectedOption: nextSelected },
      };
    });
  };

  const updateMissingCustom = (itemId: string, customText: string) => {
    setSupplementHint(null);
    setMissingAnswers((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), customText },
    }));
  };

  const toggleFlagOption = (flagId: string, suggestion: string) => {
    setSupplementHint(null);
    setFlagAnswers((prev) => {
      const current = prev[flagId] ?? {};
      const nextSelected = current.selectedOption === suggestion ? undefined : suggestion;
      return {
        ...prev,
        [flagId]: { ...current, selectedOption: nextSelected },
      };
    });
  };

  const updateFlagCustom = (flagId: string, customText: string) => {
    setSupplementHint(null);
    setFlagAnswers((prev) => ({
      ...prev,
      [flagId]: { ...(prev[flagId] ?? {}), customText },
    }));
  };

  const handleApplySupplementsAndRun = () => {
    if (!auditResult) return;
    const block = buildSupplementMemoBlock(auditResult, missingAnswers, flagAnswers);
    if (!block) {
      setSupplementHint(
        '반영할 보충 선택지나 직접 입력 내용이 없습니다. 위 항목을 1개 이상 선택/입력하거나 오른쪽 [경고 무시하고 이대로 강행하기]를 눌러 주세요.'
      );
      return;
    }
    const nextMemo = appendSupplementToMemo(value, block);
    onChange(nextMemo);
    setAuditResult(null);
    setMissingAnswers({});
    setFlagAnswers({});
    setSupplementHint(null);
    onRunParse(pendingMode, nextMemo);
  };

  const handleForceProceed = () => {
    setAuditResult(null);
    setSupplementHint(null);
    onRunParse(pendingMode, value);
  };

  const combinedError = auditError || errorMessage;

  const statusMeta = auditResult
    ? auditResult.status === 'warning'
      ? {
          badge: '🔴 부적절·위험 요소 감지',
          borderClass: 'border-rose-500/45',
          badgeClass: 'bg-rose-950/60 border-rose-500/50 text-rose-200',
          barClass: 'bg-rose-400',
          scoreTextClass: 'text-rose-300',
        }
      : auditResult.status === 'needs_more'
        ? {
            badge: '🟡 재료 보충 권장',
            borderClass: 'border-amber-400/45',
            badgeClass: 'bg-amber-950/60 border-amber-400/50 text-amber-200',
            barClass: 'bg-amber-400',
            scoreTextClass: 'text-amber-300',
          }
        : {
            badge: '🟢 재료 충분 · 바로 세팅 가능',
            borderClass: 'border-emerald-500/40',
            badgeClass: 'bg-emerald-950/60 border-emerald-500/45 text-emerald-200',
            barClass: 'bg-emerald-400',
            scoreTextClass: 'text-emerald-300',
          }
    : null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <p className="text-xs font-medium text-amber-400 tracking-wide mb-1.5">
            0단계 · 아이디어 덤프 (Brain Dump 자동 파싱 엔진)
          </p>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            형식 없이 주저리 적어두면 Phase 1~4 전체 설계도에 한 번에 분배됩니다
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5">
            주인공 성격, 조연 관계, 세계관 규칙, 중간 사건, 떠오른 명대사(
            <code className="font-mono text-amber-300">&quot;...&quot;</code>)를 순서 없이 적어두세요. 자동 재료 검수로 빈 축과 설정 모순을 먼저 짚어드린 뒤 일괄 세팅합니다.
          </p>
        </div>
      </div>

      {combinedError && (
        <div
          role="alert"
          className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-200 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p>{combinedError}</p>
          </div>
          {auditError && (
            <button
              type="button"
              onClick={() => setAuditError(null)}
              className="text-xs text-rose-300 hover:text-rose-100 shrink-0"
            >
              닫기
            </button>
          )}
        </div>
      )}

      {/* Freeform Notepad Workspace */}
      <section className="space-y-3" aria-label="아이디어 덤프 자유 입력 노트패드">
        {/* Top helper strip: 4 one-click guide chips + live metrics */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {BRAIN_DUMP_GUIDE_CHIPS.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleInsertChip(chip.snippet)}
                disabled={isBusy}
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-zinc-400">
            <span
              className={
                detectedQuotes.length > 0
                  ? 'text-amber-300 inline-flex items-center gap-1'
                  : 'inline-flex items-center gap-1'
              }
            >
              <MessageSquareQuote className="w-3.5 h-3.5" />
              <span>직필 대사 {detectedQuotes.length}개 감지</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{charCount.toLocaleString()}자</span>
          </div>
        </div>

        {/* Unconstrained Notepad Textarea */}
        <textarea
          ref={textareaRef}
          id="brain-dump-editor"
          data-testid="brain-dump-editor"
          aria-label="아이디어 덤프 자유 입력 노트패드"
          rows={15}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`예시 — 형식 없이 혼잣말처럼 적어보세요.\n\n현대 산업독성학 박사가 사천당가 폐맥 약골 넷째 '당서진' 몸에 빙의한다.\n겉으로는 병약하고 얌전한 공자처럼 굴지만 속으로는 독을 분자 단위로 분석하는 철저한 이과 실리주의자.\n1화에서 삼장로가 보낸 비소 독탕을 마시고 죽어가다 아궁이 참숯(활성탄)으로 현장에서 해독한다.\n"노복. 아궁이에 남은 참숯을 곱게 빻아 오너라. 그리고 미지근한 물 한 동이."\n조연은 처음엔 도련님을 가엽게만 보다가 미친 천재로 오해하고 충성하는 시녀 소연. 5화 안에 독성학 무기랑 소연이 다 나와야 함.\n25화쯤 삼장로 약재고를 화학 반응으로 날려버리고 가주 앞 독왕전에서 이긴 뒤, 황실 밀서를 손에 쥐면서 2권으로 넘어가면 좋겠다.`}
          className="w-full p-5 bg-zinc-900/75 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 leading-relaxed focus:outline-none focus:border-amber-400/70 resize-y min-h-[320px]"
        />

        {/* Execution Mode Actions Bar */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-0.5 text-xs text-zinc-400">
              <p className="text-zinc-200 font-medium">
                큰따옴표(<code className="font-mono text-amber-300">&quot;대사&quot;</code>)로 적은 명대사는 AI가 고치지 않고 회차 설계도{' '}
                <code className="font-mono text-amber-300">key_lines</code>에 원문 그대로 보존합니다.
              </p>
              <p>
                현재 열린 작품: <span className="text-zinc-200 font-medium">{currentProjectTitle}</span> · 메모에 없는 항목은 AI가 문피아 공식으로 추정해{' '}
                <span className="text-sky-300 font-medium">AI 추정</span> 배지를 달아둡니다.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 cursor-pointer select-none whitespace-nowrap self-start lg:self-auto shrink-0">
              <input
                type="checkbox"
                data-testid="brain-dump-auto-audit-toggle"
                checked={autoAuditEnabled}
                onChange={(e) => setAutoAuditEnabled(e.target.checked)}
                disabled={isBusy}
                className="w-3.5 h-3.5 rounded accent-amber-400 cursor-pointer"
              />
              <span>세팅 전 자동 재료 검수 켜기</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/70">
            <button
              type="button"
              data-testid="brain-dump-audit-only"
              onClick={handleManualAudit}
              disabled={isBusy || charCount < 5}
              className="px-3.5 py-2.5 text-sm font-medium text-amber-200 bg-amber-400/10 border border-amber-400/40 hover:bg-amber-400/20 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              {isAuditing && auditingActionLabel === '사전 검수 실행 중...' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>재료 검수 중...</span>
                </>
              ) : (
                <>
                  <SearchCheck className="w-4 h-4 text-amber-300" />
                  <span>재료 부족·적절성 먼저 검수</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="brain-dump-run-merge"
              onClick={() => handleClickSetup('merge')}
              disabled={isBusy || charCount < 10}
              className="px-4 py-2.5 text-sm font-medium text-zinc-100 bg-zinc-950 border border-zinc-700 hover:border-amber-400/60 hover:bg-zinc-900 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              {isAuditing && pendingMode === 'merge' && auditingActionLabel !== '사전 검수 실행 중...' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>충돌·재료 검수 중...</span>
                </>
              ) : isParsing && parsingMode === 'merge' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>현재 작품에 병합 중...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>현재 작품에 내용 병합/추가</span>
                </>
              )}
            </button>

            <button
              type="button"
              data-testid="brain-dump-run-new"
              onClick={() => handleClickSetup('new')}
              disabled={isBusy || charCount < 10}
              className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              {isAuditing && pendingMode === 'new' && auditingActionLabel !== '사전 검수 실행 중...' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>재료 검수 중...</span>
                </>
              ) : isParsing && parsingMode === 'new' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Phase 1~4 전체 자동 세팅 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>새 작품으로 전체 자동 세팅</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Pre-Audit Editorial Gate Report Card */}
      {auditResult && statusMeta && (
        <section
          ref={auditSectionRef}
          data-testid="brain-dump-audit-card"
          aria-label="편집자 사전 검수 리포트 카드"
          className={`p-6 bg-[#0d1017] border ${statusMeta.borderClass} rounded-xl space-y-6`}
        >
          {/* Card Header: Traffic Light Badge + Sufficiency Score + Verdict */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-5 border-b border-zinc-800/80">
            <div className="space-y-2 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  data-testid="audit-status-badge"
                  className={`px-3 py-1 rounded-md border text-xs font-semibold whitespace-nowrap ${statusMeta.badgeClass}`}
                >
                  {statusMeta.badge}
                </span>
                <span className="text-xs text-zinc-400 font-mono">
                  편집자 사전 검수 리포트 ({pendingMode === 'merge' ? '현재 작품 병합 기준' : '신규 작품 생성 기준'})
                </span>
              </div>
              <h2
                data-testid="audit-verdict-summary"
                className="text-base sm:text-lg font-semibold text-zinc-100 leading-snug"
              >
                {auditResult.verdictSummary}
              </h2>
            </div>

            <div className="flex items-start gap-4 shrink-0">
              <div className="min-w-[156px] p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-zinc-400">재료 충실도</span>
                  <span
                    data-testid="audit-sufficiency-score"
                    className={`font-mono font-bold tabular-nums text-sm ${statusMeta.scoreTextClass}`}
                  >
                    {auditResult.sufficiencyScore}/100점
                  </span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${statusMeta.barClass}`}
                    style={{ width: `${auditResult.sufficiencyScore}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAuditResult(null)}
                aria-label="사전 검수 리포트 닫기"
                className="p-1.5 text-zinc-400 hover:text-zinc-100 bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 1. Inappropriate / Risk Flags */}
          {auditResult.inappropriateFlags.length > 0 && (
            <div className="space-y-3" data-testid="audit-flags-section">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-rose-200 inline-flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    부적절·위험 설정 경고 ({auditResult.inappropriateFlags.length}건)
                  </span>
                </h3>
                <span className="text-xs text-zinc-400">
                  수정 대안을 클릭하거나 직접 수정 방향을 입력해 반영하세요
                </span>
              </div>

              <div className="space-y-3">
                {auditResult.inappropriateFlags.map((flag) => {
                  const ans = flagAnswers[flag.id] ?? {};
                  const isHigh = flag.severity === 'high';
                  return (
                    <article
                      key={flag.id}
                      data-testid={`audit-flag-${flag.id}`}
                      className={`p-4 rounded-xl border space-y-3 ${
                        isHigh
                          ? 'bg-rose-950/20 border-rose-500/35'
                          : 'bg-amber-950/15 border-amber-500/30'
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isHigh
                              ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                          }`}
                        >
                          {isHigh ? '심각' : '주의'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-900 border border-zinc-700 text-zinc-200">
                          {flag.issueType}
                        </span>
                      </div>

                      {flag.quotedPart && (
                        <blockquote className="px-3 py-2 rounded-lg bg-zinc-950/80 border-l-2 border-rose-400/70 text-xs text-zinc-300 font-mono leading-relaxed">
                          “{flag.quotedPart}”
                        </blockquote>
                      )}

                      <p className="text-sm text-zinc-200 leading-relaxed">{flag.reason}</p>

                      {flag.fixSuggestions.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-zinc-400">
                            수정 대안 선택 (원클릭):
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {flag.fixSuggestions.map((suggestion, sIdx) => {
                              const selected = ans.selectedOption === suggestion;
                              return (
                                <button
                                  key={`${flag.id}-sug-${sIdx}`}
                                  type="button"
                                  data-testid={`audit-flag-option-${flag.id}-${sIdx}`}
                                  onClick={() => toggleFlagOption(flag.id, suggestion)}
                                  className={`px-3 py-1.5 text-xs rounded-lg border text-left transition-colors ${
                                    selected
                                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                                      : 'bg-zinc-900/90 text-zinc-200 border-zinc-700 hover:border-amber-400/60 hover:text-amber-200'
                                  }`}
                                >
                                  {selected ? '✓ ' : '+ '}
                                  {suggestion}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label htmlFor={`audit-flag-input-${flag.id}`} className="sr-only">
                          {flag.issueType} 직접 수정 방향 입력
                        </label>
                        <input
                          id={`audit-flag-input-${flag.id}`}
                          data-testid={`audit-flag-input-${flag.id}`}
                          type="text"
                          value={ans.customText ?? ''}
                          onChange={(e) => updateFlagCustom(flag.id, e.target.value)}
                          placeholder="직접 수정 방향을 1줄로 입력하세요 (선택 사항)..."
                          className="w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Missing Core Ingredients */}
          {auditResult.missingItems.length > 0 && (
            <div className="space-y-3" data-testid="audit-missing-section">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-amber-200 inline-flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    보충하면 설계도 완성도가 크게 올라가는 재료 ({auditResult.missingItems.length}건)
                  </span>
                </h3>
                <span className="text-xs text-zinc-400">
                  원클릭 선택지나 1줄 직접 입력으로 빈 축을 채우세요
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {auditResult.missingItems.map((item) => {
                  const ans = missingAnswers[item.id] ?? {};
                  return (
                    <article
                      key={item.id}
                      data-testid={`audit-missing-${item.id}`}
                      className="p-4 rounded-xl bg-zinc-950/75 border border-zinc-800/90 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-400/15 border border-amber-400/35 text-amber-200">
                            {item.category}
                          </span>
                          {(ans.selectedOption || ans.customText?.trim()) && (
                            <span className="text-[11px] font-medium text-emerald-400">
                              ✓ 보충 입력됨
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-zinc-100 leading-snug">
                          {item.question}
                        </p>
                        {item.reason && (
                          <p className="text-xs text-zinc-400 leading-relaxed">{item.reason}</p>
                        )}
                      </div>

                      <div className="space-y-2.5 pt-1">
                        {item.quickOptions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {item.quickOptions.map((option, oIdx) => {
                              const selected = ans.selectedOption === option;
                              return (
                                <button
                                  key={`${item.id}-opt-${oIdx}`}
                                  type="button"
                                  data-testid={`audit-missing-option-${item.id}-${oIdx}`}
                                  onClick={() => toggleMissingOption(item.id, option)}
                                  className={`px-2.5 py-1.5 text-xs rounded-lg border text-left transition-colors ${
                                    selected
                                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-semibold'
                                      : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:border-amber-400/60 hover:text-amber-200'
                                  }`}
                                >
                                  {selected ? '✓ ' : '+ '}
                                  {option}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <div>
                          <label htmlFor={`audit-missing-input-${item.id}`} className="sr-only">
                            {item.category} 보충 내용 직접 입력
                          </label>
                          <input
                            id={`audit-missing-input-${item.id}`}
                            data-testid={`audit-missing-input-${item.id}`}
                            type="text"
                            value={ans.customText ?? ''}
                            onChange={(e) => updateMissingCustom(item.id, e.target.value)}
                            placeholder="직접 1줄 보충 입력..."
                            className="w-full px-3 py-2 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/60"
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {supplementHint && (
            <div
              role="status"
              className="px-3.5 py-2.5 rounded-lg bg-amber-950/35 border border-amber-400/40 text-xs text-amber-200"
            >
              {supplementHint}
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-zinc-800/80">
            {auditResult.status === 'ready' ? (
              <>
                <p className="text-xs text-emerald-300 inline-flex items-center gap-1.5">
                  <ClipboardCheck className="w-4 h-4 shrink-0" />
                  <span>핵심 설정과 갈등 재료가 충분합니다. 바로 전체 자동 세팅을 진행할 수 있습니다.</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAuditResult(null);
                      onRunParse('merge', value);
                    }}
                    disabled={isBusy}
                    className="px-3.5 py-2 text-xs font-medium text-zinc-100 bg-zinc-900 border border-zinc-700 hover:border-amber-400/60 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                    <span>현재 작품에 병합 실행</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuditResult(null);
                      onRunParse('new', value);
                    }}
                    disabled={isBusy}
                    className="px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>새 작품으로 전체 자동 세팅 실행</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-zinc-400">
                  선택·입력된 보충/수정 항목:{' '}
                  <span className="font-mono font-semibold text-amber-300">{answeredCount}건</span> · 반영 시 메모 하단에{' '}
                  <code className="font-mono text-zinc-200">[보충·수정 메모]</code>로 자동 추가됩니다.
                </p>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    data-testid="audit-apply-and-run"
                    onClick={handleApplySupplementsAndRun}
                    disabled={isBusy}
                    className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>보충·수정 내용 메모에 반영하고 다시 세팅</span>
                  </button>
                  <button
                    type="button"
                    data-testid="audit-force-proceed"
                    onClick={handleForceProceed}
                    disabled={isBusy}
                    className="px-3.5 py-2.5 text-xs sm:text-sm font-medium text-zinc-200 bg-zinc-900 border border-zinc-700 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>경고 무시하고 이대로 강행하기</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Completion Summary Report Card */}
      {report && (
        <section
          aria-label="아이디어 덤프 자동 파싱 완료 요약 리포트"
          className="p-6 bg-zinc-900/75 border border-emerald-500/35 rounded-xl space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-zinc-800/80">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {report.mode === 'new'
                    ? '새 작품 전체 자동 세팅 완료'
                    : '현재 작품 내용 병합/추가 완료'}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-zinc-100">
                {report.workingTitle} — 자동 분배 결과 리포트
              </h2>
              <p className="text-xs text-zinc-400">
                세팅 문서 완료 · 인물 {report.characterCount}명 등록 · 25화 아크 {report.arcBlockCount}블록 배치 ·{' '}
                {report.blueprintEpisodes.length > 0
                  ? `${report.blueprintEpisodes.map((n) => `${n}화`).join(', ')} 설계도 생성 완료`
                  : '회차 설계도 준비 대기'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
              <span className="px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-amber-300">
                직필 key_lines {report.quotedKeyLinesCount}개 반영
              </span>
              <span className="px-2.5 py-1 rounded-md bg-sky-950/50 border border-sky-500/35 text-sky-300">
                남은 AI 추정 항목 {remainingEstimatedCount}건
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* 1. Setting Bible */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-lg flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                  <BookOpenCheck className="w-4 h-4" />
                  <span>Phase 2 · 세팅 문서</span>
                </div>
                <p className="text-sm font-semibold text-zinc-100">세팅 문서 완료</p>
                <p className="text-xs text-zinc-400">
                  핵심 아이러니, 정보 낙차, 세계관 룰, 로드맵 자동 채움
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToTarget('setting')}
                className="w-full px-3 py-2 text-xs font-medium text-amber-200 bg-amber-400/10 border border-amber-400/35 hover:bg-amber-400/20 rounded-md inline-flex items-center justify-between transition-colors"
              >
                <span>바로 가서 수정하기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 2. Characters */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-lg flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                  <Users className="w-4 h-4" />
                  <span>Phase 2 · 인물표</span>
                </div>
                <p className="text-sm font-semibold text-zinc-100">
                  인물 {report.characterCount}명 등록
                </p>
                <p className="text-xs text-zinc-400">
                  18종 아키타입 매칭 및 겉/속 성격 낙차·관계 변화 반영
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToTarget('characters')}
                className="w-full px-3 py-2 text-xs font-medium text-amber-200 bg-amber-400/10 border border-amber-400/35 hover:bg-amber-400/20 rounded-md inline-flex items-center justify-between transition-colors"
              >
                <span>바로 가서 수정하기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3. 25-Episode Arc */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-lg flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                  <GitBranch className="w-4 h-4" />
                  <span>Phase 3 · 25화 아크</span>
                </div>
                <p className="text-sm font-semibold text-zinc-100">
                  25화 아크 배치 ({report.arcBlockCount}블록 · 킥 {report.kickEventCount}건)
                </p>
                <p className="text-xs text-zinc-400">
                  도입(1~5화) 패 공개 & 25화 유료화 훅까지 배치 완료
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToTarget('arc')}
                className="w-full px-3 py-2 text-xs font-medium text-amber-200 bg-amber-400/10 border border-amber-400/35 hover:bg-amber-400/20 rounded-md inline-flex items-center justify-between transition-colors"
              >
                <span>바로 가서 수정하기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 4. Episode Blueprints */}
            <div className="p-4 bg-zinc-950/70 border border-zinc-800/90 rounded-lg flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
                  <FileCode2 className="w-4 h-4" />
                  <span>Phase 4 · 회차 설계도</span>
                </div>
                <p className="text-sm font-semibold text-zinc-100">
                  {report.blueprintEpisodes.length > 0
                    ? `${report.blueprintEpisodes.map((n) => `${n}화`).join(', ')} 설계도 생성 완료`
                    : '회차 설계도 생성 대기'}
                </p>
                <p className="text-xs text-zinc-400">
                  씬·9종 앵커·감각·서브텍스트·직필 대사 자동 배치
                </p>
              </div>
              {report.blueprintEpisodes.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {report.blueprintEpisodes.map((epNum) => (
                    <button
                      key={epNum}
                      type="button"
                      onClick={() => onJumpToTarget('blueprint', epNum)}
                      className="flex-1 min-w-[110px] px-3 py-2 text-xs font-medium text-amber-200 bg-amber-400/10 border border-amber-400/35 hover:bg-amber-400/20 rounded-md inline-flex items-center justify-between transition-colors whitespace-nowrap"
                    >
                      <span>{epNum}화 수정하기</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onJumpToTarget('blueprint', 1)}
                  className="w-full px-3 py-2 text-xs font-medium text-amber-200 bg-amber-400/10 border border-amber-400/35 hover:bg-amber-400/20 rounded-md inline-flex items-center justify-between transition-colors"
                >
                  <span>바로 가서 수정하기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
