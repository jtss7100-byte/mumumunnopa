import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { PreReadAnalysis } from '../types/novelPlanner';

interface Props {
  analysis: PreReadAnalysis | null;
  hasPhase2: boolean;
  isGeneratingPreRead: boolean;
  isGeneratingSetting: boolean;
  errorMessage: string | null;
  onChange: (next: PreReadAnalysis) => void;
  onReRunPreRead: () => void;
  onGenerateSettingBible: () => void;
  onGoToPhase2: () => void;
}

export const Phase1PreReadView: React.FC<Props> = ({
  analysis,
  hasPhase2,
  isGeneratingPreRead,
  isGeneratingSetting,
  errorMessage,
  onChange,
  onReRunPreRead,
  onGenerateSettingBible,
  onGoToPhase2,
}) => {
  if (!analysis) {
    return (
      <div className="py-16 text-center max-w-lg mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-zinc-100">아직 선읽기 분석 결과가 없습니다</h2>
        <p className="text-sm text-zinc-400">
          Phase 0에서 프롤로그나 아이디어 메모를 입력한 뒤 AI 선읽기 분석을 실행하면 문피아 적합도, 서사 엔진, 미확정 질문 보드가 자동으로 생성됩니다.
        </p>
        <button
          type="button"
          onClick={onReRunPreRead}
          disabled={isGeneratingPreRead}
          className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          {isGeneratingPreRead ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>지금 AI 선읽기 분석 실행</span>
        </button>
      </div>
    );
  }

  const updateQuestion = (qId: string, patch: { selectedOption?: string; customAnswer?: string }) => {
    onChange({
      ...analysis,
      undecidedQuestions: analysis.undecidedQuestions.map((q) =>
        q.id === qId ? { ...q, ...patch } : q
      ),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <p className="text-xs font-medium text-amber-400 tracking-wide mb-1.5">
            Phase 1 · AI 선읽기 진단 & 방향성 확정
          </p>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            AI 분석 초안을 검토하고 미확정 질문 [?]의 방향을 결정하세요
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-2">
            <span>문피아 적합도: <strong className="text-amber-300 font-semibold">{analysis.munpiaFitLevel}</strong></span>
            <span aria-hidden="true">·</span>
            <span>타깃 독자: {analysis.targetReader}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              개그 {analysis.toneRatio.comedy}% / 시리어스 {analysis.toneRatio.serious}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onReRunPreRead}
            disabled={isGeneratingPreRead}
            className="px-3.5 py-2.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            {isGeneratingPreRead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>재분석</span>
          </button>
          {hasPhase2 && (
            <button
              type="button"
              onClick={onGoToPhase2}
              className="px-4 py-2.5 text-sm font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              <span>기존 세팅 바이블</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onGenerateSettingBible}
            disabled={isGeneratingSetting}
            className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
          >
            {isGeneratingSetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>세팅 바이블 생성 중...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>결정 반영 · Phase 2 세팅 생성</span>
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
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Core Diagnosis Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-5">
          <div>
            <label htmlFor="p1-engine" className="block text-xs font-medium text-zinc-400 mb-1.5">
              서사 엔진 한 줄 (직접 수정 가능)
            </label>
            <input
              id="p1-engine"
              type="text"
              value={analysis.narrativeEngineOneLine}
              onChange={(e) => onChange({ ...analysis, narrativeEngineOneLine: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-base font-medium text-amber-200 focus:outline-none focus:border-amber-400/70"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-zinc-800/70">
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-zinc-400">문피아 시장 적합도 평가</h3>
              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.munpiaFitSummary}</p>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-zinc-400">세계관 핵심 룰</h3>
              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.worldCoreRule}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-zinc-800/70">
            <div>
              <span className="block text-xs text-zinc-500 mb-1">주인공 성격</span>
              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.protagonistProfile.personality}</p>
            </div>
            <div>
              <span className="block text-xs text-zinc-500 mb-1">핵심 갈등</span>
              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.protagonistProfile.coreConflict}</p>
            </div>
            <div>
              <span className="block text-xs text-zinc-500 mb-1">근본 욕망</span>
              <p className="text-sm text-zinc-200 leading-relaxed">{analysis.protagonistProfile.desire}</p>
            </div>
          </div>
        </div>

        {/* Right: Genre Mix & Tone Ratio */}
        <div className="p-5 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-5">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">장르 혼합 비율</h3>
            <div className="space-y-2.5">
              {analysis.genreMix.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300">{item.genre}</span>
                    <span className="font-mono tabular-nums text-amber-300">{item.ratio}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400/85" style={{ width: `${Math.min(100, item.ratio)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr className="border-zinc-800/80" />

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-200">개그 : 시리어스 톤 비율</h3>
              <span className="text-xs font-mono tabular-nums text-zinc-300">
                {analysis.toneRatio.comedy} : {analysis.toneRatio.serious}
              </span>
            </div>
            <input
              type="range"
              aria-label="개그 대 시리어스 톤 비율 조절"
              min={0}
              max={100}
              step={5}
              value={analysis.toneRatio.comedy}
              onChange={(e) => {
                const comedy = Number(e.target.value);
                onChange({
                  ...analysis,
                  toneRatio: { ...analysis.toneRatio, comedy, serious: 100 - comedy },
                });
              }}
              className="w-full accent-amber-400"
            />
            <p className="text-xs text-zinc-400 leading-relaxed">{analysis.toneRatio.note}</p>
          </div>
        </div>
      </div>

      {/* Interactive Undecided [?] Questions — Core Principle #1 */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">미확정 설계 질문 [?] — 클릭해 방향을 꺾으세요</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              선택한 답변과 직접 입력한 수정안은 Phase 2 세팅 바이블과 인물표에 즉시 반영됩니다.
            </p>
          </div>
          <span className="text-xs text-zinc-400 font-mono tabular-nums">
            총 {analysis.undecidedQuestions.length}개 결정 포인트
          </span>
        </div>

        <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-xl bg-zinc-900/40">
          {analysis.undecidedQuestions.map((q, qIdx) => (
            <div key={q.id} className="p-5 space-y-3.5">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  <span className="text-amber-400 font-mono mr-2">Q{qIdx + 1}.</span>
                  {q.question}
                </p>
                <p className="text-xs text-zinc-400 mt-1">{q.context}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {q.options.map((opt, optIdx) => {
                  const selected = q.selectedOption === opt && !q.customAnswer.trim();
                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => updateQuestion(q.id, { selectedOption: opt, customAnswer: '' })}
                      className={`p-3 text-left text-xs leading-relaxed rounded-lg border transition-colors ${
                        selected
                          ? 'bg-amber-400/12 border-amber-400/70 text-amber-100'
                          : 'bg-zinc-950/70 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              <div>
                <input
                  type="text"
                  aria-label={`질문 ${qIdx + 1} 직접 방향 입력`}
                  value={q.customAnswer}
                  onChange={(e) => updateQuestion(q.id, { customAnswer: e.target.value })}
                  placeholder="위 선택지 대신 작가만의 방향을 직접 입력할 수 있습니다 (입력 시 우선 반영)"
                  className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400/70"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom 3-column insights: 투베 어필 / 25화 훅 후보 / 경고 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">투데이베스트 어필 포인트</h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {analysis.tobeAppealPoints.map((pt, idx) => (
              <li key={idx} className="pb-2 border-b border-zinc-800/60 last:border-b-0 leading-relaxed">
                <span className="text-amber-400 font-mono text-xs mr-2">0{idx + 1}.</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-200">25화 유료화 전환 훅 후보</h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {analysis.ep25HookCandidates.map((hook, idx) => (
              <li key={idx} className="pb-2 border-b border-zinc-800/60 last:border-b-0 leading-relaxed">
                <span className="text-emerald-400 font-mono text-xs mr-2">안 {idx + 1}</span>
                {hook}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-rose-300">문피아 이탈 위험 경고</h3>
          <ul className="space-y-2 text-sm text-zinc-300">
            {analysis.warnings.map((warn, idx) => (
              <li key={idx} className="pb-2 border-b border-zinc-800/60 last:border-b-0 leading-relaxed">
                <span className="text-rose-400 font-mono text-xs mr-2">주의</span>
                {warn}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
