import type {
  AnchorTag,
  EndingType,
  EpisodeNarrativeBlueprint,
  NarrativeScene,
  SceneSuggestionResult,
} from './blueprint';

export type {
  AnchorTag,
  EndingType,
  EpisodeNarrativeBlueprint,
  NarrativeScene,
  SceneSuggestionResult,
};

export type WorkflowPhase = 'dump' | 0 | 1 | 2 | 3 | 4 | 5 | 'memory';

export type RuleProfilePreset = 'vol1_survival' | 'main_climax' | 'breather_buildup' | 'custom';

export type PlotFramework =
  | 'three_step_change'
  | 'nine_step_loop'
  | 'fast_cider'
  | 'slice_buildup'
  | 'freeform';

export interface WritingRuleToggles {
  cutNoChangeScenes: boolean;
  reverseBuildup: boolean;
  fractalSceneConflict: boolean;
  boredomBuffer: boolean;
  secondChorusEscalation: boolean;
  shortSentencePace: boolean;
  stretchRewardScene: boolean;
  revealBeforeCutEnding: boolean;
  revealCardsInEp1To5: boolean;
}

export interface WritingRuleProfile {
  preset: RuleProfilePreset;
  plotFramework: PlotFramework;
  toggles: WritingRuleToggles;
}

export interface BrainDumpReport {
  mode: 'new' | 'merge';
  parsedAt: string;
  workingTitle: string;
  settingReady: boolean;
  characterCount: number;
  arcBlockCount: number;
  kickEventCount: number;
  blueprintEpisodes: number[];
  quotedKeyLinesCount: number;
  estimatedFieldCount: number;
}

export interface BrainDumpParseResult {
  workingTitle: string;
  genres: string[];
  keywords: string[];
  targetVolumePlan: '200화 단축형 (8권)' | '500화 표준 3막 (20권)';
  proseTone: string;
  avoid: string[];
  phase1: PreReadAnalysis;
  phase2: SettingBible;
  phase3: ArcPlan;
  phase4Blocks: EpisodeBlockGuide[];
  blueprints: Array<{
    episodeNumber: number;
    blueprint: EpisodeNarrativeBlueprint;
  }>;
  inferredFields: string[];
}

export interface Phase0Input {
  workingTitle: string;
  rawIdeaOrPrologue: string;
  selectedGenres: string[];
  selectedKeywords: string[];
  selectedHookPatternId: string;
  targetVolumePlan: '200화 단축형 (8권)' | '500화 표준 3막 (20권)';
  authorNotes: string;
}

export interface UndecidedQuestion {
  id: string;
  question: string;
  context: string;
  options: string[];
  selectedOption: string;
  customAnswer: string;
}

export interface PreReadAnalysis {
  genreMix: Array<{ genre: string; ratio: number }>;
  munpiaFitSummary: string;
  munpiaFitLevel: '최적' | '적합' | '조정 권장' | '비주류 주의';
  targetReader: string;
  protagonistProfile: {
    personality: string;
    coreConflict: string;
    desire: string;
  };
  worldCoreRule: string;
  narrativeEngineOneLine: string;
  toneRatio: {
    comedy: number;
    serious: number;
    note: string;
  };
  ep25HookCandidates: string[];
  tobeAppealPoints: string[];
  warnings: string[];
  undecidedQuestions: UndecidedQuestion[];
  confirmed: boolean;
}

export interface CharacterCard {
  id: string;
  name: string;
  role: '주인공' | '히로인/조연' | '빌런';
  archetypeNumber: number;
  archetypeName: string;
  outerPersonality: string;
  innerPersonality: string;
  ability: string;
  relationshipFlow: string;
  speechNote: string;
}

export interface SettingBible {
  title: string;
  subtitleOrLogline: string;
  basicInfo: {
    genres: string[];
    keywords: string[];
    pov: string;
    serializationGoal: string;
    targetCharsPerEp: number;
  };
  narrativeEngine: {
    coreIrony: string;
    infoGap: string;
    payPerEpDriver: string;
    oneLineAnswer: string;
  };
  worldview: {
    eraAndSetting: string;
    coreRules: string[];
    terminology: Array<{ term: string; meaning: string }>;
  };
  characters: CharacterCard[];
  storyRoadmap: {
    ep1To25: string;
    ep26To50: string;
    ep51Plus: string;
  };
  munpiaStrategyMemo: string;
  pendingItems: string[];
  confirmed: boolean;
}

export interface KickEventItem {
  id: string;
  type: '단발 킥이벤트' | '대서사 필수';
  title: string;
  summary: string;
  assignedBlockIndex: number; // 0..4
  payoffValue: string;
}

export interface ArcBlockPlan {
  blockIndex: number; // 0..4
  label: string;
  epRange: string;
  role: string;
  goal: string;
  keyBeat: string;
  cliffhanger: string;
}

export interface ThreeQDiagnosticItem {
  id: string;
  code: string;
  title: string;
  status: '충족' | '보완 필요' | '위험';
  score: number; // 0..100
  detail: string;
  actionHint: string;
}

export interface ArcPlan {
  arcNumber: number;
  title: string;
  epRange: string;
  arcGoal: string;
  kickEvents: KickEventItem[];
  blocks: ArcBlockPlan[];
  confirmed: boolean;
}

export interface EpisodeGuideRow {
  episodeNumber: number;
  episodeLabel: string;
  oneLineTitle: string;
  opening: string;
  coreIncident: string;
  ending: string;
  value100Won: string;
  serviceScene: string;
}

export interface EpisodeBlockGuide {
  blockIndex: number;
  epRange: string;
  blockGoal: string;
  episodes: EpisodeGuideRow[];
  checklist: Array<{ id: string; text: string; checked: boolean }>;
}

export interface SceneDraft {
  sceneId: string;
  sceneName: string;
  text: string;
  updatedAt: string;
  charCountWithSpaces: number;
  charCountNoSpaces: number;
}

export interface EpisodeManuscript {
  episodeNumber: number;
  title: string;
  sceneDrafts: Record<string, SceneDraft>;
  sceneSummaries?: Record<string, string>;
  customFullText?: string | null;
  styleMemo: string;
  updatedAt: string;
}

export interface NovelProject {
  id: string;
  updatedAt: string;
  currentPhase: WorkflowPhase;
  brainDumpText?: string;
  aiEstimatedFields?: string[];
  lastBrainDumpReport?: BrainDumpReport | null;
  ruleProfile?: WritingRuleProfile;
  episodeRuleOverrides?: Record<number, WritingRuleProfile>;
  phase0: Phase0Input;
  phase1: PreReadAnalysis | null;
  phase2: SettingBible | null;
  phase3: ArcPlan | null;
  phase4Blocks: EpisodeBlockGuide[];
  blueprints: Record<number, EpisodeNarrativeBlueprint>;
  manuscripts?: Record<number, EpisodeManuscript>;
}

export interface DraftWarning {
  severity: '경고' | '주의' | '권장';
  category: string;
  message: string;
}

export type BrainDumpAuditStatus = 'ready' | 'needs_more' | 'warning';

export type BrainDumpMissingCategory =
  | '주인공/욕망'
  | '능력/제약'
  | '갈등/빌런'
  | '1화 사건'
  | '세계관 룰'
  | '톤/타깃';

export interface BrainDumpAuditMissingItem {
  id: string;
  category: BrainDumpMissingCategory;
  reason: string;
  question: string;
  quickOptions: string[];
}

export type BrainDumpFlagIssueType =
  | '설정 모순'
  | '상업/이탈 위험'
  | '플랫폼/수위 주의'
  | '규칙 충돌';

export interface BrainDumpAuditFlag {
  id: string;
  severity: 'high' | 'medium';
  issueType: BrainDumpFlagIssueType;
  quotedPart: string;
  reason: string;
  fixSuggestions: string[];
}

export interface BrainDumpAuditResult {
  status: BrainDumpAuditStatus;
  sufficiencyScore: number;
  verdictSummary: string;
  missingItems: BrainDumpAuditMissingItem[];
  inappropriateFlags: BrainDumpAuditFlag[];
}
