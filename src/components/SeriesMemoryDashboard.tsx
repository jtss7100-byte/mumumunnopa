import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookMarked,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  GitCommitHorizontal,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  formatSeriesMemoryPrompt,
  type SeriesMemorySnapshot,
} from '../utils/seriesMemory';

interface Props {
  memory: SeriesMemorySnapshot;
  onJumpToEpisode: (epNum: number) => void;
  onJumpToSetting: () => void;
}

export const SeriesMemoryDashboardView: React.FC<Props> = ({
  memory,
  onJumpToEpisode,
  onJumpToSetting,
}) => {
  const [termQuery, setTermQuery] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const promptText = useMemo(() => formatSeriesMemoryPrompt(memory), [memory]);

  const filteredTerms = useMemo(() => {
    const q = termQuery.trim().toLowerCase();
    if (!q) return memory.cumulativeTerms;
    return memory.cumulativeTerms.filter(
      (item) =>
        item.term.toLowerCase().includes(q) || item.meaning.toLowerCase().includes(q)
    );
  }, [memory.cumulativeTerms, termQuery]);

  const handleCopyPrompt = async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 1800);
    } catch {
      setShowPromptPreview(true);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <p className="text-xs font-medium text-amber-400 tracking-wide mb-1.5">
            누적 시리즈 바이블 (Series Memory Engine)
          </p>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            {memory.workTitle} — 장기 연재 일관성 메모리 장부
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Phase 2 세팅 바이블과 1화~최신 화 정밀 설계도를 실시간 집계하며, 모든 AI 호출 시 상단에 자동 주입되어 앞 화 설정 충돌을 차단합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPromptPreview((v) => !v)}
            disabled={!promptText}
            className="px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-40 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            {showPromptPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPromptPreview ? 'AI 주입 프롬프트 숨기기' : 'AI 주입 프롬프트 미리보기'}</span>
          </button>
          <button
            type="button"
            onClick={handleCopyPrompt}
            disabled={!promptText}
            className="px-3.5 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedPrompt ? '주입 텍스트 복사됨' : '시리즈 바이블 프롬프트 복사'}</span>
          </button>
        </div>
      </div>

      {/* Live Summary Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1">
          <span className="text-xs text-zinc-400">누적 설계 회차</span>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-zinc-100">
              {memory.latestEpisodeNumber > 0 ? `${memory.latestEpisodeNumber}화` : '0화'}
            </span>
            <span className="text-xs text-zinc-500">설계도 {memory.blueprintCount}건</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1">
          <span className="text-xs text-zinc-400">미회수 복선 장부</span>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-amber-300">
              {memory.unresolvedThreads.length}건
            </span>
            {memory.overdueThreadCount > 0 ? (
              <span className="text-xs text-rose-400 font-medium">
                기한 경과 {memory.overdueThreadCount}건
              </span>
            ) : (
              <span className="text-xs text-emerald-400">기한 정상</span>
            )}
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1">
          <span className="text-xs text-zinc-400">인물 최신 상태 추적</span>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-zinc-100">
              {memory.latestCharacterStates.length}명
            </span>
            <span className="text-xs text-zinc-500">관계 변화 누적</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-1">
          <span className="text-xs text-zinc-400">확정 고유명사 & 룰</span>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-zinc-100">
              {memory.cumulativeTerms.length}개
            </span>
            <span className="text-xs text-zinc-500">세계관 룰 {memory.worldRules.length}개</span>
          </div>
        </div>
      </div>

      {/* Prompt Preview Drawer */}
      {showPromptPreview && promptText && (
        <section
          aria-label="AI 자동 주입 시리즈 바이블 프롬프트 미리보기"
          className="p-5 bg-zinc-900/80 border border-amber-400/40 rounded-xl space-y-2.5"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI 호출 시 상단에 자동 주입되는 압축 시리즈 바이블 텍스트</span>
            </span>
            <span className="font-mono text-zinc-400 tabular-nums">
              {promptText.length.toLocaleString()}자
            </span>
          </div>
          <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-amber-100/90 whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {promptText}
          </pre>
        </section>
      )}

      {/* 01. Unresolved Threads Ledger */}
      <section className="space-y-4" aria-label="미회수 복선 장부">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 inline-flex items-center gap-2">
              <GitCommitHorizontal className="w-5 h-5 text-amber-400" />
              <span>01. 미회수 복선 장부 (Unresolved Threads)</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              각 회차의 <code className="font-mono text-amber-300">threads.plant</code> 중 아직 <code className="font-mono text-amber-300">threads.payoff</code>에 회수되지 않은 항목만 자동 추출합니다.
            </p>
          </div>
          {memory.resolvedThreads.length > 0 && (
            <span className="text-xs text-emerald-400 inline-flex items-center gap-1 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>회수 완료 {memory.resolvedThreads.length}건</span>
            </span>
          )}
        </div>

        {memory.unresolvedThreads.length === 0 ? (
          <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-sm text-zinc-400">
            미회수 상태인 복선이 없습니다. Phase 4 회차 설계도의 <code className="font-mono text-amber-300">threads.plant</code>에 단서를 등록하면 자동으로 장부에 올라옵니다.
          </div>
        ) : (
          <div className="border border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-800/70 bg-zinc-900/45">
            {memory.unresolvedThreads.map((th) => (
              <div
                key={th.id}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  th.isOverdue ? 'bg-rose-950/20' : 'hover:bg-zinc-900/70'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-amber-300 px-2 py-0.5 bg-zinc-950 border border-zinc-800 rounded tabular-nums">
                      {th.plantedEp}화 매설
                    </span>
                    {th.plantedScene && (
                      <span className="text-zinc-400">씬: {th.plantedScene}</span>
                    )}
                    {th.plannedPayoff && (
                      <span className="font-mono text-sky-300">예정: {th.plannedPayoff}</span>
                    )}
                    {th.isOverdue && (
                      <span
                        data-testid="overdue-thread-badge"
                        className="px-2 py-0.5 text-[11px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/45 rounded inline-flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>회수 기한 경과 (최신 {memory.latestEpisodeNumber}화 돌파)</span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-100 leading-relaxed">{th.what}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpToEpisode(th.plantedEp)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-950 border border-zinc-800 hover:border-amber-400/50 hover:text-amber-200 rounded-lg inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap transition-colors"
                >
                  <span>{th.plantedEp}화 설계도 열기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="border-zinc-800/80" />

      {/* 02. Latest Character States */}
      <section className="space-y-4" aria-label="인물 최신 상태 추적">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 inline-flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>02. 인물 최신 상태 추적 (Latest Character States)</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              1화부터 최신 화까지의 <code className="font-mono text-amber-300">relation (from → to)</code> 변경 이력을 회차순으로 누적해 현재 시점의 최신 관계를 추적합니다.
            </p>
          </div>
        </div>

        {memory.latestCharacterStates.length === 0 ? (
          <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-sm text-zinc-400">
            누적된 인물 관계 변화 기록이 없습니다. Phase 4 설계도의 <code className="font-mono text-amber-300">relation</code> 항목을 채우면 자동으로 인물별 타임라인이 생성됩니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memory.latestCharacterStates.map((st) => (
              <div
                key={st.who}
                className="p-5 bg-zinc-900/55 border border-zinc-800/80 rounded-xl space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-zinc-100">{st.who}</h3>
                      {st.role && (
                        <span className="text-[11px] text-zinc-400">
                          {st.role}
                          {st.archetypeName ? ` · ${st.archetypeName}` : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      현재 최신 상태:{' '}
                      <strong className="text-amber-300 font-semibold">{st.currentStatus}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJumpToEpisode(st.lastUpdatedEp)}
                    className="px-2.5 py-1 text-[11px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 hover:border-amber-400/50 rounded tabular-nums shrink-0"
                  >
                    최신 {st.lastUpdatedEp}화
                  </button>
                </div>

                <div className="pt-2.5 border-t border-zinc-800/70 space-y-1.5">
                  <span className="block text-[11px] text-zinc-500">회차별 관계 변천 이력</span>
                  <ul className="space-y-1 text-xs">
                    {st.history.map((step, idx) => (
                      <li
                        key={`${st.who}-${step.epNum}-${idx}`}
                        className="flex items-center gap-2 text-zinc-300"
                      >
                        <span className="font-mono text-[11px] text-amber-400/90 w-9 shrink-0 tabular-nums">
                          {step.epNum}화
                        </span>
                        <span className="text-zinc-400">{step.from}</span>
                        <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0" />
                        <span className="text-zinc-100 font-medium">{step.to}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <hr className="border-zinc-800/80" />

      {/* 03. Cumulative Glossary & World Rules */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8" aria-label="확정 고유명사 및 세계관 사전">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 inline-flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-amber-400" />
                <span>03. 확정 고유명사 사전 ({memory.cumulativeTerms.length})</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Phase 2 용어 사전과 모든 회차 씬의 <code className="font-mono text-amber-300">terms[]</code>를 중복 제거해 누적 관리합니다.
              </p>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                aria-label="고유명사 검색"
                value={termQuery}
                onChange={(e) => setTermQuery(e.target.value)}
                placeholder="고유명사·설명 검색"
                className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400/70 w-48"
              />
            </div>
          </div>

          {filteredTerms.length === 0 ? (
            <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded-xl text-sm text-zinc-400">
              {termQuery.trim()
                ? `"${termQuery}"와 일치하는 고유명사가 없습니다.`
                : '등록된 고유명사가 아직 없습니다.'}
            </div>
          ) : (
            <div className="border border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-800/70 bg-zinc-900/45">
              {filteredTerms.map((item) => (
                <div
                  key={item.term}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-amber-200">{item.term}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">
                        {item.source}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300">
                      {item.meaning || '회차 씬에서 확정 사용된 고유명사 (Phase 2 사전에서 정의 보강 가능)'}
                    </p>
                  </div>
                  {item.episodes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 shrink-0">
                      {item.episodes.map((ep) => (
                        <button
                          key={ep}
                          type="button"
                          onClick={() => onJumpToEpisode(ep)}
                          className="px-2 py-0.5 text-[11px] font-mono text-zinc-300 bg-zinc-950 border border-zinc-800 hover:border-amber-400/50 rounded tabular-nums"
                        >
                          {ep}화
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-zinc-100">확정 세계관 핵심 룰</h2>
            <button
              type="button"
              onClick={onJumpToSetting}
              className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
            >
              <span>Phase 2에서 편집</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-5 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-3">
            {memory.worldRules.length === 0 ? (
              <p className="text-xs text-zinc-400">
                등록된 세계관 핵심 룰이 없습니다. Phase 2 세팅 바이블에서 규칙을 추가하세요.
              </p>
            ) : (
              <ol className="space-y-2.5 text-sm text-zinc-200">
                {memory.worldRules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs text-amber-400 mt-0.5 shrink-0 tabular-nums">
                      0{idx + 1}
                    </span>
                    <span className="leading-relaxed">{rule}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
