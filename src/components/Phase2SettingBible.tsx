import React from 'react';
import { AlertTriangle, ArrowRight, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { CHARACTER_ARCHETYPES } from '../data/munpiaReferences';
import type { CharacterCard, SettingBible } from '../types/novelPlanner';

interface Props {
  bible: SettingBible | null;
  hasPhase3: boolean;
  isGeneratingSetting: boolean;
  isGeneratingArc: boolean;
  errorMessage: string | null;
  aiEstimatedFields?: string[];
  onClearEstimatedField?: (fieldKey: string) => void;
  onChange: (next: SettingBible) => void;
  onGenerateSettingBible: () => void;
  onGenerateArcPlan: () => void;
  onGoToPhase3: () => void;
}

export const Phase2SettingBibleView: React.FC<Props> = ({
  bible,
  hasPhase3,
  isGeneratingSetting,
  isGeneratingArc,
  errorMessage,
  aiEstimatedFields = [],
  onClearEstimatedField,
  onChange,
  onGenerateSettingBible,
  onGenerateArcPlan,
  onGoToPhase3,
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
  if (!bible) {
    return (
      <div className="py-16 text-center max-w-lg mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-zinc-100">세팅 바이블이 아직 생성되지 않았습니다</h2>
        <p className="text-sm text-zinc-400">
          Phase 1 선읽기와 미확정 질문 결정을 바탕으로 서사 엔진, 세계관 룰, 18종 아키타입 인물표, 스토리 로드맵을 자동 구성합니다.
        </p>
        <button
          type="button"
          onClick={onGenerateSettingBible}
          disabled={isGeneratingSetting}
          className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          {isGeneratingSetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>AI 세팅 바이블 생성</span>
        </button>
      </div>
    );
  }

  const updateCharacter = (id: string, patch: Partial<CharacterCard>) => {
    onChange({
      ...bible,
      characters: bible.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const applyArchetypePreset = (charId: string, archetypeNumber: number) => {
    const preset = CHARACTER_ARCHETYPES.find((a) => a.number === archetypeNumber);
    if (!preset) return;
    clearEst(`char.${charId}.archetype`);
    updateCharacter(charId, {
      role: preset.category,
      archetypeNumber: preset.number,
      archetypeName: preset.name,
      outerPersonality: preset.outerDefault,
      innerPersonality: preset.innerDefault,
      relationshipFlow: preset.relationFlowDefault,
    });
  };

  const addCharacter = () => {
    const preset = CHARACTER_ARCHETYPES[8]; // 밝은 조력자형 기본
    const newChar: CharacterCard = {
      id: `char-${Date.now()}`,
      name: '신규 인물',
      role: preset.category,
      archetypeNumber: preset.number,
      archetypeName: preset.name,
      outerPersonality: preset.outerDefault,
      innerPersonality: preset.innerDefault,
      ability: '',
      relationshipFlow: preset.relationFlowDefault,
      speechNote: '',
    };
    onChange({ ...bible, characters: [...bible.characters, newChar] });
  };

  const removeCharacter = (id: string) => {
    onChange({ ...bible, characters: bible.characters.filter((c) => c.id !== id) });
  };

  const addRule = () => {
    onChange({
      ...bible,
      worldview: { ...bible.worldview, coreRules: [...bible.worldview.coreRules, ''] },
    });
  };

  const addTerm = () => {
    onChange({
      ...bible,
      worldview: {
        ...bible.worldview,
        terminology: [...bible.worldview.terminology, { term: '', meaning: '' }],
      },
    });
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <p className="text-xs font-medium text-amber-400 tracking-wide mb-1.5">
            Phase 2 · 작품 세팅 바이블 (Setting Bible)
          </p>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">{bible.title}</h1>
          <p className="text-sm text-zinc-400 mt-1">{bible.subtitleOrLogline}</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {hasPhase3 && (
            <button
              type="button"
              onClick={onGoToPhase3}
              className="px-4 py-2.5 text-sm font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
            >
              <span>기존 25화 아크 보기</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onGenerateArcPlan}
            disabled={isGeneratingArc}
            className="px-5 py-2.5 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-2"
          >
            {isGeneratingArc ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>25화 아크 설계 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>세팅 확정 · Phase 3 아크 생성</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* 01. 기본 정보 & 서사 엔진 */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">01. 기본 정보 및 서사 엔진</h2>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono tabular-nums">
            <span>시점: {bible.basicInfo.pov}</span>
            <span aria-hidden="true">·</span>
            <span>회당 목표 {bible.basicInfo.targetCharsPerEp.toLocaleString()}자</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="sb-title" className="block text-xs text-zinc-400 mb-1">작품 제목</label>
            <input
              id="sb-title"
              type="text"
              value={bible.title}
              onChange={(e) => onChange({ ...bible, title: e.target.value })}
              className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-400/70"
            />
          </div>
          <div>
            <label htmlFor="sb-pov" className="block text-xs text-zinc-400 mb-1">시점</label>
            <input
              id="sb-pov"
              type="text"
              value={bible.basicInfo.pov}
              onChange={(e) =>
                onChange({ ...bible, basicInfo: { ...bible.basicInfo, pov: e.target.value } })
              }
              className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-400/70"
            />
          </div>
          <div>
            <label htmlFor="sb-chars" className="block text-xs text-zinc-400 mb-1">회당 목표 글자 수 (표준 5,000자)</label>
            <input
              id="sb-chars"
              type="number"
              min={3000}
              max={8000}
              step={250}
              value={bible.basicInfo.targetCharsPerEp}
              onChange={(e) =>
                onChange({
                  ...bible,
                  basicInfo: { ...bible.basicInfo, targetCharsPerEp: Number(e.target.value) || 5000 },
                })
              }
              className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-mono tabular-nums text-zinc-100 focus:outline-none focus:border-amber-400/70"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 bg-zinc-900/50 border border-zinc-800/80 rounded-xl">
          <div className="space-y-1.5">
            <label htmlFor="ne-irony" className="block text-xs font-medium text-amber-300/90">
              핵심 아이러니{renderEstimatedBadge('setting.coreIrony')}
            </label>
            <textarea
              id="ne-irony"
              rows={2}
              value={bible.narrativeEngine.coreIrony}
              onChange={(e) => {
                clearEst('setting.coreIrony');
                onChange({
                  ...bible,
                  narrativeEngine: { ...bible.narrativeEngine, coreIrony: e.target.value },
                });
              }}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-400/70"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ne-gap" className="block text-xs font-medium text-amber-300/90">
              정보 낙차 (독자·주인공 vs 세계){renderEstimatedBadge('setting.infoGap')}
            </label>
            <textarea
              id="ne-gap"
              rows={2}
              value={bible.narrativeEngine.infoGap}
              onChange={(e) => {
                clearEst('setting.infoGap');
                onChange({
                  ...bible,
                  narrativeEngine: { ...bible.narrativeEngine, infoGap: e.target.value },
                });
              }}
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-400/70"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ne-pay" className="block text-xs font-medium text-amber-300/90">100원 편당결제 동력</label>
            <textarea
              id="ne-pay"
              rows={2}
              value={bible.narrativeEngine.payPerEpDriver}
              onChange={(e) =>
                onChange({
                  ...bible,
                  narrativeEngine: { ...bible.narrativeEngine, payPerEpDriver: e.target.value },
                })
              }
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-400/70"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ne-oneline" className="block text-xs font-medium text-amber-300/90">서사 엔진 한 줄 답</label>
            <textarea
              id="ne-oneline"
              rows={2}
              value={bible.narrativeEngine.oneLineAnswer}
              onChange={(e) =>
                onChange({
                  ...bible,
                  narrativeEngine: { ...bible.narrativeEngine, oneLineAnswer: e.target.value },
                })
              }
              className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-400/70"
            />
          </div>
        </div>
      </section>

      <hr className="border-zinc-800/80" />

      {/* 02. 인물표 (18종 아키타입 & 겉/속 성격 낙차) */}
      <section id="setting-characters-section" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">02. 인물표 — 18종 아키타입 · 겉/속 성격 낙차</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              아키타입을 선택하면 겉 성격, 속 성격, 관계 변화 기본값이 자동 적용되며 자유롭게 비틀 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={addCharacter}
            className="px-3.5 py-2 text-xs font-medium text-zinc-200 bg-zinc-900 border border-zinc-700/80 rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>인물 추가</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {bible.characters.map((char) => (
            <div
              key={char.id}
              className="p-5 bg-zinc-900/50 border border-zinc-800/80 rounded-xl space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <input
                    type="text"
                    aria-label="인물 이름"
                    value={char.name}
                    onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                    className="text-base font-semibold bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-amber-400 focus:outline-none text-zinc-100 min-w-0 flex-1"
                  />
                  <span className="text-xs text-zinc-400 shrink-0">{char.role}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCharacter(char.id)}
                  aria-label={`${char.name} 삭제`}
                  className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-zinc-400">
                  <span>아키타입{renderEstimatedBadge(`char.${char.id}.archetype`)}</span>
                </div>
                <select
                  aria-label={`${char.name} 아키타입 선택`}
                  value={char.archetypeNumber}
                  onChange={(e) => applyArchetypePreset(char.id, Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-200 focus:outline-none focus:border-amber-400/70"
                >
                  {CHARACTER_ARCHETYPES.map((a) => (
                    <option key={a.number} value={a.number}>
                      {a.symbol} [{a.category}] {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-zinc-400">
                    겉 성격 (외피){renderEstimatedBadge(`char.${char.id}.personality`)}
                  </span>
                  <textarea
                    rows={2}
                    aria-label={`${char.name} 겉 성격`}
                    value={char.outerPersonality}
                    onChange={(e) => {
                      clearEst(`char.${char.id}.personality`);
                      updateCharacter(char.id, { outerPersonality: e.target.value });
                    }}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 focus:outline-none focus:border-amber-400/70"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-amber-300/90">속 성격 (본심 낙차)</span>
                  <textarea
                    rows={2}
                    aria-label={`${char.name} 속 성격`}
                    value={char.innerPersonality}
                    onChange={(e) => {
                      clearEst(`char.${char.id}.personality`);
                      updateCharacter(char.id, { innerPersonality: e.target.value });
                    }}
                    className="w-full p-2.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 focus:outline-none focus:border-amber-400/70"
                  />
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-zinc-400 block mb-1">핵심 능력 · 무기</span>
                  <input
                    type="text"
                    aria-label={`${char.name} 능력`}
                    value={char.ability}
                    onChange={(e) => updateCharacter(char.id, { ability: e.target.value })}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 focus:outline-none focus:border-amber-400/70"
                  />
                </div>
                <div>
                  <span className="text-zinc-400 block mb-1">
                    관계 변화 흐름{renderEstimatedBadge(`char.${char.id}.relation`)}
                  </span>
                  <input
                    type="text"
                    aria-label={`${char.name} 관계 변화`}
                    value={char.relationshipFlow}
                    onChange={(e) => {
                      clearEst(`char.${char.id}.relation`);
                      updateCharacter(char.id, { relationshipFlow: e.target.value });
                    }}
                    placeholder="예: 경계 → 신뢰 → 동료"
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-amber-200/90 focus:outline-none focus:border-amber-400/70"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-zinc-800/80" />

      {/* 03. 세계관 룰 & 고유명사 사전 */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">
              03. 세계관 핵심 룰{renderEstimatedBadge('setting.worldview')}
            </h2>
            <button
              type="button"
              onClick={addRule}
              className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>룰 추가</span>
            </button>
          </div>
          <div>
            <label htmlFor="wv-era" className="block text-xs text-zinc-400 mb-1">시대 및 주 무대</label>
            <input
              id="wv-era"
              type="text"
              value={bible.worldview.eraAndSetting}
              onChange={(e) => {
                clearEst('setting.worldview');
                onChange({ ...bible, worldview: { ...bible.worldview, eraAndSetting: e.target.value } });
              }}
              className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-amber-400/70"
            />
          </div>
          <div className="space-y-2.5">
            {bible.worldview.coreRules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs font-mono text-zinc-500 mt-2.5 w-6">0{idx + 1}</span>
                <input
                  type="text"
                  aria-label={`세계관 룰 ${idx + 1}`}
                  value={rule}
                  onChange={(e) => {
                    clearEst('setting.worldview');
                    const next = [...bible.worldview.coreRules];
                    next[idx] = e.target.value;
                    onChange({ ...bible, worldview: { ...bible.worldview, coreRules: next } });
                  }}
                  className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-400/70"
                />
                <button
                  type="button"
                  aria-label={`룰 ${idx + 1} 삭제`}
                  onClick={() => {
                    const next = bible.worldview.coreRules.filter((_, i) => i !== idx);
                    onChange({ ...bible, worldview: { ...bible.worldview, coreRules: next } });
                  }}
                  className="p-2 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">특수 용어 · 고유명사 사전</h2>
            <button
              type="button"
              onClick={addTerm}
              className="text-xs text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>용어 추가</span>
            </button>
          </div>
          <div className="border border-zinc-800/80 rounded-xl divide-y divide-zinc-800/80 bg-zinc-900/40">
            {bible.worldview.terminology.map((item, idx) => (
              <div key={idx} className="p-3 grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  aria-label={`용어 ${idx + 1}`}
                  value={item.term}
                  placeholder="고유명사"
                  onChange={(e) => {
                    const next = [...bible.worldview.terminology];
                    next[idx] = { ...next[idx], term: e.target.value };
                    onChange({ ...bible, worldview: { ...bible.worldview, terminology: next } });
                  }}
                  className="col-span-4 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-medium text-amber-200 focus:outline-none focus:border-amber-400/70"
                />
                <input
                  type="text"
                  aria-label={`용어 ${idx + 1} 설명`}
                  value={item.meaning}
                  placeholder="간결한 정의"
                  onChange={(e) => {
                    const next = [...bible.worldview.terminology];
                    next[idx] = { ...next[idx], meaning: e.target.value };
                    onChange({ ...bible, worldview: { ...bible.worldview, terminology: next } });
                  }}
                  className="col-span-7 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-amber-400/70"
                />
                <button
                  type="button"
                  aria-label={`용어 ${idx + 1} 삭제`}
                  onClick={() => {
                    const next = bible.worldview.terminology.filter((_, i) => i !== idx);
                    onChange({ ...bible, worldview: { ...bible.worldview, terminology: next } });
                  }}
                  className="col-span-1 p-1.5 text-zinc-500 hover:text-rose-400 justify-self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-zinc-800/80" />

      {/* 04. 스토리 로드맵 & 문피아 연재 전략 */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">
            04. 스토리 로드맵{renderEstimatedBadge('setting.roadmap')}
          </h2>
          <div className="space-y-3">
            {[
              { key: 'ep1To25' as const, label: '1~25화 (1권 · 무료 투베 돌파 & 유료화 전환)' },
              { key: 'ep26To50' as const, label: '26~50화 (2권 · 유료 안착 & 세계 확장)' },
              { key: 'ep51Plus' as const, label: '51화~ (중장기 3막 & 100화 선독점 유통)' },
            ].map((row) => (
              <div key={row.key} className="space-y-1">
                <label htmlFor={`rm-${row.key}`} className="block text-xs text-zinc-400">
                  {row.label}
                </label>
                <textarea
                  id={`rm-${row.key}`}
                  rows={2}
                  value={bible.storyRoadmap[row.key]}
                  onChange={(e) => {
                    clearEst('setting.roadmap');
                    onChange({
                      ...bible,
                      storyRoadmap: { ...bible.storyRoadmap, [row.key]: e.target.value },
                    });
                  }}
                  className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-400/70"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-100">문피아 연재 전략 & 보류 항목</h2>
          <div className="space-y-1.5">
            <label htmlFor="sb-strategy" className="block text-xs text-zinc-400">연재 전략 메모</label>
            <textarea
              id="sb-strategy"
              rows={4}
              value={bible.munpiaStrategyMemo}
              onChange={(e) => onChange({ ...bible, munpiaStrategyMemo: e.target.value })}
              className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-amber-400/70"
            />
          </div>
          <div className="space-y-2">
            <span className="block text-xs text-zinc-400">보류 / 추후 결정 항목</span>
            <ul className="space-y-2 text-xs text-zinc-300">
              {bible.pendingItems.map((item, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label={`보류 항목 ${idx + 1}`}
                    value={item}
                    onChange={(e) => {
                      const next = [...bible.pendingItems];
                      next[idx] = e.target.value;
                      onChange({ ...bible, pendingItems: next });
                    }}
                    className="flex-1 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-300"
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
