import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SEED_MUNPIA_PROJECT } from '../data/seedProject.ts';
import {
  analyzeArcWarnings,
  analyzeBlueprintWarnings,
  buildNovelWriterMasterPrompt,
  toPureBlueprintJson,
} from './munpiaEngine.ts';
import {
  buildDynamicRulesInstruction,
  createRuleProfileFromPreset,
  detectMatchingPreset,
} from './ruleProfileEngine.ts';

describe('Rule Profile Controller & Dynamic Engine', () => {
  it('constructs exact preset combinations for vol1_survival, main_climax, and breather_buildup', () => {
    const vol1 = createRuleProfileFromPreset('vol1_survival');
    assert.equal(vol1.plotFramework, 'three_step_change');
    assert.equal(vol1.toggles.cutNoChangeScenes, true);
    assert.equal(vol1.toggles.reverseBuildup, true);
    assert.equal(vol1.toggles.fractalSceneConflict, true);
    assert.equal(vol1.toggles.shortSentencePace, true);
    assert.equal(vol1.toggles.stretchRewardScene, true);
    assert.equal(vol1.toggles.revealBeforeCutEnding, true);
    assert.equal(vol1.toggles.revealCardsInEp1To5, true);
    assert.equal(vol1.toggles.boredomBuffer, false);
    assert.equal(vol1.toggles.secondChorusEscalation, false);

    const climax = createRuleProfileFromPreset('main_climax');
    assert.equal(climax.plotFramework, 'nine_step_loop');
    assert.equal(climax.toggles.reverseBuildup, true);
    assert.equal(climax.toggles.fractalSceneConflict, true);
    assert.equal(climax.toggles.secondChorusEscalation, true);
    assert.equal(climax.toggles.shortSentencePace, true);
    assert.equal(climax.toggles.stretchRewardScene, true);
    assert.equal(climax.toggles.revealBeforeCutEnding, true);
    assert.equal(climax.toggles.revealCardsInEp1To5, false);

    const breather = createRuleProfileFromPreset('breather_buildup');
    assert.equal(breather.plotFramework, 'slice_buildup');
    assert.equal(breather.toggles.fractalSceneConflict, true);
    assert.equal(breather.toggles.boredomBuffer, true);
    assert.equal(breather.toggles.shortSentencePace, true);
    assert.equal(breather.toggles.cutNoChangeScenes, false);
    assert.equal(breather.toggles.revealBeforeCutEnding, false);
    assert.equal(breather.toggles.revealCardsInEp1To5, false);

    // Modifying a toggle away from preset detects 'custom'
    assert.equal(
      detectMatchingPreset(breather.plotFramework, {
        ...breather.toggles,
        shortSentencePace: false,
      }),
      'custom'
    );
  });

  it('dynamically disables local arc and blueprint warnings when corresponding toggles are OFF', () => {
    const weakArc = structuredClone(SEED_MUNPIA_PROJECT.phase3!);
    weakArc.blocks[0].goal = '조용히 지냄';
    weakArc.blocks[0].keyBeat = '별채에서 휴식';
    weakArc.blocks[0].cliffhanger = '내일 아침이 밝는다';
    weakArc.kickEvents = weakArc.kickEvents.filter((k) => k.assignedBlockIndex !== 0);

    const vol1 = createRuleProfileFromPreset('vol1_survival');
    const breather = createRuleProfileFromPreset('breather_buildup');

    // revealCardsInEp1To5 ON -> warning triggered; OFF -> warning suppressed
    assert.equal(analyzeArcWarnings(weakArc, SEED_MUNPIA_PROJECT.phase2, vol1).length, 1);
    assert.equal(analyzeArcWarnings(weakArc, SEED_MUNPIA_PROJECT.phase2, breather).length, 0);

    // Blueprint with both clickbait ending and eventless solo scene
    const bp = structuredClone(SEED_MUNPIA_PROJECT.blueprints[1]);
    bp.ending.what = '흑막의 정체가 밝혀지려던 찰나 문이 닫힌다.';

    const vol1BpWarnings = analyzeBlueprintWarnings(bp, vol1);
    assert.ok(vol1BpWarnings.some((w) => w.category.includes('엔딩 낚시성')));
    assert.ok(vol1BpWarnings.some((w) => w.category.includes('단독 씬 스킵 권장')));

    // breather_buildup turns BOTH cutNoChangeScenes and revealBeforeCutEnding OFF
    const breatherBpWarnings = analyzeBlueprintWarnings(bp, breather);
    assert.equal(breatherBpWarnings.length, 0);
  });

  it('omits OFF rules from Novel Writer master prompt while keeping pure v2 blueprint JSON untouched', () => {
    const bp = SEED_MUNPIA_PROJECT.blueprints[1];
    const breather = createRuleProfileFromPreset('breather_buildup');
    const prompt = buildNovelWriterMasterPrompt(bp, SEED_MUNPIA_PROJECT.phase2, breather);

    assert.ok(prompt.includes('일상·관계·복선 빌드업'));
    assert.ok(prompt.includes('지루함 완충재'));
    assert.ok(prompt.includes('프랙탈 씬 갈등'));
    assert.ok(prompt.includes('단문 위주로 전개'));
    // Disabled rules MUST be completely excluded
    assert.equal(prompt.includes('win.stretch: true'), false);
    assert.equal(prompt.includes('절단신공'), false);
    assert.equal(prompt.includes('초반 5화 패 전면 공개'), false);

    // Pure blueprint JSON schema remains untouched (no ruleProfile leaked inside blueprint)
    const pure = toPureBlueprintJson(bp) as unknown as Record<string, unknown>;
    assert.equal('ruleProfile' in pure, false);
    assert.equal('episodeRuleOverrides' in pure, false);
  });

  it('generates framework-aware server AI instructions with flexible role substitution', () => {
    const climax = createRuleProfileFromPreset('main_climax');
    const climaxPrompt = buildDynamicRulesInstruction(climax, 'blueprint');
    assert.ok(climaxPrompt.includes('9단계 도파민 루프'));
    assert.ok(climaxPrompt.includes('적의 반동'));
    assert.ok(climaxPrompt.includes('환호·인정'));
    assert.ok(climaxPrompt.includes('2절 후렴구 증폭'));
    assert.ok(climaxPrompt.includes('역할(Function)'));
    assert.equal(climaxPrompt.includes('초반 5화 패 전면 공개'), false);

    const breather = createRuleProfileFromPreset('breather_buildup');
    const breatherPrompt = buildDynamicRulesInstruction(breather, 'assemble');
    assert.ok(breatherPrompt.includes('일상·관계·복선 빌드업'));
    assert.ok(breatherPrompt.includes('억지 전투'));
    assert.ok(breatherPrompt.includes('지루함 완충재'));
    assert.ok(breatherPrompt.includes('win.stretch는 억지로 true로 강제하지 말고'));
  });
});
