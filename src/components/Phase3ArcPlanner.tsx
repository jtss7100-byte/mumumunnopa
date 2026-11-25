import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PLOT_STRUCTURES } from '../data/munpiaReferences';
import type {
  ArcPlan,
  KickEventItem,
  SettingBible,
  WritingRuleProfile,
} from '../types/novelPlanner';
import { analyzeArcWarnings, evaluateThreeQDiagnostics } from '../utils/munpiaEngine';
import { DEFAULT_RULE_PROFILE } from '../utils/ruleProfileEngine';
import { requestDeep3QDiagnosisAI, type Deep3QDiagnosis } from '../services/aiClient';
import { RuleProfileController } from './RuleProfileController';

interface Props {
  arcPlan: ArcPlan | null;
  settingBible: SettingBible | null;
  ruleProfile?: WritingRuleProfile;
  isGeneratingArc: boolean;
  errorMessage: string | null;
  aiEstimatedFields?: string[];
  seriesMemoryText?: string;
  onClearEstimatedField?: (fieldKey: string) => void;
  onChangeRuleProfile?: (next: WritingRuleProfile) => void;
  onChange: (next: ArcPlan) => void;
  onGenerateArcPlan: () => void;
  onOpenBlockInPhase4: (blockIndex: number) => void;
}

export const Phase3ArcPlannerView: React.FC<Props> = ({
  arcPlan,
  settingBible,
  ruleProfile = DEFAULT_RULE_PROFILE,
  isGeneratingArc,
  errorMessage,
  aiEstimatedFields = [],
  seriesMemoryText,
  onClearEstimatedField,
  onChangeRuleProfile,
  onChange,
  onGenerateArcPlan,
  onOpenBlockInPhase4,
}) => {
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
  const [structureTab, setStructureTab] = useState<'500' | '200'>('500');
  const [deepDiag, setDeepDiag] = useState<Deep3QDiagnosis | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const diagnostics = useMemo(
    () => evaluateThreeQDiagnostics(arcPlan, settingBible),
    [arcPlan, settingBible]
  );

  const arcWarnings = useMemo(
    () => analyzeArcWarnings(arcPlan, settingBible, ruleProfile),
    [arcPlan, settingBible, ruleProfile]
  );

  if (!arcPlan) {
    return (
      <div className="py-16 text-center max-w-lg mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-zinc-100">25화(1권) 아크 설계도가 비어 있습니다</h2>
        <p className="text-sm text-zinc-400">
          Phase 2 세팅 바이블을 기반으로 단발 킥이벤트 7~10개, 대서사 필수 이벤트 2~3개, 그리고 5개 블록(1~25화) 배치를 AI가 초안으로 구성합니다.
        </p>
        <button
          type="button"
          onClick={onGenerateArcPlan}
          disabled={isGeneratingArc || !settingBible}
          className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          {isGeneratingArc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>AI 25화 아크 설계 생성</span>
        </button>
      </div>
    );
  }

  const singleCount = arcPlan.kickEvents.filter((k) => k.type === '단발 킥이벤트').length;
  const epicCount = arcPlan.kickEvents.filter((k) => k.type === '대서사 필수').length;
  const passedCount = diagnostics.filter((d) => d.status === '충족').length;

  const handleRunDeep3Q = async () => {
    setDiagError(null);
    setIsDiagnosing(true);
    try {
      const res = await requestDeep3QDiagnosisAI(
        settingBible,
        arcPlan,
        seriesMemoryText,
        ruleProfile
      );
      setDeepDiag(res);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'AI 3-Q 정밀 진단에 실패했습니다.');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const updateKickEvent = (id: string, patch: Partial<KickEventItem>) => {
    onChange({
      ...arcPlan,
      kickEvents: arcPlan.kickEvents.map((k) => (k.id === id ? { ...k, ...patch } : k)),
    });
  };

  const addKickEvent = (type: KickEventItem['type']) => {
    const newItem: KickEventItem = {
      id: `ke-${Date.now()}`,
      type,
      title: type === '단발 킥이벤트' ? '신규 단발 사이다 사건' : '신규 대서사 전환 이벤트',
      summary: '',
      assignedBlockIndex: 0,
      payoffValue: '100원 결제 사이다 포인트',
    };
    onChange({ ...arcPlan, kickEvents: [...arcPlan.kickEvents, newItem] });
  };

  const removeKickEvent = (id: string) => {
    onChange({ ...arcPlan, kickEvents: arcPlan.kickEvents.filter((k) => k.id !== id) });
  };

  const updateBlock = (blockIndex: number, patch: Partial<ArcPlan['blocks'][number]>) => {
    onChange({
      ...arcPlan,
      blocks: arcPlan.blocks.map((b) => (b.blockIndex === blockIndex ? { ...b, ...patch } : b)),
    });
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div className="space-y-1 flex-1">
          <p className="text-xs font-medium text-amber-400 tracking-wide">
            Phase 3 · 킥이벤트 · 25화(1권) 아크 & 3-Q 이야기의 힘 진단
          </p>
          <input
            type="text"
            aria-label="아크 제목"
            value={arcPlan.title}
            onChange={(e) => onChange({ ...arcPlan, title: e.target.value })}
            className="text-2xl font-semibold text-zinc-100 bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-amber-400 focus:outline-none w-full"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums pt-1">
            <span>범위 {arcPlan.epRange}</span>
            <span aria-hidden="true">·</span>
            <span>단발 킥 {singleCount}개 (권장 7~10)</span>
            <span aria-hidden="true">·</span>
            <span>대서사 필수 {epicCount}개 (권장 2~3)</span>
            <span aria-hidden="true">·</span>
            <span className={passedCount === 6 ? 'text-emerald-400' : 'text-amber-300'}>
              3-Q 진단 {passedCount}/6 충족
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onGenerateArcPlan}
            disabled={isGeneratingArc}
            className="px-3.5 py-2.5 text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            {isGeneratingArc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>AI 아크 재생성</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenBlockInPhase4(0)}
            className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
          >
            <span>Phase 4 · 5화 가이드 & 설계도</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Collapsible Plot & Writing Rule Profile Controller (Project Default) */}
      {onChangeRuleProfile && (
        <RuleProfileController
          profile={ruleProfile}
          onChange={onChangeRuleProfile}
          testIdPrefix="phase3-rule-controller"
        />
      )}

      {/* Arc Goal */}
      <div className="space-y-1.5">
        <label htmlFor="arc-goal" className="block text-xs font-medium text-zinc-400">
          1권(1~25화) 아크 핵심 목표 — 25화 유료화 직전까지 달성해야 할 서사적 결론
          {renderEstimatedBadge('arc.arcGoal')}
        </label>
        <textarea
          id="arc-goal"
          rows={2}
          value={arcPlan.arcGoal}
          onChange={(e) => {
            clearEst('arc.arcGoal');
            onChange({ ...arcPlan, arcGoal: e.target.value });
          }}
          className="w-full p-3.5 bg-zinc-900/70 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-400/70"
        />
      </div>

      {/* 01. Live 3-Q 6-Item Automatic Diagnostics */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">01. 3-Q 이야기의 힘 · 6항목 자동 진단</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              킥이벤트 배치, 전환점, 25화 유료화 훅, 인물 낙차를 수정하면 진단 결과가 즉시 재계산됩니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono tabular-nums text-amber-300">
              {passedCount} / 6 항목 충족
            </span>
            <button
              type="button"
              onClick={handleRunDeep3Q}
              disabled={isDiagnosing}
              className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-400/10 border border-amber-400/40 hover:bg-amber-400/20 disabled:opacity-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {isDiagnosing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>AI 3-Q 밀도 정밀 진단</span>
            </button>
          </div>
        </div>

        {diagError && (
          <div role="alert" className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-200">
            {diagError}
          </div>
        )}

        {arcWarnings.length > 0 && (
          <div
            role="status"
            aria-label="문피아 100원 가치 및 도입부 자가 진단 경고"
            className="p-4 bg-amber-950/25 border border-amber-500/40 rounded-xl space-y-2"
          >
            {arcWarnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-amber-300">[{w.severity}] {w.category}</span>
                  <p className="text-zinc-200 leading-relaxed">{w.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {deepDiag && (
          <div className="p-4 bg-zinc-900/80 border border-amber-400/40 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-300">AI 편집자 3-Q 밀도 정밀 리포트</span>
              <button
                type="button"
                onClick={() => setDeepDiag(null)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                닫기
              </button>
            </div>
            <p className="text-zinc-200 leading-relaxed">{deepDiag.overallVerdict}</p>
            <p className="text-emerald-300/90">유료화 전환 평가: {deepDiag.paywallReadiness}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
              <div className="space-y-1">
                <span className="font-semibold text-rose-300">이탈 위험 구간</span>
                <ul className="space-y-1 text-zinc-300">
                  {deepDiag.weakPoints.map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-sky-300">밀도 보강 처방</span>
                <ul className="space-y-1 text-zinc-300">
                  {deepDiag.upgrades.map((u, i) => (
                    <li key={i}>· {u}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {diagnostics.map((item) => {
            const statusColor =
              item.status === '충족'
                ? 'text-emerald-400'
                : item.status === '보완 필요'
                  ? 'text-amber-400'
                  : 'text-rose-400';
            return (
              <div
                key={item.id}
                className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-zinc-400">
                    {item.code} · {item.title}
                  </span>
                  <span className={`font-semibold shrink-0 ${statusColor}`}>
                    {item.status === '충족' && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
                    {item.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">{item.detail}</p>
                {item.status !== '충족' && (
                  <p className="text-xs text-amber-300/80 leading-relaxed pt-1 border-t border-zinc-800/60">
                    처방: {item.actionHint}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <hr className="border-zinc-800/80" />

      {/* 02. 25화 5-Block Arc Board */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">02. 25화(1권) 5블록 배치 보드</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            1~15화 무료 구간(투베 진입)과 16~25화 클라이맥스·유료화 훅의 리듬을 블록 단위로 제어합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {arcPlan.blocks.map((block) => {
            const assigned = arcPlan.kickEvents.filter((k) => k.assignedBlockIndex === block.blockIndex);
            const isPaywallBlock = block.blockIndex === 4;
            const isTobePeak = block.blockIndex === 2;
            return (
              <div
                key={block.blockIndex}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-4 ${
                  isPaywallBlock
                    ? 'bg-amber-950/15 border-amber-500/40'
                    : isTobePeak
                      ? 'bg-zinc-900/80 border-zinc-700'
                      : 'bg-zinc-900/45 border-zinc-800/80'
                }`}
              >
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                      <span className={isPaywallBlock ? 'text-amber-300 font-semibold' : 'text-zinc-400'}>
                        {block.epRange}
                      </span>
                      <span className="text-zinc-500">{assigned.length}건</span>
                    </div>
                    <h3 className="text-base font-semibold text-zinc-100 mt-0.5">{block.label}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{block.role}</p>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`blk-goal-${block.blockIndex}`}
                      className="block text-[11px] text-zinc-400"
                    >
                      블록 목표
                    </label>
                    <textarea
                      id={`blk-goal-${block.blockIndex}`}
                      rows={2}
                      value={block.goal}
                      onChange={(e) => updateBlock(block.blockIndex, { goal: e.target.value })}
                      className="w-full p-2 bg-zinc-950/80 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-amber-400/70"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor={`blk-hook-${block.blockIndex}`}
                      className="block text-[11px] text-amber-300/90"
                    >
                      블록 엔딩 훅{renderEstimatedBadge(`arc.block.${block.blockIndex}.cliffhanger`)}
                    </label>
                    <textarea
                      id={`blk-hook-${block.blockIndex}`}
                      rows={2}
                      value={block.cliffhanger}
                      onChange={(e) => {
                        clearEst(`arc.block.${block.blockIndex}.cliffhanger`);
                        updateBlock(block.blockIndex, { cliffhanger: e.target.value });
                      }}
                      className="w-full p-2 bg-zinc-950/80 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none focus:border-amber-400/70"
                    />
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-zinc-800/70">
                    <span className="block text-[11px] text-zinc-500">배정 킥이벤트</span>
                    {assigned.length === 0 ? (
                      <p className="text-xs text-rose-400/80">배정된 사건 없음</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {assigned.map((ev) => (
                          <li key={ev.id} className="text-xs text-zinc-300 leading-snug">
                            <span
                              className={
                                ev.type === '대서사 필수'
                                  ? 'text-amber-400 font-semibold mr-1'
                                  : 'text-zinc-500 mr-1'
                              }
                            >
                              {ev.type === '대서사 필수' ? '★' : '·'}
                            </span>
                            {ev.title}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenBlockInPhase4(block.blockIndex)}
                  className="w-full py-2 px-3 text-xs font-medium text-zinc-200 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors whitespace-nowrap"
                >
                  {block.epRange} 가이드 열기
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <hr className="border-zinc-800/80" />

      {/* 03. Kick Events Manager Table */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">03. 킥이벤트 목록 (단발 7~10개 · 대서사 2~3개)</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              각 킥이벤트의 블록 배정을 바꾸면 위 5블록 보드와 3-Q 진단 지표가 실시간으로 갱신됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => addKickEvent('단발 킥이벤트')}
              className="px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-lg hover:bg-zinc-800 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>단발 킥 추가</span>
            </button>
            <button
              type="button"
              onClick={() => addKickEvent('대서사 필수')}
              className="px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-400/10 border border-amber-400/40 rounded-lg hover:bg-amber-400/20 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>대서사 필수 추가</span>
            </button>
          </div>
        </div>

        <div className="border border-zinc-800/80 rounded-xl overflow-hidden divide-y divide-zinc-800/70 bg-zinc-900/40">
          {arcPlan.kickEvents.map((ev) => (
            <div
              key={ev.id}
              className="p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center hover:bg-zinc-900/70 transition-colors"
            >
              <div className="lg:col-span-2 flex items-center gap-2">
                <select
                  aria-label={`${ev.title} 유형`}
                  value={ev.type}
                  onChange={(e) =>
                    updateKickEvent(ev.id, { type: e.target.value as KickEventItem['type'] })
                  }
                  className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-200"
                >
                  <option value="단발 킥이벤트">단발 킥이벤트</option>
                  <option value="대서사 필수">대서사 필수</option>
                </select>
              </div>
              <div className="lg:col-span-2">
                <select
                  aria-label={`${ev.title} 블록 배정`}
                  value={ev.assignedBlockIndex}
                  onChange={(e) => updateKickEvent(ev.id, { assignedBlockIndex: Number(e.target.value) })}
                  className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-amber-300"
                >
                  {PLOT_STRUCTURES.arc25Blocks.map((b) => (
                    <option key={b.blockIndex} value={b.blockIndex}>
                      {b.epRange} ({b.label})
                    </option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-3">
                <input
                  type="text"
                  aria-label="킥이벤트 제목"
                  value={ev.title}
                  onChange={(e) => updateKickEvent(ev.id, { title: e.target.value })}
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-medium text-zinc-100"
                />
              </div>
              <div className="lg:col-span-4">
                <input
                  type="text"
                  aria-label="킥이벤트 요약 및 보상"
                  value={ev.summary}
                  onChange={(e) => updateKickEvent(ev.id, { summary: e.target.value })}
                  placeholder="사건 전개 및 100원 카타르시스 요약"
                  className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300"
                />
              </div>
              <div className="lg:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeKickEvent(ev.id)}
                  aria-label={`${ev.title} 삭제`}
                  className="p-1.5 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-zinc-800/80" />

      {/* 04. Long-Form 200 / 500 Structure Reference */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-zinc-200">장기 연재 3막 구조 대응표</h2>
          <div className="flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
            <button
              type="button"
              onClick={() => setStructureTab('500')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                structureTab === '500' ? 'bg-amber-400 text-slate-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              500화 표준 (20권)
            </button>
            <button
              type="button"
              onClick={() => setStructureTab('200')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                structureTab === '200' ? 'bg-amber-400 text-slate-950' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              200화 단축형 (8권)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(structureTab === '500' ? PLOT_STRUCTURES.longForm500 : PLOT_STRUCTURES.shortForm200).map(
            (act, idx) => (
              <div key={idx} className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-100">{act.act}</span>
                  <span className="font-mono text-amber-300 tabular-nums">{act.range}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{act.milestone}</p>
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
};
