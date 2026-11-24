import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  CHARACTER_ARCHETYPES,
  GENRE_TAGS,
  HOOK_PATTERNS,
  MUNPIA_SURVIVAL_CONTEXT,
  PLOT_STRUCTURES,
  POPULAR_KEYWORDS,
} from '../data/munpiaReferences';
import type { CharacterArchetype } from '../data/munpiaReferences';

interface Props {
  open: boolean;
  onClose: () => void;
  onAddArchetypeToSetting?: (archetype: CharacterArchetype) => void;
}

type RefTab = 'survival' | 'genres' | 'hooks' | 'archetypes' | 'structures';

export const MunpiaReferenceDrawer: React.FC<Props> = ({
  open,
  onClose,
  onAddArchetypeToSetting,
}) => {
  const [tab, setTab] = useState<RefTab>('survival');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-label="문피아 도메인 레퍼런스 DB"
    >
      <div className="w-full max-w-2xl bg-[#0e1118] border-l border-zinc-800 h-full flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">문피아 생존 공식 & 레퍼런스 DB</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              내장 도메인 지식을 기획 및 AI 프롬프트 설계에 즉시 참조합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="레퍼런스 패널 닫기"
            className="p-2 text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-zinc-800/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-6 py-3 border-b border-zinc-800/80 overflow-x-auto">
          {(
            [
              ['survival', '생존 공식'],
              ['genres', '장르 · 키워드'],
              ['hooks', '1화 훅 패턴'],
              ['archetypes', '아키타입 18종'],
              ['structures', '25/200/500화 구조'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === id
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {tab === 'survival' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-amber-300">편당결제 과금 구조</h3>
                <p className="text-zinc-200 font-mono text-xs">{MUNPIA_SURVIVAL_CONTEXT.billingModel.pricePerEpisode}</p>
                <p className="text-zinc-300 leading-relaxed text-xs">{MUNPIA_SURVIVAL_CONTEXT.billingModel.coreRule}</p>
              </div>

              <hr className="border-zinc-800/80" />

              <div className="space-y-2.5">
                <h3 className="text-sm font-semibold text-zinc-100">연재 등급 승급 체계</h3>
                <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-lg">
                  {MUNPIA_SURVIVAL_CONTEXT.serializationTiers.map((t) => (
                    <div key={t.tier} className="p-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-zinc-100">{t.tier}</span>
                        <span className="text-amber-300 font-mono">{t.condition}</span>
                      </div>
                      <p className="text-zinc-400">{t.goal}</p>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-zinc-800/80" />

              <div className="space-y-2 text-xs text-zinc-300">
                <h3 className="text-sm font-semibold text-zinc-100">투데이베스트(투베) & 유료화 전환</h3>
                <p>· 기준: {MUNPIA_SURVIVAL_CONTEXT.todayBestRules.metric}</p>
                <p>· 유료화 표준: {MUNPIA_SURVIVAL_CONTEXT.todayBestRules.paywallStandard}</p>
                <p>· 무료 구간 전략: {MUNPIA_SURVIVAL_CONTEXT.todayBestRules.freeZoneGoal}</p>
                <p>· 유통 연계: {MUNPIA_SURVIVAL_CONTEXT.longFormDistribution.exclusiveMilestone}</p>
              </div>

              <hr className="border-zinc-800/80" />

              <div className="space-y-2 text-xs">
                <h3 className="text-sm font-semibold text-rose-300">톤 & 템포 자동 경고 기준</h3>
                <ul className="space-y-1.5 text-zinc-300">
                  {MUNPIA_SURVIVAL_CONTEXT.targetAudienceAndWarnings.warnings.map((w, i) => (
                    <li key={i}>· {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {tab === 'genres' && (
            <div className="space-y-6">
              <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-lg">
                {GENRE_TAGS.map((g) => (
                  <div key={g.id} className="p-3 flex items-start justify-between gap-4 text-xs">
                    <div>
                      <span className="font-semibold text-zinc-100">{g.name}</span>
                      <p className="text-zinc-400 mt-0.5">{g.note}</p>
                    </div>
                    <span
                      className={`shrink-0 font-medium ${
                        g.munpiaAffinity === '비주류 주의'
                          ? 'text-rose-400'
                          : g.munpiaAffinity === '최상'
                            ? 'text-amber-300'
                            : 'text-zinc-400'
                      }`}
                    >
                      {g.munpiaAffinity}
                    </span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-zinc-300">2024~2026 인기 키워드</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{POPULAR_KEYWORDS.join(' · ')}</p>
              </div>
            </div>
          )}

          {tab === 'hooks' && (
            <div className="space-y-5">
              {HOOK_PATTERNS.map((group) => (
                <div key={group.id} className="space-y-2">
                  <h3 className="text-sm font-semibold text-amber-300">{group.genre}</h3>
                  <div className="divide-y divide-zinc-800/70 border border-zinc-800/80 rounded-lg">
                    {group.variants.map((v) => (
                      <div key={v.code} className="p-3 text-xs space-y-1">
                        <p className="font-semibold text-zinc-100">
                          {v.code}. {v.label}
                        </p>
                        <p className="text-zinc-400">구조: {v.structure}</p>
                        <p className="text-amber-200/85">독자 질문: {v.readerQuestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'archetypes' && (
            <div className="space-y-3">
              {CHARACTER_ARCHETYPES.map((a) => (
                <div
                  key={a.number}
                  className="p-3.5 bg-zinc-900/50 border border-zinc-800/80 rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-zinc-100">
                      <span className="text-amber-400 mr-1.5">{a.symbol}</span>
                      {a.name}
                      <span className="text-zinc-500 font-normal ml-2">{a.category}</span>
                    </div>
                    {onAddArchetypeToSetting && (
                      <button
                        type="button"
                        onClick={() => onAddArchetypeToSetting(a)}
                        className="px-2.5 py-1 text-[11px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/40 rounded hover:bg-amber-400/20 inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>인물표에 추가</span>
                      </button>
                    )}
                  </div>
                  <p className="text-zinc-300">
                    <span className="text-zinc-500">겉 성격:</span> {a.outerDefault}
                  </p>
                  <p className="text-zinc-300">
                    <span className="text-amber-300/80">속 성격:</span> {a.innerDefault}
                  </p>
                  <p className="text-zinc-400">
                    <span className="text-zinc-500">관계 흐름:</span> {a.relationFlowDefault}
                  </p>
                </div>
              ))}
            </div>
          )}

          {tab === 'structures' && (
            <div className="space-y-6 text-xs">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-amber-300">25화 (1권) 내부 5블록 구조</h3>
                <div className="divide-y divide-zinc-800/70 border border-zinc-800/80 rounded-lg">
                  {PLOT_STRUCTURES.arc25Blocks.map((b) => (
                    <div key={b.blockIndex} className="p-3 space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-semibold text-zinc-100">{b.label}</span>
                        <span className="font-mono text-amber-300">{b.epRange}</span>
                      </div>
                      <p className="text-zinc-300">{b.role}</p>
                      <p className="text-zinc-500">{b.focus}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-100">500화 (20권) 표준 3막</h3>
                {PLOT_STRUCTURES.longForm500.map((a) => (
                  <div key={a.act} className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                    <div className="flex justify-between font-semibold text-zinc-100 mb-1">
                      <span>{a.act}</span>
                      <span className="font-mono text-amber-300">{a.range}</span>
                    </div>
                    <p className="text-zinc-400">{a.milestone}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-100">200화 (8권) 단축형 3막</h3>
                {PLOT_STRUCTURES.shortForm200.map((a) => (
                  <div key={a.act} className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-lg">
                    <div className="flex justify-between font-semibold text-zinc-100 mb-1">
                      <span>{a.act}</span>
                      <span className="font-mono text-amber-300">{a.range}</span>
                    </div>
                    <p className="text-zinc-400">{a.milestone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
