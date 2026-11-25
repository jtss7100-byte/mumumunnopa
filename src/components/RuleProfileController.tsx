import React, { useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type {
  PlotFramework,
  RuleProfilePreset,
  WritingRuleProfile,
  WritingRuleToggles,
} from '../types/novelPlanner';
import {
  FLEXIBLE_ROLE_SUBSTITUTION_GUIDELINE,
  PLOT_FRAMEWORK_META,
  RULE_PRESET_META,
  RULE_TOGGLE_META,
  countEnabledRuleToggles,
  createRuleProfileFromPreset,
  detectMatchingPreset,
} from '../utils/ruleProfileEngine';

interface Props {
  profile: WritingRuleProfile;
  onChange: (next: WritingRuleProfile) => void;
  /** When set, enables Episode-level override vs Project-default switching */
  episodeNumber?: number;
  isEpisodeOverride?: boolean;
  onToggleEpisodeOverride?: (useOverride: boolean) => void;
  onResetEpisodeOverride?: () => void;
  defaultOpen?: boolean;
  testIdPrefix?: string;
}

export const RuleProfileController: React.FC<Props> = ({
  profile,
  onChange,
  episodeNumber,
  isEpisodeOverride = false,
  onToggleEpisodeOverride,
  onResetEpisodeOverride,
  defaultOpen = false,
  testIdPrefix = 'rule-controller',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  const presetMeta =
    RULE_PRESET_META.find((p) => p.id === profile.preset) ?? RULE_PRESET_META[3];
  const frameworkMeta = PLOT_FRAMEWORK_META[profile.plotFramework];
  const enabledCount = countEnabledRuleToggles(profile);

  const applyProfileChange = (next: WritingRuleProfile) => {
    if (episodeNumber !== undefined && !isEpisodeOverride && onToggleEpisodeOverride) {
      onToggleEpisodeOverride(true);
    }
    onChange(next);
  };

  const handleSelectPreset = (presetId: RuleProfilePreset) => {
    applyProfileChange(createRuleProfileFromPreset(presetId, profile));
  };

  const handleSelectFramework = (nextFramework: PlotFramework) => {
    const nextPreset = detectMatchingPreset(nextFramework, profile.toggles);
    applyProfileChange({
      preset: nextPreset,
      plotFramework: nextFramework,
      toggles: { ...profile.toggles },
    });
  };

  const handleToggleRule = (key: keyof WritingRuleToggles) => {
    const nextToggles: WritingRuleToggles = {
      ...profile.toggles,
      [key]: !profile.toggles[key],
    };
    const nextPreset = detectMatchingPreset(profile.plotFramework, nextToggles);
    applyProfileChange({
      preset: nextPreset,
      plotFramework: profile.plotFramework,
      toggles: nextToggles,
    });
  };

  return (
    <section
      data-testid={testIdPrefix}
      aria-label="플롯 및 작법 규칙 컨트롤러"
      className="bg-zinc-900/65 border border-zinc-800/90 rounded-xl overflow-hidden"
    >
      {/* Collapsible Header */}
      <button
        type="button"
        data-testid={`${testIdPrefix}-toggle`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-left hover:bg-zinc-900/90 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
          )}
          <SlidersHorizontal className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-sm font-semibold text-zinc-100 whitespace-nowrap">
            플롯·작법 규칙 컨트롤러
          </span>
          {episodeNumber !== undefined && (
            <span
              data-testid={`${testIdPrefix}-scope-badge`}
              className={`px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap ${
                isEpisodeOverride
                  ? 'bg-sky-500/15 text-sky-300 border-sky-400/40'
                  : 'bg-zinc-800/90 text-zinc-400 border-zinc-700/80'
              }`}
            >
              {isEpisodeOverride ? `${episodeNumber}화 개별 오버라이드` : '작품 기본 규칙 따름'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            data-testid={`${testIdPrefix}-active-preset`}
            className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-200 border border-amber-400/40 font-medium whitespace-nowrap"
          >
            {presetMeta.emoji} {presetMeta.label}
          </span>
          <span className="hidden sm:inline text-zinc-400 truncate max-w-[260px]">
            {frameworkMeta.label.split('(')[0].trim()}
          </span>
          <span className="font-mono tabular-nums text-zinc-400 bg-zinc-950/80 border border-zinc-800 px-2 py-0.5 rounded">
            ON {enabledCount}/{RULE_TOGGLE_META.length}
          </span>
        </div>
      </button>

      {/* Expanded Body */}
      {isOpen && (
        <div className="px-4 pb-5 pt-3 border-t border-zinc-800/80 space-y-5 bg-zinc-950/40">
          {/* Episode Override Scope Switcher (Phase 4 only) */}
          {episodeNumber !== undefined && onToggleEpisodeOverride && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-zinc-900/75 border border-zinc-800/90">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-use-default`}
                  onClick={() => onToggleEpisodeOverride(false)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    !isEpisodeOverride
                      ? 'bg-amber-400 text-slate-950 font-semibold'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  기본 규칙 따르기
                </button>
                <button
                  type="button"
                  data-testid={`${testIdPrefix}-use-override`}
                  onClick={() => onToggleEpisodeOverride(true)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    isEpisodeOverride
                      ? 'bg-sky-500/25 text-sky-200 border border-sky-400/50 font-semibold'
                      : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {episodeNumber}화만 따로 설정 (오버라이드)
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                {isEpisodeOverride ? (
                  <>
                    <span className="text-sky-300">
                      이 변경은 {episodeNumber}화 진단·AI 조립·집필 프롬프트에만 적용됩니다.
                    </span>
                    {onResetEpisodeOverride && (
                      <button
                        type="button"
                        onClick={onResetEpisodeOverride}
                        className="px-2 py-1 text-[11px] text-zinc-300 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>기본값 복귀</span>
                      </button>
                    )}
                  </>
                ) : (
                  <span>
                    아래 프리셋·토글을 수정하면 자동으로 {episodeNumber}화 개별 오버라이드로 전환됩니다.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Row 1: 4 One-Click Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-300">원클릭 프리셋</span>
              <span className="text-[11px] text-zinc-500">
                구간 성격에 맞춰 프리셋을 고른 뒤 세부 토글을 미세 조정하세요.
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {RULE_PRESET_META.map((item) => {
                const active = profile.preset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-testid={`${testIdPrefix}-preset-${item.id}`}
                    aria-pressed={active}
                    onClick={() => handleSelectPreset(item.id)}
                    className={`p-3 rounded-lg border text-left transition-colors space-y-1 ${
                      active
                        ? 'bg-amber-400/15 border-amber-400/60 text-amber-100'
                        : 'bg-zinc-900/70 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span aria-hidden="true">{item.emoji}</span>
                      <span>{item.label}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">{item.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: Plot Framework Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            <div className="lg:col-span-6 space-y-1.5">
              <label
                htmlFor={`${testIdPrefix}-framework-select`}
                className="block text-xs font-medium text-zinc-300"
              >
                플롯 골격 (5종)
              </label>
              <select
                id={`${testIdPrefix}-framework-select`}
                data-testid={`${testIdPrefix}-framework-select`}
                value={profile.plotFramework}
                onChange={(e) => handleSelectFramework(e.target.value as PlotFramework)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700/90 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-400/70"
              >
                {(Object.keys(PLOT_FRAMEWORK_META) as PlotFramework[]).map((fwKey) => (
                  <option key={fwKey} value={fwKey}>
                    {PLOT_FRAMEWORK_META[fwKey].label}
                  </option>
                ))}
              </select>
            </div>
            <div className="lg:col-span-6 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800/80 space-y-1 text-[11px]">
              <p className="text-zinc-200 leading-relaxed">{frameworkMeta.shortDesc}</p>
              <p className="text-zinc-500 leading-relaxed">{FLEXIBLE_ROLE_SUBSTITUTION_GUIDELINE}</p>
            </div>
          </div>

          {/* Row 3: 9 Rule ON/OFF Switches */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-300">
                세부 작법·진단 규칙 토글 (9종 · OFF 시 진단 경고 및 AI/집필 프롬프트에서 자동 제외)
              </span>
              <span className="text-[11px] font-mono tabular-nums text-amber-300">
                {enabledCount} / {RULE_TOGGLE_META.length} 활성
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {RULE_TOGGLE_META.map((item) => {
                const checked = profile.toggles[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    data-testid={`${testIdPrefix}-switch-${item.key}`}
                    onClick={() => handleToggleRule(item.key)}
                    className={`p-3 rounded-lg border text-left transition-colors flex items-start justify-between gap-3 ${
                      checked
                        ? 'bg-zinc-900/90 border-amber-400/35 hover:border-amber-400/60'
                        : 'bg-zinc-950/70 border-zinc-800/80 opacity-75 hover:opacity-100 hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <span
                        className={`block text-xs font-medium leading-snug ${
                          checked ? 'text-zinc-100' : 'text-zinc-400'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="block text-[11px] text-zinc-500 leading-snug">
                        {item.shortDesc}
                      </span>
                    </div>
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors relative inline-flex items-center ${
                        checked ? 'bg-amber-400' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded-full bg-slate-950 transition-transform ${
                          checked ? 'translate-x-4.5' : 'translate-x-1'
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
