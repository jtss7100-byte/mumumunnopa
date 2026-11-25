import type {
  PlotFramework,
  RuleProfilePreset,
  WritingRuleProfile,
  WritingRuleToggles,
} from '../types/novelPlanner.ts';

export interface RuleToggleDefinition {
  key: keyof WritingRuleToggles;
  label: string;
  shortDesc: string;
  aiRule: string;
  writerRule: string;
}

export interface PlotFrameworkDefinition {
  value: PlotFramework;
  label: string;
  shortDesc: string;
  aiDirective: string;
  writerDirective: string;
}

export interface RulePresetDefinition {
  id: RuleProfilePreset;
  emoji: string;
  label: string;
  summary: string;
}

export const RULE_PRESET_META: RulePresetDefinition[] = [
  {
    id: 'vol1_survival',
    emoji: '🔥',
    label: '1권 생존',
    summary: '3단계 압축 · 초반 5화 패 공개 · 컷 편집 · 보상 Showing · 절단신공',
  },
  {
    id: 'main_climax',
    emoji: '⚔️',
    label: '메인 클라이맥스',
    summary: '9단계 도파민 루프 · 적 반동 & 인정 · 2절 후렴구 리스크 증폭',
  },
  {
    id: 'breather_buildup',
    emoji: '☕',
    label: '쉬어가기·빌드업',
    summary: '일상·관계·복선 빌드업 · 지루함 완충재 · 강제 전투·낚시 경고 해제',
  },
  {
    id: 'custom',
    emoji: '🎛️',
    label: '커스텀',
    summary: '작가가 직접 조합한 플롯 골격 및 9개 작법 토글 설정',
  },
];

export const PLOT_FRAMEWORK_META: Record<PlotFramework, PlotFrameworkDefinition> = {
  three_step_change: {
    value: 'three_step_change',
    label: '3단계 압축 (발생 → 개입 → 해결·변화)',
    shortDesc: '사건의 발생 → 주인공 개입 → 해결·변화로 군더더기 없이 빠르게 압축 전개',
    aiDirective:
      '플롯 골격은 [3단계 압축: 사건의 발생 → 주인공 개입 → 해결·변화]를 적용하십시오. 각 회차/블록이 명확한 스펙·관계·인식 변화를 남기도록 압축하고, 보상·인정의 쾌감을 위해 앞 씬에 역산 빌드업(무시·상성·제약)을 배치하십시오.',
    writerDirective:
      '[3단계 압축 플롯] 사건의 발생 → 주인공의 즉각적 개입 → 해결 및 명확한 상태 변화(스펙·관계·인식) 순으로 군더더기 없이 밀도 있게 전개하십시오.',
  },
  nine_step_loop: {
    value: 'nine_step_loop',
    label: '9단계 도파민 루프 (도입 → 적 반동 → 반격 → 인정)',
    shortDesc:
      '도입 → 갈등입성 → 1차위기 → 정보대응 → 적 반동 → 정보+능력 반격 → 승리 → 보상 → 환호·인정',
    aiDirective:
      '플롯 골격은 [9단계 도파민 루프: ①도입 → ②갈등입성 → ③1차위기 → ④정보대응 → ⑤적의 반동 → ⑥정보+능력 반격 → ⑦승리 → ⑧보상 → ⑨주변인 환호·인정] 리듬을 반영하십시오. 특히 5번(적의 반동·재압박)으로 긴장을 한 번 더 끌어올린 뒤 6~7번 역전을 터뜨리고, 반드시 9번(주변인/관객의 충격·환호·인정)으로 카타르시스를 회수하십시오.',
    writerDirective:
      '[9단계 도파민 루프] 도입 → 갈등입성 → 1차위기 → 정보대응 → 적의 반동 → 정보+능력 반격 → 승리 → 보상 → 주변인 환호·인정의 리듬을 살려, 적의 반동으로 긴장을 재점화한 뒤 승리와 주변인의 즉각적 인정 반응까지 충분히 회수하십시오.',
  },
  fast_cider: {
    value: 'fast_cider',
    label: '단발 쾌속 사이다 (적 반동 생략 · 빠른 돌파)',
    shortDesc: '질질 끄는 적의 반동이나 고구마 구간을 생략하고 즉각적 쾌속 돌파 전개',
    aiDirective:
      '플롯 골격은 [단발 쾌속 사이다]를 적용하십시오. 적의 재반동이나 긴 고구마 지연 구간을 과감히 생략하고, 문제 제기 직후 주인공의 압도적 수단·판단으로 빠르게 돌파해 즉각적인 100원 카타르시스를 제공하십시오.',
    writerDirective:
      '[단발 쾌속 사이다] 질질 끄는 적의 반동이나 고구마 지연을 생략하고, 갈등 제시 직후 주인공의 수단으로 시원하게 돌파해 빠른 쾌감을 전달하십시오.',
  },
  slice_buildup: {
    value: 'slice_buildup',
    label: '일상·관계·복선 빌드업 (전투·보상 강제 해제)',
    shortDesc: '강제 전투·보상 압박을 해제하고 캐릭터 관계 진전·세계관·복선 매설에 집중',
    aiDirective:
      '플롯 골격은 [일상·관계·복선 빌드업]을 적용하십시오. 억지 전투나 과장된 물리적 보상 강제 압박을 해제하고, 인물 간 관계 변화·일상 호흡·정보 정리·다음 아크용 복선 매설이 자연스럽게 흐르도록 설계하십시오.',
    writerDirective:
      '[일상·관계·복선 빌드업] 억지 전투나 과장된 보상 전개 압박을 내려놓고, 인물 간 관계의 미세한 변화·대화 호흡·복선 매설을 자연스럽게 살려 집필하십시오.',
  },
  freeform: {
    value: 'freeform',
    label: '자유 구성 (플롯 공식 미적용)',
    shortDesc: '고정 플롯 공식과 강제 전투·보상 압박을 해제하고 작가 의도대로 자유 설계',
    aiDirective:
      '플롯 골격은 [자유 구성]입니다. 특정 상업 플롯 공식이나 강제 전투·보상 구조를 강요하지 말고, 작가가 입력한 의도와 장면 흐름을 최우선으로 존중하여 자연스럽게 설계하십시오.',
    writerDirective:
      '[자유 구성] 특정 플롯 공식에 억지로 끼워 맞추지 말고, 설계도에 담긴 작가의 장면 흐름과 연출 의도를 그대로 살려 집필하십시오.',
  },
};

export const RULE_TOGGLE_META: RuleToggleDefinition[] = [
  {
    key: 'cutNoChangeScenes',
    label: '변화 없는 씬 컷 편집 & 요약 스킵',
    shortDesc: '스펙·관계·인식 변화 없는 이동/일상·사건 없는 단독 씬을 한 줄 요약으로 압축',
    aiRule:
      '[무변화 씬 컷 편집] 스펙·관계·인식 변화가 없는 단순 이동·일상 씬이나 대사(cast 2인 이상)·보상(win.scene)·추리(판단/수쓰기)가 모두 없는 사건 없는 단독 씬을 만들지 말고, 이동·전환은 한 줄 요약(Telling)으로 스킵하도록 설계할 것.',
    writerRule:
      '[무변화 씬 컷 편집 & Telling 스킵] 스펙·관계·인식 변화가 없는 일반 이동·시간 경과·감정 전환은 말하기식(Telling)과 한두 줄 요약으로 즉시 스킵하십시오.',
  },
  {
    key: 'reverseBuildup',
    label: '역산 빌드업 (앞 씬 무시·상성 복선)',
    shortDesc: '보상·인정 쾌감을 극대화하기 위해 앞 씬에 주변의 무시·불리한 상성·제약 복선 배치',
    aiRule:
      '[역산 빌드업] 이번 화의 보상·역전·인정 쾌감을 극대화할 수 있도록, 앞선 씬(S1~S2)에 주변 인물의 과소평가·무시·불리한 상성 또는 제약 조건을 의도적으로 선행 매설할 것.',
    writerRule:
      '[역산 빌드업] 클라이맥스 역전의 쾌감이 배가되도록, 앞선 씬에서 주변의 무시·불리한 조건·상성 제약을 선명하게 대비시킨 뒤 뒤집으십시오.',
  },
  {
    key: 'fractalSceneConflict',
    label: '프랙탈 씬 갈등 (목표 → 충돌 → 결과)',
    shortDesc: '개별 씬 단위에서도 작은 목표 → 갈등/충돌 → 성공/좌절 구조를 유지해 공백 방지',
    aiRule:
      '[프랙탈 씬 갈등 구조] 회차 전체뿐 아니라 각 개별 씬(Scene) 단위에서도 반드시 [작은 목표 → 갈등/충돌/장애 → 성공 또는 좌절]의 미니 서사를 유지해 사이 구간 공백을 차단할 것.',
    writerRule:
      '[프랙탈 씬 갈등] 모든 개별 씬 안에서 [작은 목표 → 충돌/방해 → 즉각적 성공·좌절]의 미니 긴장 곡선을 유지해 지루한 사이 구간을 남기지 마십시오.',
  },
  {
    key: 'boredomBuffer',
    label: '지루함 완충재 겹치기 (서브 플롯 레이어)',
    shortDesc: '정보 전달·설명·빌드업 씬에 심리전·티키타카·정보 낙차·긴장감을 겹쳐 지루함 제거',
    aiRule:
      '[지루함 완충재 레이어] 정보 전달·세계관 설명·관계 정리 등 정적으로 흐를 수 있는 씬에는 반드시 심리전·인물 간 티키타카·정보 낙차·잠재적 위기 같은 서브 플롯 완충재를 겹쳐 흥미를 유지할 것.',
    writerRule:
      '[지루함 완충재 겹치기] 정보 전달이나 설명이 필요한 구간은 단독 나열을 피하고, 인물 간 티키타카·숨은 의도(subtext)·정보 낙차·긴장감을 겹쳐 읽는 재미를 유지하십시오.',
  },
  {
    key: 'secondChorusEscalation',
    label: '2절 후렴구 증폭 (시간제한·리스크·보상 확대)',
    shortDesc: '반복 에피소드 진행 시 시간제한·실패 대가(stake)·보상 크기를 단계적으로 증폭',
    aiRule:
      '[2절 후렴구 증폭] 유사한 패턴이 반복될수록 이전보다 더 촉박한 시간제한, 더 치명적인 실패 리스크(stake), 더 큰 보상 스케일로 단계적 증폭이 느껴지도록 설계할 것.',
    writerRule:
      '[2절 후렴구 증폭] 전개 리듬이 반복되는 구간에서는 촉박한 시간제한, 커진 실패 대가(stake), 확장된 보상의 무게감을 선명하게 부각해 긴장감을 끌어올리십시오.',
  },
  {
    key: 'shortSentencePace',
    label: '단문 압축 지문 + 구어체 대사 분리',
    shortDesc: '불필요한 부사·접속사를 압축한 건조한 단문 지문과 생동감 있는 구어체 대사 분리',
    aiRule:
      '[단문 압축 & 지문·대사 분리] prose_tone과 avoid에 불필요한 부사·접속사 남발 금지, 건조하고 속도감 있는 단문 지문과 구어체 대사 분리 원칙을 명확히 반영할 것.',
    writerRule:
      '[단문 압축 & 지문·대사 분리] 단문 위주로 전개하고 불필요한 부사·접속사(매우, 정말, 그리고, 하지만 등 남발)를 과감히 압축하십시오. 지문은 건조하고 담백하게 서술하되, 생동감 있는 구어체는 반드시 대사로 분리하십시오.',
  },
  {
    key: 'stretchRewardScene',
    label: '핵심 보상 씬 감각 확장 (win.stretch Showing)',
    shortDesc: '클라이맥스 보상 씬(win.scene)에서만 win.stretch: true로 감각·리액션 호흡 확장',
    aiRule:
      '[핵심 보상 씬 Showing 집중] 클라이맥스 핵심 보상 씬을 win.scene으로 지정하고 반드시 win.stretch: true를 활성화하여, 해당 씬에서만 sensory와 win.reaction을 활용한 보여주기식(Showing) 호흡 확장이 일어나도록 설계할 것.',
    writerRule:
      '[핵심 보상 씬 Showing 집중] 오직 `win.stretch: true`가 설정된 핵심 보상 씬에서만 해당 씬의 `sensory`(감각 앵커)와 주변 인물의 `win.reaction`을 활용해 보여주기식(Showing)으로 호흡을 확장하십시오.',
  },
  {
    key: 'revealBeforeCutEnding',
    label: '보상 공개 후 절단신공 (낚시 엔딩 금지)',
    shortDesc: '"...직전" 식 은폐 낚시를 금지하고 보상·반전 완전 공개 후 활용 직전에 절단',
    aiRule:
      '[보상 공개 후 절단신공] ending.what 및 블록 cliffhanger에 "...직전", "정체가 밝혀지려던 찰나"처럼 보상·반전을 숨기는 낚시를 금지하고, 반드시 보상·반전을 완전히 공개한 뒤 활용·행동 개시 직전에 끊는 절단신공 구조로 설계할 것.',
    writerRule:
      '[보상 공개 후 절단신공] 엔딩(`ending`)은 보상이나 반전을 숨긴 채 끊는 낚시("...직전", "정체가 밝혀지려던 찰나" 등)를 금지합니다. 이번 화의 보상·반전·정답을 독자에게 완전히 공개한 뒤, 주인공이 그것을 활용하거나 다음 행동에 돌입하기 직전에 끊으십시오.',
  },
  {
    key: 'revealCardsInEp1To5',
    label: '1~5화 초반 패 전면 공개 (무기·목표·메인 조연)',
    shortDesc: '도입(1~5화)에 주인공 무기·목표·메인 서브1을 모두 배치 (2권 이후 OFF 가능)',
    aiRule:
      '[초반 5화 패 전면 공개] 도입(1~5화) 구간에 주인공의 핵심 무기/능력, 목표, 주요 조연(메인 서브1)을 빠짐없이 전면 공개하여 투베 초반 이탈을 차단할 것.',
    writerRule:
      '[초반 5화 패 전면 공개] 도입(1~5화) 회차에서는 주인공의 핵심 무기·목표·주요 조연의 매력을 숨기지 말고 초반부터 선명하게 각인시키십시오.',
  },
];

export const FLEXIBLE_ROLE_SUBSTITUTION_GUIDELINE =
  '플롯 골격의 각 단계는 뻔한 클리셰 형태로 고정하지 말고 서사적 "역할(Function)"로 유연하게 치환하십시오 (예: 조력자/스승 역할을 시스템·아이템·기억·문서로, 적의 반동을 환경 제약·시간제한·규칙 변수로 대체 가능).';

const PRESET_CONFIGS: Record<
  Exclude<RuleProfilePreset, 'custom'>,
  { plotFramework: PlotFramework; toggles: WritingRuleToggles }
> = {
  vol1_survival: {
    plotFramework: 'three_step_change',
    toggles: {
      cutNoChangeScenes: true,
      reverseBuildup: true,
      fractalSceneConflict: true,
      boredomBuffer: false,
      secondChorusEscalation: false,
      shortSentencePace: true,
      stretchRewardScene: true,
      revealBeforeCutEnding: true,
      revealCardsInEp1To5: true,
    },
  },
  main_climax: {
    plotFramework: 'nine_step_loop',
    toggles: {
      cutNoChangeScenes: false,
      reverseBuildup: true,
      fractalSceneConflict: true,
      boredomBuffer: false,
      secondChorusEscalation: true,
      shortSentencePace: true,
      stretchRewardScene: true,
      revealBeforeCutEnding: true,
      revealCardsInEp1To5: false,
    },
  },
  breather_buildup: {
    plotFramework: 'slice_buildup',
    toggles: {
      cutNoChangeScenes: false,
      reverseBuildup: false,
      fractalSceneConflict: true,
      boredomBuffer: true,
      secondChorusEscalation: false,
      shortSentencePace: true,
      stretchRewardScene: false,
      revealBeforeCutEnding: false,
      revealCardsInEp1To5: false,
    },
  },
};

export function createRuleProfileFromPreset(
  preset: RuleProfilePreset,
  current?: WritingRuleProfile
): WritingRuleProfile {
  if (preset === 'custom') {
    const base = current ? normalizeRuleProfile(current) : createRuleProfileFromPreset('vol1_survival');
    return {
      preset: 'custom',
      plotFramework: base.plotFramework,
      toggles: { ...base.toggles },
    };
  }
  const cfg = PRESET_CONFIGS[preset];
  return {
    preset,
    plotFramework: cfg.plotFramework,
    toggles: { ...cfg.toggles },
  };
}

export const DEFAULT_RULE_PROFILE: WritingRuleProfile =
  createRuleProfileFromPreset('vol1_survival');

const VALID_PRESETS = new Set<RuleProfilePreset>([
  'vol1_survival',
  'main_climax',
  'breather_buildup',
  'custom',
]);

const VALID_FRAMEWORKS = new Set<PlotFramework>([
  'three_step_change',
  'nine_step_loop',
  'fast_cider',
  'slice_buildup',
  'freeform',
]);

export function detectMatchingPreset(
  plotFramework: PlotFramework,
  toggles: WritingRuleToggles
): RuleProfilePreset {
  const keys = Object.keys(PRESET_CONFIGS) as Array<Exclude<RuleProfilePreset, 'custom'>>;
  for (const presetId of keys) {
    const cfg = PRESET_CONFIGS[presetId];
    if (cfg.plotFramework !== plotFramework) continue;
    const allMatch = (Object.keys(cfg.toggles) as Array<keyof WritingRuleToggles>).every(
      (k) => cfg.toggles[k] === toggles[k]
    );
    if (allMatch) return presetId;
  }
  return 'custom';
}

export function normalizeRuleProfile(
  raw?: Partial<WritingRuleProfile> | null
): WritingRuleProfile {
  if (!raw || typeof raw !== 'object') {
    return createRuleProfileFromPreset('vol1_survival');
  }
  const defaults = DEFAULT_RULE_PROFILE;
  const plotFramework: PlotFramework = VALID_FRAMEWORKS.has(raw.plotFramework as PlotFramework)
    ? (raw.plotFramework as PlotFramework)
    : defaults.plotFramework;

  const rawToggles = (raw.toggles ?? {}) as Partial<WritingRuleToggles>;
  const toggles: WritingRuleToggles = {
    cutNoChangeScenes:
      typeof rawToggles.cutNoChangeScenes === 'boolean'
        ? rawToggles.cutNoChangeScenes
        : defaults.toggles.cutNoChangeScenes,
    reverseBuildup:
      typeof rawToggles.reverseBuildup === 'boolean'
        ? rawToggles.reverseBuildup
        : defaults.toggles.reverseBuildup,
    fractalSceneConflict:
      typeof rawToggles.fractalSceneConflict === 'boolean'
        ? rawToggles.fractalSceneConflict
        : defaults.toggles.fractalSceneConflict,
    boredomBuffer:
      typeof rawToggles.boredomBuffer === 'boolean'
        ? rawToggles.boredomBuffer
        : defaults.toggles.boredomBuffer,
    secondChorusEscalation:
      typeof rawToggles.secondChorusEscalation === 'boolean'
        ? rawToggles.secondChorusEscalation
        : defaults.toggles.secondChorusEscalation,
    shortSentencePace:
      typeof rawToggles.shortSentencePace === 'boolean'
        ? rawToggles.shortSentencePace
        : defaults.toggles.shortSentencePace,
    stretchRewardScene:
      typeof rawToggles.stretchRewardScene === 'boolean'
        ? rawToggles.stretchRewardScene
        : defaults.toggles.stretchRewardScene,
    revealBeforeCutEnding:
      typeof rawToggles.revealBeforeCutEnding === 'boolean'
        ? rawToggles.revealBeforeCutEnding
        : defaults.toggles.revealBeforeCutEnding,
    revealCardsInEp1To5:
      typeof rawToggles.revealCardsInEp1To5 === 'boolean'
        ? rawToggles.revealCardsInEp1To5
        : defaults.toggles.revealCardsInEp1To5,
  };

  const preset: RuleProfilePreset = VALID_PRESETS.has(raw.preset as RuleProfilePreset)
    ? (raw.preset as RuleProfilePreset)
    : detectMatchingPreset(plotFramework, toggles);

  return { preset, plotFramework, toggles };
}

export function countEnabledRuleToggles(profile: WritingRuleProfile): number {
  return RULE_TOGGLE_META.filter((item) => profile.toggles[item.key]).length;
}

/**
 * Dynamically builds the AI planning/diagnosis rule prompt block from the active WritingRuleProfile.
 * Only enabled toggles and the selected plotFramework are included — disabled rules are omitted cleanly.
 */
export function buildDynamicRulesInstruction(
  rawProfile?: Partial<WritingRuleProfile> | null,
  context: 'diagnose' | 'block' | 'blueprint' | 'assemble' | 'brain_dump' = 'blueprint'
): string {
  const profile = normalizeRuleProfile(rawProfile);
  const frameworkMeta = PLOT_FRAMEWORK_META[profile.plotFramework];
  const presetMeta = RULE_PRESET_META.find((p) => p.id === profile.preset) ?? RULE_PRESET_META[3];

  const activeToggles = RULE_TOGGLE_META.filter((item) => profile.toggles[item.key]);
  const lines: string[] = [
    `[활성 연출·플롯 규칙 프로필: ${presetMeta.emoji} ${presetMeta.label} | 플롯 골격: ${frameworkMeta.label}]`,
    `- 플롯 지침: ${frameworkMeta.aiDirective}`,
    `- 유연 치환 원칙: ${FLEXIBLE_ROLE_SUBSTITUTION_GUIDELINE}`,
  ];

  if (activeToggles.length > 0) {
    lines.push('- 활성화된 작법 규칙 (ON 항목만 적용):');
    activeToggles.forEach((item, idx) => {
      lines.push(`  ${idx + 1}. ${item.aiRule}`);
    });
  } else {
    lines.push('- 활성화된 추가 작법 제약 없음 (작가의 메모와 장면 의도를 자유롭게 반영).');
  }

  // Explicitly relax constraints that are turned OFF so the model doesn't default to rigid Munpia clichés
  const relaxedHints: string[] = [];
  if (!profile.toggles.stretchRewardScene && (context === 'blueprint' || context === 'assemble' || context === 'brain_dump')) {
    relaxedHints.push('win.stretch는 억지로 true로 강제하지 말고 씬 성격에 맞춰 자유롭게 false/true 선택');
  }
  if (!profile.toggles.cutNoChangeScenes) {
    relaxedHints.push('인물 감정·일상·복선 준비용 단독 씬이나 호흡 조절 씬을 허용(강제 스킵/경고 금지)');
  }
  if (!profile.toggles.revealBeforeCutEnding) {
    relaxedHints.push('엔딩은 보상 선공개 절단신공 외에 여운·서스펜스·다음 화 예고 등 자유로운 마무리 허용');
  }
  if (!profile.toggles.revealCardsInEp1To5 && (context === 'diagnose' || context === 'brain_dump')) {
    relaxedHints.push('1~5화 초반 패(무기·목표·메인 조연) 강제 전면 공개 체크 생략 (2권 이후 또는 슬로우 빌드 허용)');
  }

  if (relaxedHints.length > 0) {
    lines.push(`- 해제(OFF)된 규칙 참고: ${relaxedHints.join(' / ')}`);
  }

  return lines.join('\n');
}

/**
 * Dynamically builds the writer rules section for the [Novel Writer 집필 마스터 프롬프트].
 * Completely omits any toggle that is OFF.
 */
export function buildDynamicWriterPromptRules(
  rawProfile?: Partial<WritingRuleProfile> | null,
  winSceneName?: string
): string[] {
  const profile = normalizeRuleProfile(rawProfile);
  const frameworkMeta = PLOT_FRAMEWORK_META[profile.plotFramework];

  const rules: string[] = [
    frameworkMeta.writerDirective,
    `[서사적 역할 유연 치환] ${FLEXIBLE_ROLE_SUBSTITUTION_GUIDELINE}`,
  ];

  for (const item of RULE_TOGGLE_META) {
    if (!profile.toggles[item.key]) continue;
    if (item.key === 'stretchRewardScene' && winSceneName) {
      rules.push(
        `[핵심 보상 씬 Showing 집중] 오직 \`win.stretch: true\`가 설정된 핵심 보상 씬(\`${winSceneName}\`)에서만 해당 씬의 \`sensory\`(감각 앵커)와 주변 인물의 \`win.reaction\`을 활용해 보여주기식(Showing)으로 호흡을 확장하십시오.`
      );
    } else {
      rules.push(item.writerRule);
    }
  }

  // Always preserve writer verbatim key_lines, avoid guardrails, and structural blueprint adherence
  rules.push(
    '[작가 원문 & 금지선 엄수] 각 씬의 `key_lines` 원문 대사·독백은 토씨 하나 수정 없이 그대로 삽입하고, 전역 `avoid` 금지선 항목은 단 한 줄도 위반하지 마십시오.'
  );
  rules.push(
    '[설계도 정밀 제어 준수] 각 씬의 `lines` 비중, `tension`(1~5), `cast` 화이트리스트, `terms` 고유명사 표기, `prose_tone`, `info_gap`, `subtext`, `anchors` 전개 순서를 누락 없이 반영하십시오.'
  );

  return rules;
}
