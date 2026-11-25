import type {
  AnchorTag,
  ArcPlan,
  DraftWarning,
  EndingType,
  EpisodeNarrativeBlueprint,
  NarrativeScene,
  NovelProject,
  SettingBible,
  ThreeQDiagnosticItem,
  WritingRuleProfile,
} from '../types/novelPlanner';
import {
  PLOT_FRAMEWORK_META,
  RULE_PRESET_META,
  buildDynamicWriterPromptRules,
  normalizeRuleProfile,
} from './ruleProfileEngine';

export const STORAGE_KEY = 'munpia_forge_projects_v1';

const VALID_ANCHOR_TAGS = new Set<AnchorTag>([
  '상황',
  '문제',
  '판단',
  '목표',
  '수쓰기',
  '주고받기',
  '이김',
  '풀이',
  '갈고리',
]);

const VALID_ENDINGS: EndingType[] = ['위기', '반전', '정보', '감정'];

/**
 * Recalculates each scene's target_chars proportionally from `lines`
 * so the episode sum matches `totalTargetChars` (default 5,000자 for Munpia).
 */
export function calculateTargetChars(
  scenes: NarrativeScene[],
  totalTargetChars = 5000
): NarrativeScene[] {
  if (scenes.length === 0) return [];
  const safeTotal = Math.max(1000, Math.round(totalTargetChars));
  const totalLines = scenes.reduce((sum, s) => sum + Math.max(1, Math.round(s.lines || 0)), 0);
  if (totalLines <= 0) {
    const even = Math.floor(safeTotal / scenes.length);
    return scenes.map((s, idx) => ({
      ...s,
      id: s.id || `S${idx + 1}`,
      target_chars: idx === scenes.length - 1 ? safeTotal - even * (scenes.length - 1) : even,
    }));
  }

  const raw = scenes.map((s, idx) => {
    const lines = Math.max(1, Math.round(s.lines || 0));
    return {
      scene: { ...s, id: s.id || `S${idx + 1}`, lines },
      chars: Math.round((lines / totalLines) * safeTotal),
    };
  });

  const currentSum = raw.reduce((sum, item) => sum + item.chars, 0);
  const diff = safeTotal - currentSum;

  if (diff !== 0) {
    let largestIdx = 0;
    for (let i = 1; i < raw.length; i++) {
      if (raw[i].scene.lines > raw[largestIdx].scene.lines) {
        largestIdx = i;
      }
    }
    raw[largestIdx].chars = Math.max(100, raw[largestIdx].chars + diff);
  }

  return raw.map((item) => ({
    ...item.scene,
    target_chars: item.chars,
  }));
}

/**
 * Ensures all v2 optional enrichment fields exist safely and synchronizes `scene` names
 * on win, laugh, and threads against `scenes` (supporting both scene_id and legacy scene name).
 */
export function syncBlueprintSceneNames(
  blueprint: EpisodeNarrativeBlueprint,
  totalTargetChars = 5000
): EpisodeNarrativeBlueprint {
  const syncedScenes = calculateTargetChars(blueprint.scenes, totalTargetChars).map((sc, idx) => ({
    ...sc,
    id: sc.id || `S${idx + 1}`,
    sensory: sc.sensory ?? '',
    subtext: sc.subtext ?? '',
    key_lines: Array.isArray(sc.key_lines) ? sc.key_lines : [],
  }));

  const sceneMapById = new Map<string, string>();
  for (const sc of syncedScenes) {
    if (sc.id) sceneMapById.set(sc.id, sc.name);
  }
  const fallbackScene = syncedScenes[0];

  const resolveRef = (sceneId: string | undefined, currentName: string) => {
    if (sceneId && sceneMapById.has(sceneId)) {
      return { scene_id: sceneId, scene: sceneMapById.get(sceneId)! };
    }
    const byName = syncedScenes.find((s) => s.name === currentName);
    if (byName) {
      return { scene_id: byName.id || 'S1', scene: byName.name };
    }
    if (fallbackScene) {
      return { scene_id: fallbackScene.id || 'S1', scene: fallbackScene.name };
    }
    return { scene_id: sceneId || 'S1', scene: currentName };
  };

  const winRef = resolveRef(blueprint.win.scene_id, blueprint.win.scene);

  return {
    ...blueprint,
    prose_tone: blueprint.prose_tone ?? '',
    info_gap: blueprint.info_gap ?? '',
    avoid: Array.isArray(blueprint.avoid) ? blueprint.avoid : [],
    scenes: syncedScenes,
    win: {
      ...blueprint.win,
      scene_id: winRef.scene_id,
      scene: winRef.scene,
    },
    laugh: blueprint.laugh.map((item) => {
      const ref = resolveRef(item.scene_id, item.scene);
      return { ...item, scene_id: ref.scene_id, scene: ref.scene };
    }),
    threads: {
      plant: blueprint.threads.plant.map((item) => {
        const ref = resolveRef(item.scene_id, item.scene);
        return { ...item, scene_id: ref.scene_id, scene: ref.scene };
      }),
      payoff: blueprint.threads.payoff.map((item) => {
        const ref = resolveRef(item.scene_id, item.scene);
        return { ...item, scene_id: ref.scene_id, scene: ref.scene };
      }),
    },
  };
}

/**
 * Serializes an EpisodeNarrativeBlueprint into the clean, pure v2 JSON schema
 * (omitting internal UI helper properties like scene_id / target_chars while keeping
 * all standard fields and populated v2 enrichment slots).
 */
export function toPureBlueprintJson(blueprint: EpisodeNarrativeBlueprint): EpisodeNarrativeBlueprint {
  const synced = syncBlueprintSceneNames(blueprint);

  const cleanScenes: NarrativeScene[] = synced.scenes.map((sc) => {
    const out: NarrativeScene = {
      name: sc.name,
      lines: sc.lines,
      tension: sc.tension,
      cast: sc.cast,
      hostile: sc.hostile,
      terms: sc.terms,
      note: sc.note,
      anchors: sc.anchors,
    };
    if (sc.sensory?.trim()) out.sensory = sc.sensory.trim();
    if (sc.subtext?.trim()) out.subtext = sc.subtext.trim();
    const cleanedKeyLines = (sc.key_lines ?? []).map((l) => l.trim()).filter(Boolean);
    if (cleanedKeyLines.length > 0) out.key_lines = cleanedKeyLines;
    return out;
  });

  const pure: EpisodeNarrativeBlueprint = {
    episode: synced.episode,
    title: synced.title,
    cast_file: synced.cast_file,
    pov: synced.pov,
    goal: synced.goal,
    must: synced.must.filter((m) => m.trim().length > 0),
    inner: synced.inner,
    prev: synced.prev,
    ...(synced.prose_tone?.trim() ? { prose_tone: synced.prose_tone.trim() } : {}),
    ...(synced.info_gap?.trim() ? { info_gap: synced.info_gap.trim() } : {}),
    ...((synced.avoid ?? []).filter((a) => a.trim().length > 0).length > 0
      ? { avoid: (synced.avoid ?? []).map((a) => a.trim()).filter(Boolean) }
      : {}),
    stake: synced.stake,
    win: {
      what: synced.win.what,
      scene: synced.win.scene,
      reaction: synced.win.reaction,
      stretch: synced.win.stretch,
    },
    laugh: synced.laugh.map((l) => ({ scene: l.scene, what: l.what })),
    relation: synced.relation.map((r) => ({ who: r.who, from: r.from, to: r.to })),
    ending: {
      type: synced.ending.type,
      what: synced.ending.what,
    },
    threads: {
      plant: synced.threads.plant.map((p) => ({ what: p.what, scene: p.scene, to: p.to })),
      payoff: synced.threads.payoff.map((p) => ({ what: p.what, scene: p.scene })),
    },
    scenes: cleanScenes,
  };

  return pure;
}

/**
 * Safely migrates a stored v1 or v2 NovelProject in localStorage so existing data is preserved.
 */
export function migrateProjectToV2(project: NovelProject): NovelProject {
  const migratedBlueprints: Record<number, EpisodeNarrativeBlueprint> = {};
  const targetChars = project.phase2?.basicInfo.targetCharsPerEp || 5000;
  for (const [epKey, bp] of Object.entries(project.blueprints || {})) {
    const epNum = Number(epKey);
    if (!Number.isNaN(epNum) && bp) {
      migratedBlueprints[epNum] = syncBlueprintSceneNames(bp, targetChars);
    }
  }
  const normalizedOverrides: Record<number, WritingRuleProfile> = {};
  if (project.episodeRuleOverrides && typeof project.episodeRuleOverrides === 'object') {
    for (const [epKey, ov] of Object.entries(project.episodeRuleOverrides)) {
      const epNum = Number(epKey);
      if (!Number.isNaN(epNum) && ov) {
        normalizedOverrides[epNum] = normalizeRuleProfile(ov);
      }
    }
  }
  return {
    ...project,
    ruleProfile: normalizeRuleProfile(project.ruleProfile),
    episodeRuleOverrides: normalizedOverrides,
    blueprints: migratedBlueprints,
  };
}

/**
 * Deterministic 6-item 3-Q ("이야기의 힘") diagnostic check for Phase 3 (25화 아크).
 */
export function evaluateThreeQDiagnostics(
  arcPlan: ArcPlan | null,
  setting: SettingBible | null
): ThreeQDiagnosticItem[] {
  const singleKicks = (arcPlan?.kickEvents ?? []).filter((k) => k.type === '단발 킥이벤트');
  const epicKicks = (arcPlan?.kickEvents ?? []).filter((k) => k.type === '대서사 필수');
  const blocks = arcPlan?.blocks ?? [];

  const goalOk = Boolean(
    arcPlan?.arcGoal.trim().length &&
      arcPlan.arcGoal.trim().length >= 20 &&
      setting?.narrativeEngine.oneLineAnswer.trim()
  );
  const q1: ThreeQDiagnosticItem = {
    id: '3q-1',
    code: 'Q1',
    title: '욕망·목표 선명도 (서사 엔진)',
    status: goalOk ? '충족' : arcPlan?.arcGoal.trim() ? '보완 필요' : '위험',
    score: goalOk ? 95 : arcPlan?.arcGoal.trim() ? 60 : 25,
    detail: goalOk
      ? '1권 아크 목표와 서사 엔진 한 줄 답이 구체적으로 연결되어 있습니다.'
      : '아크 목표(20자 이상)와 Phase 2 서사 엔진의 주인공 목표를 더 구체화하세요.',
    actionHint: '주인공이 25화까지 반드시 얻거나 지켜야 할 구체적 대상을 명시하세요.',
  };

  const kickDensityOk = singleKicks.length >= 7 && singleKicks.length <= 10 && epicKicks.length >= 2 && epicKicks.length <= 4;
  const kickDensityPartial = singleKicks.length >= 4 && epicKicks.length >= 1;
  const q2: ThreeQDiagnosticItem = {
    id: '3q-2',
    code: 'Q2',
    title: '100원 텐션 밀도 (킥이벤트 구성)',
    status: kickDensityOk ? '충족' : kickDensityPartial ? '보완 필요' : '위험',
    score: kickDensityOk ? 96 : kickDensityPartial ? 65 : 30,
    detail: `단발 킥이벤트 ${singleKicks.length}개 (권장 7~10개) · 대서사 필수 ${epicKicks.length}개 (권장 2~3개)`,
    actionHint: '매 2~3화마다 작은 사이다(단발 킥)가 터지도록 7~10개를 5개 블록에 고르게 배치하세요.',
  };

  const block3 = blocks.find((b) => b.blockIndex === 2);
  const block3Events = (arcPlan?.kickEvents ?? []).filter((k) => k.assignedBlockIndex === 2);
  const q3Ok = Boolean(
    block3?.keyBeat.trim() &&
      block3Events.length >= 1 &&
      (setting?.narrativeEngine.infoGap.trim().length ?? 0) >= 12
  );
  const q3: ThreeQDiagnosticItem = {
    id: '3q-3',
    code: 'Q3',
    title: '전환점 폭발력 (11~15화 정보 낙차)',
    status: q3Ok ? '충족' : block3?.keyBeat.trim() ? '보완 필요' : '위험',
    score: q3Ok ? 92 : block3?.keyBeat.trim() ? 60 : 25,
    detail: q3Ok
      ? `전환 블록(11~15화)에 ${block3Events.length}개 핵심 이벤트와 정보 낙차가 결합되어 있습니다.`
      : '11~15화 전환 구간은 투베 상승의 분기점입니다. 핵심 반전 이벤트를 배치하세요.',
    actionHint: '독자만 알던 주인공의 패가 공개되며 주변 평가가 뒤집히는 장면을 11~15화에 배치하세요.',
  };

  const freeZoneCounts = [0, 1, 2].map(
    (idx) => (arcPlan?.kickEvents ?? []).filter((k) => k.assignedBlockIndex === idx).length
  );
  const freeZoneBalanced = freeZoneCounts.every((c) => c >= 1) && freeZoneCounts.reduce((a, b) => a + b, 0) >= 5;
  const q4: ThreeQDiagnosticItem = {
    id: '3q-4',
    code: '투베',
    title: '무료 연재 구간(1~15화) 사건 배치',
    status: freeZoneBalanced ? '충족' : freeZoneCounts.reduce((a, b) => a + b, 0) >= 3 ? '보완 필요' : '위험',
    score: freeZoneBalanced ? 94 : freeZoneCounts.reduce((a, b) => a + b, 0) >= 3 ? 62 : 20,
    detail: `도입 ${freeZoneCounts[0]}개 · 확장 ${freeZoneCounts[1]}개 · 전환 ${freeZoneCounts[2]}개 배치`,
    actionHint: '1~15화 무료 구간에 빈 블록이 있으면 투베 진입 전 이탈이 급증합니다.',
  };

  const block5 = blocks.find((b) => b.blockIndex === 4);
  const block5Events = (arcPlan?.kickEvents ?? []).filter((k) => k.assignedBlockIndex === 4);
  const paywallOk = Boolean(
    block5?.cliffhanger.trim().length &&
      block5.cliffhanger.trim().length >= 15 &&
      block5Events.length >= 1
  );
  const q5: ThreeQDiagnosticItem = {
    id: '3q-5',
    code: '유료화',
    title: '25화 유료 전환 훅 (21~25화)',
    status: paywallOk ? '충족' : block5?.cliffhanger.trim() ? '보완 필요' : '위험',
    score: paywallOk ? 95 : block5?.cliffhanger.trim() ? 58 : 20,
    detail: paywallOk
      ? '21~25화 보상 정산 직후 2권으로 이어지는 대형 갈고리가 설계되어 있습니다.'
      : '25화 유료화 직전 클리프행어가 약합니다. 1권 해결과 동시에 더 큰 판을 여세요.',
    actionHint: '1권 빌런 격파로 카타르시스를 준 직후, 상위 흑막이나 새로운 무대를 25화 끝에 투하하세요.',
  };

  const chars = setting?.characters ?? [];
  const hasContrast =
    chars.length >= 2 &&
    chars.every((c) => c.outerPersonality.trim().length > 0 && c.innerPersonality.trim().length > 0 && c.relationshipFlow.trim().length > 0);
  const q6: ThreeQDiagnosticItem = {
    id: '3q-6',
    code: '인물',
    title: '캐릭터 겉/속 낙차 & 관계 진전',
    status: hasContrast ? '충족' : chars.length >= 1 ? '보완 필요' : '위험',
    score: hasContrast ? 90 : chars.length >= 1 ? 55 : 20,
    detail: hasContrast
      ? `등록 인물 ${chars.length}명 모두 겉/속 성격 대비와 관계 변화 흐름이 설계되어 있습니다.`
      : '최소 2명 이상(주인공 + 조력자/빌런)의 겉/속 성격 대비와 관계 흐름을 채우세요.',
    actionHint: '주인공 단독 독백을 줄이려면 반응과 갈등을 만들어 줄 조연·빌런의 낙차가 필수입니다.',
  };

  return [q1, q2, q3, q4, q5, q6];
}

/**
 * Analyzes Phase 0 raw draft / memo for Munpia tone, tempo, N-mark length, and genre warnings.
 */
export function analyzeDraftWarnings(text: string, selectedGenres: string[]): DraftWarning[] {
  const warnings: DraftWarning[] = [];
  const trimmed = text.trim();
  const charCount = trimmed.length;

  if (selectedGenres.includes('라이트노벨')) {
    warnings.push({
      severity: '경고',
      category: '비주류 장르 경고',
      message: '라이트노벨 태그는 문피아 코어 독자층(20~40대 남성)에서 비주류입니다. 사건 위주 건조한 문체로 톤을 조정하세요.',
    });
  }

  if (charCount > 0 && charCount < 3000) {
    warnings.push({
      severity: '주의',
      category: '투베 N마크 분량 기준',
      message: `현재 입력 분량은 ${charCount.toLocaleString()}자입니다. 실제 연재 1화는 최소 3,000자(N 마크 기준), 표준 5,000자 내외를 권장합니다.`,
    });
  }

  const ellipsisMatches = trimmed.match(/(\.\.\.|……)/g)?.length ?? 0;
  const exclamMatches = trimmed.match(/(!\?|\?!|!!)/g)?.length ?? 0;
  if (ellipsisMatches >= 6 || exclamMatches >= 4) {
    warnings.push({
      severity: '경고',
      category: '라노벨식 어투/감정 과잉 감지',
      message: `말줄임표(${ellipsisMatches}회) 또는 감탄부호 중첩(${exclamMatches}회)이 잦습니다. 문피아 독자는 건조하고 힘 있는 단문 전개를 선호합니다.`,
    });
  }

  const paragraphs = trimmed.split(/\n+/).filter((p) => p.trim().length > 0);
  const longInfoParas = paragraphs.filter((p) => p.length > 260 && !p.includes('"') && !p.includes('“'));
  if (longInfoParas.length > 0) {
    warnings.push({
      severity: '주의',
      category: '설명충(Infodump) 구간 주의',
      message: `대사 없이 260자를 초과하는 장문 서술 단락이 ${longInfoParas.length}곳 있습니다. 설정은 대사와 행동 속으로 쪼개 넣으세요.`,
    });
  }

  const dialogueLines = paragraphs.filter((p) => p.includes('"') || p.includes('“') || p.includes("'")).length;
  if (paragraphs.length >= 6 && dialogueLines === 0) {
    warnings.push({
      severity: '권장',
      category: '독백 편중 · 주고받기 부족',
      message: '대사(주고받기)가 전혀 없습니다. 1화 초반부터 타인과의 짧은 대립이나 반응 대사를 섞어야 템포가 살아납니다.',
    });
  }

  return warnings;
}

/**
 * Builds the complete Novel Writer master prompt dynamically from the active
 * WritingRuleProfile (only enabled toggles + selected plotFramework) combined
 * with the pure v2 episode narrative blueprint JSON.
 */
export function buildNovelWriterMasterPrompt(
  blueprint: EpisodeNarrativeBlueprint,
  settingBible?: SettingBible | null,
  ruleProfile?: WritingRuleProfile | null
): string {
  const pure = toPureBlueprintJson(blueprint);
  const pureJson = JSON.stringify(pure, null, 2);
  const profile = normalizeRuleProfile(ruleProfile);
  const presetMeta = RULE_PRESET_META.find((p) => p.id === profile.preset) ?? RULE_PRESET_META[3];
  const frameworkMeta = PLOT_FRAMEWORK_META[profile.plotFramework];
  const dynamicRules = buildDynamicWriterPromptRules(profile, pure.win.scene);

  const targetChars = settingBible?.basicInfo.targetCharsPerEp || 5000;
  const workHeader = settingBible?.title
    ? `작품명: ${settingBible.title} | 회차: ${pure.episode} ${pure.title} | 시점: ${pure.pov} | 목표 분량: 약 ${targetChars.toLocaleString()}자 (최소 3,000자 N마크 충족)`
    : `회차: ${pure.episode} ${pure.title} | 시점: ${pure.pov} | 목표 분량: 약 ${targetChars.toLocaleString()}자 (최소 3,000자 N마크 충족)`;

  const numberedRules = dynamicRules.map((rule, idx) => `${idx + 1}. ${rule}`).join('\n');

  return `# [MUNPIA FORGE v2 · Novel Writer 집필 마스터 프롬프트]
당신은 문피아·네이버 시리즈·카카오페이지 상위권 상업 웹소설 전담 집필가입니다.
아래 [활성 연출·플롯 규칙 프로필]과 [회차 정밀 서사 제어 설계도 JSON]을 100% 준수하여 본문 1화를 집필하십시오.

- ${workHeader}
- 적용 규칙 프로필: ${presetMeta.emoji} ${presetMeta.label} | 플롯 골격: ${frameworkMeta.label}

## 활성 플롯 골격 & 집필 규칙 (ON 항목만 적용)
${numberedRules}

## 회차 정밀 서사 제어 설계도 (Pure v2 JSON)
\`\`\`json
${pureJson}
\`\`\``;
}

const GENERIC_KO_STOPWORDS = new Set([
  '그리고',
  '하지만',
  '통해',
  '위해',
  '대한',
  '하는',
  '있는',
  '없는',
  '한다',
  '된다',
  '으로',
  '에서',
  '까지',
  '부터',
  '자신',
  '주인공',
  '모든',
  '가장',
  '직접',
  '즉시',
  '완전',
]);

function extractKoreanKeywords(text: string): string[] {
  const matches = text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  return Array.from(
    new Set(
      matches
        .map((w) => w.replace(/(으로|에서|까지|부터|에게|한테|에는|에도|과는|와는|이며|이고|이자|만의|들의|들을|들이|들을|이다|하다|하는|하고|한다|된다|되는|은|는|이|가|을|를|의|에|로|과|와|도|만)$/, ''))
        .filter((w) => w.length >= 2 && !GENERIC_KO_STOPWORDS.has(w))
    )
  );
}

/**
 * Local Munpia commercial diagnostics for Phase 3 (25-episode arc).
 * Checks whether the 도입(1~5화) block explicitly reveals protagonist's core weapon,
 * goal, and main supporting character (메인 서브1).
 */
export function analyzeArcWarnings(
  arcPlan: ArcPlan | null,
  setting: SettingBible | null,
  ruleProfile?: WritingRuleProfile | null
): DraftWarning[] {
  if (!arcPlan) return [];
  const profile = normalizeRuleProfile(ruleProfile);
  if (!profile.toggles.revealCardsInEp1To5) {
    return [];
  }
  const warnings: DraftWarning[] = [];

  const introBlock = arcPlan.blocks.find((b) => b.blockIndex === 0);
  const introEvents = arcPlan.kickEvents.filter((k) => k.assignedBlockIndex === 0);
  const introText = [
    introBlock?.goal ?? '',
    introBlock?.keyBeat ?? '',
    introBlock?.cliffhanger ?? '',
    ...introEvents.flatMap((e) => [e.title, e.summary, e.payoffValue]),
  ]
    .join(' ')
    .trim();

  const protagonist = setting?.characters.find((c) => c.role === '주인공') ?? setting?.characters[0];
  const mainSub1 =
    setting?.characters.find((c) => c.role === '히로인/조연') ??
    setting?.characters.find((c) => c.id !== protagonist?.id);

  // 1) Protagonist core weapon / ability check
  const weaponKeywords = [
    ...extractKoreanKeywords(protagonist?.ability ?? ''),
    ...extractKoreanKeywords(setting?.narrativeEngine.coreIrony ?? ''),
    '해독',
    '능력',
    '스킬',
    '무기',
    '기연',
    '각성',
    '시스템',
    '상태창',
    '비술',
    '검술',
    '마법',
    '회귀',
    '특성',
    '권능',
    '활성탄',
    '독성',
  ];
  const hasWeaponInIntro =
    introText.length > 0 && weaponKeywords.some((kw) => kw.length >= 2 && introText.includes(kw));

  // 2) Protagonist goal check
  const goalKeywords = [
    ...extractKoreanKeywords(setting?.narrativeEngine.oneLineAnswer ?? ''),
    ...extractKoreanKeywords(arcPlan.arcGoal ?? ''),
    '생존',
    '복수',
    '목표',
    '통과',
    '확보',
    '반격',
    '추적',
    '탈출',
    '증명',
    '입증',
    '구출',
    '쟁취',
    '해결',
    '성장',
  ];
  const hasGoalInIntro =
    Boolean(introBlock?.goal.trim().length && introBlock.goal.trim().length >= 8) &&
    goalKeywords.some((kw) => kw.length >= 2 && introText.includes(kw));

  // 3) Main supporting character (메인 서브1) check
  let hasMainSubInIntro = false;
  let mainSubLabel = '주요 조연(메인 서브1)';
  if (mainSub1?.name.trim()) {
    const cleanName = mainSub1.name.replace(/\([^)]*\)/g, '').trim();
    mainSubLabel = `주요 조연(${cleanName})`;
    const nameTokens = cleanName.split(/\s+/).filter((t) => t.length >= 2);
    hasMainSubInIntro =
      introText.includes(cleanName) ||
      nameTokens.some((token) => introText.includes(token));
  } else {
    hasMainSubInIntro = /(조력자|히로인|동료|파트너|조연|사부|스승|제자)/.test(introText);
  }

  const missingElements: string[] = [];
  if (!hasWeaponInIntro) missingElements.push('주인공 핵심 무기/능력');
  if (!hasGoalInIntro) missingElements.push('주인공 목표');
  if (!hasMainSubInIntro) missingElements.push(mainSubLabel);

  if (missingElements.length > 0) {
    warnings.push({
      severity: '경고',
      category: '도입(1~5화) 핵심 패 미배치',
      message: `초반 5화 내에 패를 전부 공개해야 투베 생존율이 올라갑니다. (1~5화 도입 블록 미확인: ${missingElements.join(', ')})`,
    });
  }

  return warnings;
}

const CLICKBAIT_ENDING_PATTERNS: RegExp[] = [
  /(\.{2,}|…+)\s*직전/,
  /(정체|비밀|진실|흑막|보상|결과|정답|범인|정체불명|정수).{0,18}(밝혀지려|드러나려|열리려|공개되려|알려지려|확인하려|말하려|찰나|직전)/,
  /(밝혀지려|드러나려|공개되려|열리려|말하려|확인하려|꺼내려|보이려|터지려).{0,12}(찰나|직전|순간)/,
];

const ACTION_UTILIZATION_BEFORE_JIKJEON = /(활용|개시|실행|사용|돌입|출발|투입|착수|공격|발동|시전|도전|입장|반격|행동)\s*(하기\s*)?직전/;

/**
 * Local Munpia 100-won value & tension diagnostics for a single EpisodeNarrativeBlueprint:
 * - Flags clickbait withholding endings in `ending.what`.
 * - Flags eventless solo scenes (cast < 2, not win.scene, no 판단/수쓰기 anchor).
 */
export function analyzeBlueprintWarnings(
  blueprint: EpisodeNarrativeBlueprint | null,
  ruleProfile?: WritingRuleProfile | null
): DraftWarning[] {
  if (!blueprint) return [];
  const profile = normalizeRuleProfile(ruleProfile);
  const warnings: DraftWarning[] = [];

  // 1. Clickbait ending detection (active only when revealBeforeCutEnding is ON)
  if (profile.toggles.revealBeforeCutEnding) {
    const endingWhat = (blueprint.ending?.what ?? '').trim();
    if (endingWhat) {
      const matchedExplicitBait = CLICKBAIT_ENDING_PATTERNS.some((re) => re.test(endingWhat));
      const hasGenericWithholdingJikjeon =
        /직전/.test(endingWhat) && !ACTION_UTILIZATION_BEFORE_JIKJEON.test(endingWhat);

      if (matchedExplicitBait || hasGenericWithholdingJikjeon) {
        warnings.push({
          severity: '주의',
          category: '엔딩 낚시성 표현 감지 (ending.what)',
          message: '보상을 먼저 공개하고 활용 직전에 끊는 것이 편당결제 이탈을 막습니다.',
        });
      }
    }
  }

  // 2. Eventless solo scene detection (active only when cutNoChangeScenes is ON)
  if (profile.toggles.cutNoChangeScenes) {
    blueprint.scenes.forEach((sc, idx) => {
      const sKey = sc.id || `S${idx + 1}`;
      const castCount = (sc.cast ?? []).map((c) => c.trim()).filter(Boolean).length;
      const hasDialogue = castCount >= 2;
      const isWinScene = Boolean(
        (blueprint.win.scene_id && sc.id && blueprint.win.scene_id === sc.id) ||
          (blueprint.win.scene && blueprint.win.scene === sc.name)
      );
      const hasReasoningTag = (sc.anchors ?? []).some(
        ([tag]) => tag === '판단' || tag === '수쓰기'
      );

      if (!hasDialogue && !isWinScene && !hasReasoningTag) {
        warnings.push({
          severity: '권장',
          category: `단독 씬 스킵 권장 (${sKey} · ${sc.name})`,
          message: '사건 없는 단독 씬은 요약 한 줄로 스킵하는 것을 권장합니다.',
        });
      }
    });
  }

  return warnings;
}

/**
 * Validates and parses both v1 and v2 EpisodeNarrativeBlueprint JSON strings safely,
 * auto-hydrating missing v2 optional fields with safe empty defaults.
 */
export function parseBlueprintJson(
  rawJson: string
): { ok: true; data: EpisodeNarrativeBlueprint } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '유효한 JSON 객체가 아닙니다.' };
    }
    if (typeof parsed.episode !== 'string' || typeof parsed.title !== 'string') {
      return { ok: false, error: '필수 필드 "episode" 및 "title"이 문자열이어야 합니다.' };
    }
    if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
      return { ok: false, error: '"scenes" 배열에 최소 1개 이상의 씬이 포함되어야 합니다.' };
    }

    const normalizedScenes: NarrativeScene[] = parsed.scenes.map((s: Record<string, unknown>, idx: number) => ({
      id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `S${idx + 1}`,
      name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : `씬 ${idx + 1}`,
      lines: typeof s.lines === 'number' && s.lines > 0 ? Math.round(s.lines) : 35,
      target_chars: typeof s.target_chars === 'number' && s.target_chars > 0 ? Math.round(s.target_chars) : 1250,
      tension: ([1, 2, 3, 4, 5].includes(Number(s.tension)) ? Number(s.tension) : 3) as 1 | 2 | 3 | 4 | 5,
      cast: Array.isArray(s.cast) ? s.cast.map(String) : [],
      hostile: Boolean(s.hostile),
      terms: Array.isArray(s.terms) ? s.terms.map(String) : [],
      note: typeof s.note === 'string' ? s.note : '',
      anchors: Array.isArray(s.anchors)
        ? s.anchors
            .filter((a: unknown) => Array.isArray(a) && a.length >= 2)
            .map((a: unknown[]) => {
              const rawTag = String(a[0]) as AnchorTag;
              const safeTag: AnchorTag = VALID_ANCHOR_TAGS.has(rawTag) ? rawTag : '상황';
              return [safeTag, String(a[1])] as [AnchorTag, string];
            })
        : [],
      sensory: typeof s.sensory === 'string' ? s.sensory : '',
      subtext: typeof s.subtext === 'string' ? s.subtext : '',
      key_lines: Array.isArray(s.key_lines) ? s.key_lines.map(String) : [],
    }));

    const endingType: EndingType = VALID_ENDINGS.includes(parsed.ending?.type) ? parsed.ending.type : '위기';

    const bp: EpisodeNarrativeBlueprint = {
      episode: parsed.episode,
      title: parsed.title,
      cast_file: typeof parsed.cast_file === 'string' ? parsed.cast_file : 'labs/runs/project/cast.md',
      pov: typeof parsed.pov === 'string' ? parsed.pov : "1인칭 '나'",
      prev: typeof parsed.prev === 'string' ? parsed.prev : null,
      goal: typeof parsed.goal === 'string' ? parsed.goal : '',
      stake: typeof parsed.stake === 'string' ? parsed.stake : '',
      inner: typeof parsed.inner === 'string' ? parsed.inner : '서술의 25~35%',
      must: Array.isArray(parsed.must) ? parsed.must.map(String) : [],
      prose_tone: typeof parsed.prose_tone === 'string' ? parsed.prose_tone : '',
      info_gap: typeof parsed.info_gap === 'string' ? parsed.info_gap : '',
      avoid: Array.isArray(parsed.avoid) ? parsed.avoid.map(String) : [],
      win: {
        what: typeof parsed.win?.what === 'string' ? parsed.win.what : '',
        scene_id: typeof parsed.win?.scene_id === 'string' ? parsed.win.scene_id : undefined,
        scene: typeof parsed.win?.scene === 'string' ? parsed.win.scene : normalizedScenes[0].name,
        reaction: typeof parsed.win?.reaction === 'string' ? parsed.win.reaction : '',
        stretch: Boolean(parsed.win?.stretch),
      },
      laugh: Array.isArray(parsed.laugh)
        ? parsed.laugh.map((l: Record<string, unknown>) => ({
            scene_id: typeof l.scene_id === 'string' ? l.scene_id : undefined,
            scene: typeof l.scene === 'string' ? l.scene : '',
            what: typeof l.what === 'string' ? l.what : '',
          }))
        : [],
      relation: Array.isArray(parsed.relation)
        ? parsed.relation.map((r: Record<string, unknown>) => ({
            who: typeof r.who === 'string' ? r.who : '',
            from: typeof r.from === 'string' ? r.from : '',
            to: typeof r.to === 'string' ? r.to : '',
          }))
        : [],
      ending: {
        type: endingType,
        what: typeof parsed.ending?.what === 'string' ? parsed.ending.what : '',
      },
      threads: {
        plant: Array.isArray(parsed.threads?.plant)
          ? parsed.threads.plant.map((t: Record<string, unknown>) => ({
              what: typeof t.what === 'string' ? t.what : '',
              scene_id: typeof t.scene_id === 'string' ? t.scene_id : undefined,
              scene: typeof t.scene === 'string' ? t.scene : '',
              to: typeof t.to === 'string' ? t.to : '',
            }))
          : [],
        payoff: Array.isArray(parsed.threads?.payoff)
          ? parsed.threads.payoff.map((t: Record<string, unknown>) => ({
              what: typeof t.what === 'string' ? t.what : '',
              scene_id: typeof t.scene_id === 'string' ? t.scene_id : undefined,
              scene: typeof t.scene === 'string' ? t.scene : '',
            }))
          : [],
      },
      scenes: normalizedScenes,
    };

    return { ok: true, data: syncBlueprintSceneNames(bp) };
  } catch (err) {
    return {
      ok: false,
      error: `JSON 구문 오류: ${err instanceof Error ? err.message : '형식을 확인하세요.'}`,
    };
  }
}

/**
 * Validates and parses a full NovelProject backup JSON string safely (v1 & v2 compatible).
 */
export function parseProjectBackupJson(
  rawJson: string
): { ok: true; data: NovelProject } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: '유효한 프로젝트 JSON 객체가 아닙니다.' };
    }
    if (!parsed.phase0 || typeof parsed.phase0.workingTitle !== 'string') {
      return { ok: false, error: '프로젝트 파일에 phase0.workingTitle 정보가 없습니다.' };
    }
    const validPhases = ['dump', 0, 1, 2, 3, 4, 'memory'];
    const project: NovelProject = {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : `proj-import-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      currentPhase: validPhases.includes(parsed.currentPhase) ? parsed.currentPhase : 0,
      brainDumpText: typeof parsed.brainDumpText === 'string' ? parsed.brainDumpText : '',
      aiEstimatedFields: Array.isArray(parsed.aiEstimatedFields)
        ? parsed.aiEstimatedFields.map(String)
        : [],
      lastBrainDumpReport: parsed.lastBrainDumpReport ?? null,
      ruleProfile: parsed.ruleProfile ? normalizeRuleProfile(parsed.ruleProfile) : undefined,
      episodeRuleOverrides:
        parsed.episodeRuleOverrides && typeof parsed.episodeRuleOverrides === 'object'
          ? parsed.episodeRuleOverrides
          : undefined,
      phase0: {
        workingTitle: parsed.phase0.workingTitle,
        rawIdeaOrPrologue: String(parsed.phase0.rawIdeaOrPrologue ?? ''),
        selectedGenres: Array.isArray(parsed.phase0.selectedGenres) ? parsed.phase0.selectedGenres.map(String) : [],
        selectedKeywords: Array.isArray(parsed.phase0.selectedKeywords) ? parsed.phase0.selectedKeywords.map(String) : [],
        selectedHookPatternId: String(parsed.phase0.selectedHookPatternId ?? ''),
        targetVolumePlan:
          parsed.phase0.targetVolumePlan === '200화 단축형 (8권)' ? '200화 단축형 (8권)' : '500화 표준 3막 (20권)',
        authorNotes: String(parsed.phase0.authorNotes ?? ''),
      },
      phase1: parsed.phase1 ?? null,
      phase2: parsed.phase2 ?? null,
      phase3: parsed.phase3 ?? null,
      phase4Blocks: Array.isArray(parsed.phase4Blocks) ? parsed.phase4Blocks : [],
      blueprints: parsed.blueprints && typeof parsed.blueprints === 'object' ? parsed.blueprints : {},
    };
    return { ok: true, data: migrateProjectToV2(project) };
  } catch (err) {
    return {
      ok: false,
      error: `백업 파일 파싱 실패: ${err instanceof Error ? err.message : 'JSON 형식을 확인하세요.'}`,
    };
  }
}

export function createDefaultBlueprintForEpisode(
  episodeNumber: number,
  title: string,
  prevSummary: string | null,
  pov = "1인칭 '나'",
  castNames: string[] = ['주인공']
): EpisodeNarrativeBlueprint {
  const base: EpisodeNarrativeBlueprint = {
    episode: `${episodeNumber}화`,
    title: title || `${episodeNumber}화 제목 미정`,
    cast_file: 'labs/runs/project/cast.md',
    pov,
    prev: prevSummary,
    goal: '이번 화의 핵심 목표와 주인공의 수단을 입력하세요.',
    stake: '실패 시 감당해야 할 치명적 대가를 입력하세요.',
    inner: '서술의 25~35% (행동과 판단 중심)',
    must: ['핵심 사건 1', '100원 가치 사이다 장면', '다음 화 결제 갈고리'],
    prose_tone: '위기 구간은 짧은 단문 호흡으로 몰아치고, 추리·판단 순간에는 냉철하고 건조한 어조 유지',
    info_gap: '주인공과 독자만 아는 결정적 해법 vs 주변 인물들의 착각',
    avoid: ['세계관 설정을 3줄 이상 설명충으로 늘어놓지 말 것', '과도한 말줄임표(...)와 감정 독백 금지'],
    win: {
      what: '이번 화의 결정적 성취 또는 역전 장면',
      scene_id: 'S3',
      scene: '전개 및 역전',
      reaction: '주변 인물의 즉각적 충격/인정 반응',
      stretch: true,
    },
    laugh: [
      {
        scene_id: 'S2',
        scene: '문제 심화',
        what: '긴장 속 짧은 유머 또는 온도 차 포인트',
      },
    ],
    relation: [
      {
        who: castNames[1] ?? '주요 조연',
        from: '경계',
        to: '호기심/인정',
      },
    ],
    ending: {
      type: '위기',
      what: '다음 화(100원)를 누르게 만드는 엔딩 훅',
    },
    threads: {
      plant: [
        {
          what: '향후 회수할 복선 단서',
          scene_id: 'S4',
          scene: '여운과 갈고리',
          to: `${episodeNumber + 2}화 회수 예정`,
        },
      ],
      payoff: [],
    },
    scenes: [
      {
        id: 'S1',
        name: '도입 상황',
        lines: 30,
        target_chars: 900,
        tension: 3,
        cast: [castNames[0] ?? '주인공'],
        hostile: false,
        terms: [],
        note: '이전 화 직후로 바로 연결, 군더더기 회상 배제',
        sensory: '',
        subtext: '',
        key_lines: [],
        anchors: [
          ['상황', '씬 시작 시점과 현장 감각 제시'],
          ['문제', '이번 화를 관통할 즉각적 난관 등장'],
        ],
      },
      {
        id: 'S2',
        name: '문제 심화',
        lines: 45,
        target_chars: 1365,
        tension: 4,
        cast: castNames.slice(0, 2),
        hostile: true,
        terms: [],
        note: '인물 간 주고받기로 갈등과 정보 낙차를 선명하게 대비',
        sensory: '',
        subtext: '',
        key_lines: [],
        anchors: [
          ['주고받기', '적대자 또는 조연과의 대립/대화'],
          ['판단', '주인공만의 통찰로 돌파구 포착'],
          ['목표', '행동 방향 확정'],
        ],
      },
      {
        id: 'S3',
        name: '전개 및 역전',
        lines: 55,
        target_chars: 1670,
        tension: 5,
        cast: castNames.slice(0, 3),
        hostile: true,
        terms: [],
        note: '카타르시스 순간은 호흡을 늘리고 주변 반응을 선명하게 배치',
        sensory: '',
        subtext: '',
        key_lines: [],
        anchors: [
          ['수쓰기', '주인공의 핵심 해법 실행'],
          ['이김', '핵심 사이다/성취 달성'],
          ['풀이', '주변 인물의 경악과 보상 확인'],
        ],
      },
      {
        id: 'S4',
        name: '여운과 갈고리',
        lines: 35,
        target_chars: 1065,
        tension: 4,
        cast: [castNames[0] ?? '주인공'],
        hostile: false,
        terms: [],
        note: '설명 없이 다음 위기나 정보 한 줄을 투하하며 절단',
        sensory: '',
        subtext: '',
        key_lines: [],
        anchors: [
          ['풀이', '얻은 정보 또는 변화 정리'],
          ['갈고리', '다음 화 클릭을 강제하는 엔딩 훅'],
        ],
      },
    ],
  };

  return syncBlueprintSceneNames(base, 5000);
}
