import React, { useMemo } from 'react';
import { AlertTriangle, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { GENRE_TAGS, HOOK_PATTERNS, MUNPIA_SURVIVAL_CONTEXT, POPULAR_KEYWORDS } from '../data/munpiaReferences';
import type { Phase0Input } from '../types/novelPlanner';
import { analyzeDraftWarnings } from '../utils/munpiaEngine';

interface Props {
  value: Phase0Input;
  hasPhase1: boolean;
  isGenerating: boolean;
  errorMessage: string | null;
  onChange: (next: Phase0Input) => void;
  onRunPreRead: () => void;
  onGoToPhase1: () => void;
}

export const Phase0InputView: React.FC<Props> = ({
  value,
  hasPhase1,
  isGenerating,
  errorMessage,
  onChange,
  onRunPreRead,
  onGoToPhase1,
}) => {
  const charCount = value.rawIdeaOrPrologue.trim().length;
  const warnings = useMemo(
    () => analyzeDraftWarnings(value.rawIdeaOrPrologue, value.selectedGenres),
    [value.rawIdeaOrPrologue, value.selectedGenres]
  );

  const toggleGenre = (genreName: string) => {
    const exists = value.selectedGenres.includes(genreName);
    const next = exists
      ? value.selectedGenres.filter((g) => g !== genreName)
      : [...value.selectedGenres, genreName];
    onChange({ ...value, selectedGenres: next });
  };

  const toggleKeyword = (kw: string) => {
    const exists = value.selectedKeywords.includes(kw);
    const next = exists
      ? value.selectedKeywords.filter((k) => k !== kw)
      : [...value.selectedKeywords, kw];
    onChange({ ...value, selectedKeywords: next });
  };

  const progressPct = Math.min(100, Math.round((charCount / 5000) * 100));

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <p className="text-xs font-medium text-amber-400 tracking-wide mb-1.5">
            Phase 0 · 작품 원안 및 프롤로그 입력
          </p>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            아이디어 메모나 1화 초안을 넣으면 AI가 문피아 기준으로 먼저 구조화합니다
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5">
            빈 설정표를 억지로 채우지 마세요. 짧은 메모나 프롤로그만 입력해도 선읽기(Phase 1)와 선택지 초안을 생성합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasPhase1 && (
            <button
              type="button"
              onClick={onGoToPhase1}
              className="px-4 py-2.5 text-sm font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
            >
              <span>기존 선읽기 보기</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRunPreRead}
            disabled={isGenerating || !value.rawIdeaOrPrologue.trim()}
            className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI 선읽기 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>AI 선읽기 분석 실행</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-200 flex items-start gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-rose-100">AI 선읽기 요청 오류</p>
            <p className="text-rose-200/90 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left 7 cols: Title, Raw Manuscript / Memo, Real-time Munpia Warnings */}
        <div className="xl:col-span-7 space-y-6">
          <div className="space-y-2">
            <label htmlFor="phase0-title" className="block text-sm font-medium text-zinc-200">
              작품 가제
            </label>
            <input
              id="phase0-title"
              type="text"
              value={value.workingTitle}
              onChange={(e) => onChange({ ...value, workingTitle: e.target.value })}
              placeholder="예: 당가의 약골, 독을 해독하다"
              className="w-full px-4 py-2.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400/70 transition-colors"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="phase0-raw" className="block text-sm font-medium text-zinc-200">
                프롤로그 · 1화 초안 · 아이디어 메모
              </label>
              <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono tabular-nums">
                <span>현재 {charCount.toLocaleString()}자</span>
                <span aria-hidden="true">·</span>
                <span className={charCount >= 3000 ? 'text-emerald-400' : 'text-zinc-400'}>
                  N마크 기준 3,000자
                </span>
                <span aria-hidden="true">·</span>
                <span>표준 5,000자</span>
              </div>
            </div>
            <textarea
              id="phase0-raw"
              rows={15}
              value={value.rawIdeaOrPrologue}
              onChange={(e) => onChange({ ...value, rawIdeaOrPrologue: e.target.value })}
              placeholder="작품 아이디어, 시놉시스, 또는 1화 프롤로그 초안을 자유롭게 붙여넣으세요..."
              className="w-full p-4 bg-zinc-900/90 border border-zinc-800 rounded-lg text-sm leading-relaxed text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400/70 transition-colors resize-y"
            />
            {/* Clean 5000-char meter with 3000-char N-mark tick */}
            <div className="pt-1 space-y-1.5">
              <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    charCount >= 3000 ? 'bg-amber-400' : 'bg-zinc-500'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-emerald-400/80"
                  style={{ left: '60%' }}
                  title="투베 N마크 최소 기준 (3,000자)"
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500 font-mono tabular-nums">
                <span>0자</span>
                <span className="text-emerald-400/80">3,000자 (N마크)</span>
                <span>5,000자 (1화 표준)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="phase0-notes" className="block text-sm font-medium text-zinc-200">
              작가 방향성 메모 (금지 사항 · 강조 포인트)
            </label>
            <textarea
              id="phase0-notes"
              rows={3}
              value={value.authorNotes}
              onChange={(e) => onChange({ ...value, authorNotes: e.target.value })}
              placeholder="예: 고구마 구간 없이 3화 안에 첫 반격 완료. 무공 수련 설명 줄이고 사건 위주 전개."
              className="w-full p-3.5 bg-zinc-900/90 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400/70 transition-colors"
            />
          </div>

          {/* Live Munpia Tone & Tempo Self-Diagnostics */}
          <section className="pt-4 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">실시간 문피아 톤 & 템포 자가진단</h2>
              <span className="text-xs text-zinc-400 tabular-nums">
                {warnings.length === 0 ? '특이 경고 없음' : `${warnings.length}건 점검 필요`}
              </span>
            </div>
            {warnings.length === 0 ? (
              <p className="text-sm text-zinc-400 py-2">
                {charCount === 0
                  ? '본문이나 메모를 입력하면 분량, 설명충(Infodump), 라노벨 어투 및 장르 적합도를 실시간 점검합니다.'
                  : '문피아 코어 독자 기준에서 치명적인 톤·템포 경고가 감지되지 않았습니다.'}
              </p>
            ) : (
              <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-lg bg-zinc-900/50">
                {warnings.map((w, idx) => (
                  <div key={idx} className="p-3.5 flex items-start gap-3">
                    <span
                      className={`text-xs font-semibold shrink-0 mt-0.5 ${
                        w.severity === '경고'
                          ? 'text-rose-400'
                          : w.severity === '주의'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                      }`}
                    >
                      [{w.severity}]
                    </span>
                    <div className="text-sm">
                      <span className="font-medium text-zinc-200">{w.category}</span>
                      <span className="mx-2 text-zinc-600">·</span>
                      <span className="text-zinc-400">{w.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 5 cols: Genre, Keywords, 1화 Hook Selector, Volume Plan */}
        <div className="xl:col-span-5 space-y-6 bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5">
          {/* Volume Plan */}
          <div className="space-y-2.5">
            <span className="block text-sm font-medium text-zinc-200">연재 볼륨 전략</span>
            <div className="grid grid-cols-2 gap-2">
              {(['500화 표준 3막 (20권)', '200화 단축형 (8권)'] as const).map((plan) => {
                const active = value.targetVolumePlan === plan;
                return (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => onChange({ ...value, targetVolumePlan: plan })}
                    className={`px-3 py-2.5 text-xs font-medium rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-amber-400/10 border-amber-400/70 text-amber-300'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {plan}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-zinc-500">
              {MUNPIA_SURVIVAL_CONTEXT.longFormDistribution.exclusiveMilestone}
            </p>
          </div>

          <hr className="border-zinc-800/80" />

          {/* Genre Selection */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">주력 장르 선택 (복수 가능)</span>
              <span className="text-xs text-zinc-500 tabular-nums">{value.selectedGenres.length}개 선택</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_TAGS.map((g) => {
                const selected = value.selectedGenres.includes(g.name);
                const isWarn = g.munpiaAffinity === '비주류 주의';
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => toggleGenre(g.name)}
                    title={g.note}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap inline-flex items-center gap-1.5 ${
                      selected
                        ? isWarn
                          ? 'bg-rose-500/15 border-rose-400/70 text-rose-200'
                          : 'bg-amber-400/15 border-amber-400/70 text-amber-200'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {selected && <Check className="w-3 h-3" />}
                    <span>{g.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-zinc-800/80" />

          {/* Popular Keywords */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-200">2024~2026 인기 키워드</span>
              <span className="text-xs text-zinc-500 tabular-nums">{value.selectedKeywords.length}개 선택</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_KEYWORDS.map((kw) => {
                const selected = value.selectedKeywords.includes(kw);
                return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => toggleKeyword(kw)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                      selected
                        ? 'bg-zinc-200 text-slate-950 border-zinc-200'
                        : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {kw}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-zinc-800/80" />

          {/* 1화 Hook Pattern Selector */}
          <div className="space-y-2.5">
            <label htmlFor="phase0-hook" className="block text-sm font-medium text-zinc-200">
              장르별 1화 훅 패턴 레퍼런스
            </label>
            <select
              id="phase0-hook"
              value={value.selectedHookPatternId}
              onChange={(e) => onChange({ ...value, selectedHookPatternId: e.target.value })}
              className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-400/70"
            >
              {HOOK_PATTERNS.map((group) => (
                <optgroup key={group.id} label={group.genre}>
                  {group.variants.map((v) => (
                    <option key={`${group.id}-${v.code}`} value={`${group.id}-${v.code}`}>
                      [{group.genre} {v.code}] {v.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {(() => {
              for (const g of HOOK_PATTERNS) {
                for (const v of g.variants) {
                  if (`${g.id}-${v.code}` === value.selectedHookPatternId) {
                    return (
                      <div className="p-3 bg-zinc-950/80 border border-zinc-800/80 rounded-lg space-y-1 text-xs">
                        <p className="text-zinc-300">
                          <span className="text-zinc-500">구조:</span> {v.structure}
                        </p>
                        <p className="text-amber-300/90">
                          <span className="text-zinc-500">독자 질문:</span> {v.readerQuestion}
                        </p>
                      </div>
                    );
                  }
                }
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
