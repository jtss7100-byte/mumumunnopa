import type {
  ArcPlan,
  BrainDumpParseResult,
  EpisodeBlockGuide,
  EpisodeGuideRow,
  EpisodeNarrativeBlueprint,
  NarrativeScene,
  NovelProject,
  Phase0Input,
  PreReadAnalysis,
  SceneSuggestionResult,
  SettingBible,
} from '../types/novelPlanner';
import { syncBlueprintSceneNames } from '../utils/munpiaEngine';

export interface Deep3QDiagnosis {
  overallVerdict: string;
  paywallReadiness: string;
  weakPoints: string[];
  upgrades: string[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || `서버 요청 실패 (HTTP ${res.status})`);
  }
  return payload.data as T;
}

export async function requestPreReadAI(phase0: Phase0Input): Promise<PreReadAnalysis> {
  return postJson<PreReadAnalysis>('/api/ai/preread', { phase0 });
}

export async function requestSettingBibleAI(
  phase0: Phase0Input,
  phase1: PreReadAnalysis
): Promise<SettingBible> {
  return postJson<SettingBible>('/api/ai/setting', { phase0, phase1 });
}

export async function requestArcPlanAI(phase2: SettingBible): Promise<ArcPlan> {
  return postJson<ArcPlan>('/api/ai/arc', { phase2 });
}

export async function requestDeep3QDiagnosisAI(
  phase2: SettingBible | null,
  phase3: ArcPlan
): Promise<Deep3QDiagnosis> {
  return postJson<Deep3QDiagnosis>('/api/ai/diagnose-3q', { phase2, phase3 });
}

export async function requestBlockGuideAI(
  phase2: SettingBible,
  phase3: ArcPlan,
  blockIndex: number
): Promise<EpisodeBlockGuide> {
  return postJson<EpisodeBlockGuide>('/api/ai/block-guide', { phase2, phase3, blockIndex });
}

export async function requestBlueprintAI(
  phase2: SettingBible,
  episodeGuide: EpisodeGuideRow,
  prevSummary: string | null
): Promise<EpisodeNarrativeBlueprint> {
  const raw = await postJson<EpisodeNarrativeBlueprint>('/api/ai/blueprint', {
    phase2,
    episodeGuide,
    prevSummary,
  });
  return syncBlueprintSceneNames(raw, phase2.basicInfo.targetCharsPerEp || 5000);
}

export async function requestAssembleBlueprintFromMemoAI(
  phase2: SettingBible | null,
  episodeNumber: number,
  memo: string,
  prevSummary: string | null
): Promise<EpisodeNarrativeBlueprint> {
  const raw = await postJson<EpisodeNarrativeBlueprint>('/api/ai/blueprint-assemble', {
    phase2,
    episodeNumber,
    memo,
    prevSummary,
  });
  return syncBlueprintSceneNames(raw, phase2?.basicInfo.targetCharsPerEp || 5000);
}

export async function requestSceneSuggestionAI(
  blueprint: EpisodeNarrativeBlueprint,
  scene: NarrativeScene
): Promise<SceneSuggestionResult> {
  return postJson<SceneSuggestionResult>('/api/ai/scene-suggest', { blueprint, scene });
}

export async function requestBrainDumpParseAI(
  memo: string,
  mode: 'new' | 'merge',
  existingProject?: NovelProject | null
): Promise<BrainDumpParseResult> {
  const existingSummary =
    mode === 'merge' && existingProject
      ? {
          workingTitle: existingProject.phase2?.title || existingProject.phase0.workingTitle,
          characters: existingProject.phase2?.characters?.map((c) => ({
            name: c.name,
            role: c.role,
          })),
          existingBlueprints: Object.keys(existingProject.blueprints).map(Number),
          arcGoal: existingProject.phase3?.arcGoal ?? '',
        }
      : null;

  return postJson<BrainDumpParseResult>('/api/ai/brain-dump', {
    memo,
    mode,
    existingSummary,
  });
}
