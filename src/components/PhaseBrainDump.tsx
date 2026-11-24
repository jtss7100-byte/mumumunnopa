import React, { useMemo, useRef } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  FileCode2,
  GitBranch,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Sparkles,
  Users,
} from 'lucide-react';
import type { BrainDumpReport } from '../types/novelPlanner';
import {
  BRAIN_DUMP_GUIDE_CHIPS,
  extractQuotedLines,
  insertSnippetAtCursor,
} from '../utils/brainDumpEngine';

export type BrainDumpJumpTarget = 'setting' | 'characters' | 'arc' | 'blueprint';

interface Props {
  value: string;
  currentProjectTitle: string;
  report: BrainDumpReport | null;
  remainingEstimatedCount: number;
  isParsing: boolean;
  parsingMode: 'new' | 'merge' | null;
  errorMessage: string | null;
  onChange: (nextText: string) => void;
  onRunParse: (mode: 'new' | 'merge') => void;
  onJumpToTarget: (target: BrainDumpJumpTarget, epNum?: number) => void;
}

export const PhaseBrainDumpView: React.FC<Props> = ({
  value,
  currentProjectTitle,
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

  const detectedQuotes = useMemo(() => extractQuotedLines(value), [value]);
  const charCount = value.trim().length;

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
            주인공 성격, 조연 관계, 세계관 규칙, 중간 사건, 떠오른 명대사(<code className="font-mono text-amber-300">&quot;...&quot;</code>)를 순서 없이 적어두세요. AI가 일괄 세팅한 뒤 틀린 부분만 각 단계에서 고치면 됩니다.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-200 flex items-start gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p>{errorMessage}</p>
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
                disabled={isParsing}
                className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-zinc-400">
            <span className={detectedQuotes.length > 0 ? 'text-amber-300 inline-flex items-center gap-1' : 'inline-flex items-center gap-1'}>
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
          aria-label="아이디어 덤프 자유 입력 노트패드"
          rows={15}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`예시 — 형식 없이 혼잣말처럼 적어보세요.\n\n현대 산업독성학 박사가 사천당가 폐맥 약골 넷째 '당서진' 몸에 빙의한다.\n겉으로는 병약하고 얌전한 공자처럼 굴지만 속으로는 독을 분자 단위로 분석하는 철저한 이과 실리주의자.\n1화에서 삼장로가 보낸 비소 독탕을 마시고 죽어가다 아궁이 참숯(활성탄)으로 현장에서 해독한다.\n"노복. 아궁이에 남은 참숯을 곱게 빻아 오너라. 그리고 미지근한 물 한 동이."\n조연은 처음엔 도련님을 가엽게만 보다가 미친 천재로 오해하고 충성하는 시녀 소연. 5화 안에 독성학 무기랑 소연이 다 나와야 함.\n25화쯤 삼장로 약재고를 화학 반응으로 날려버리고 가주 앞 독왕전에서 이긴 뒤, 황실 밀서를 손에 쥐면서 2권으로 넘어가면 좋겠다.`}
          className="w-full p-5 bg-zinc-900/75 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 leading-relaxed focus:outline-none focus:border-amber-400/70 resize-y min-h-[320px]"
        />

        {/* Execution Mode Actions Bar */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-800/80 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-0.5 text-xs text-zinc-400">
            <p className="text-zinc-200 font-medium">
              큰따옴표(<code className="font-mono text-amber-300">&quot;대사&quot;</code>)로 적은 명대사는 AI가 고치지 않고 회차 설계도 <code className="font-mono text-amber-300">key_lines</code>에 원문 그대로 보존합니다.
            </p>
            <p>
              현재 열린 작품: <span className="text-zinc-200 font-medium">{currentProjectTitle}</span> · 메모에 없는 항목은 AI가 문피아 공식으로 추정해 <span className="text-sky-300 font-medium">AI 추정</span> 배지를 달아둡니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onRunParse('merge')}
              disabled={isParsing || charCount < 10}
              className="px-4 py-2.5 text-sm font-medium text-zinc-100 bg-zinc-950 border border-zinc-700 hover:border-amber-400/60 hover:bg-zinc-900 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              {isParsing && parsingMode === 'merge' ? (
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
              onClick={() => onRunParse('new')}
              disabled={isParsing || charCount < 10}
              className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              {isParsing && parsingMode === 'new' ? (
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
