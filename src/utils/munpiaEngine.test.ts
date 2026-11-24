import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeArcWarnings,
  analyzeBlueprintWarnings,
  analyzeDraftWarnings,
  buildNovelWriterMasterPrompt,
  calculateTargetChars,
  evaluateThreeQDiagnostics,
  migrateProjectToV2,
  parseBlueprintJson,
  parseProjectBackupJson,
  syncBlueprintSceneNames,
  toPureBlueprintJson,
} from './munpiaEngine';
import { SEED_MUNPIA_PROJECT } from '../data/seedProject';

test('calculateTargetChars allocates proportionally and matches exact 5000 char total', () => {
  const scenes = SEED_MUNPIA_PROJECT.blueprints[1].scenes;
  const allocated = calculateTargetChars(scenes, 5000);
  const sum = allocated.reduce((acc, s) => acc + (s.target_chars ?? 0), 0);
  assert.equal(sum, 5000);
  assert.ok((allocated[2].target_chars ?? 0) > (allocated[0].target_chars ?? 0));
});

test('syncBlueprintSceneNames updates win, laugh, and threads when a scene is renamed', () => {
  const bp = structuredClone(SEED_MUNPIA_PROJECT.blueprints[1]);
  bp.scenes[2].name = '참숯 해독 대반전';
  bp.scenes[3].name = '독각 소환장';

  const synced = syncBlueprintSceneNames(bp, 5000);
  assert.equal(synced.win.scene, '참숯 해독 대반전');
  assert.equal(synced.laugh[1].scene, '참숯 해독 대반전');
  assert.equal(synced.threads.plant[0].scene, '독각 소환장');
});

test('parseBlueprintJson safely hydrates legacy v1 JSON missing v2 optional enrichment fields', () => {
  const legacyV1Json = JSON.stringify({
    episode: '1화',
    title: '레거시 테스트',
    cast_file: 'cast.md',
    pov: "1인칭 '나'",
    goal: '생존',
    must: ['독 해독'],
    inner: '30%',
    prev: null,
    stake: '즉사',
    win: { what: '해독 성공', scene: '숯과 물', reaction: '경악', stretch: true },
    laugh: [{ scene: '숯과 물', what: '노복 오해' }],
    relation: [{ who: '노복', from: '걱정', to: '경외' }],
    ending: { type: '정보', what: '명령서 도착' },
    threads: { plant: [{ what: '탄 감초', scene: '숯과 물', to: '3화' }], payoff: [] },
    scenes: [
      {
        name: '숯과 물',
        lines: 50,
        tension: 5,
        cast: ['당서진'],
        hostile: false,
        terms: ['참숯'],
        note: '호흡 늘리기',
        anchors: [['이김', '해독 성공']],
      },
    ],
  });

  const res = parseBlueprintJson(legacyV1Json);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.prose_tone, '');
    assert.equal(res.data.info_gap, '');
    assert.deepEqual(res.data.avoid, []);
    assert.equal(res.data.scenes[0].sensory, '');
    assert.equal(res.data.scenes[0].subtext, '');
    assert.deepEqual(res.data.scenes[0].key_lines, []);
  }
});

test('toPureBlueprintJson outputs clean v2 schema without internal UI helper keys', () => {
  const pure = toPureBlueprintJson(SEED_MUNPIA_PROJECT.blueprints[1]);
  assert.equal(pure.episode, '1화');
  assert.ok(pure.prose_tone && pure.prose_tone.length > 0);
  assert.ok(pure.info_gap && pure.info_gap.length > 0);
  assert.ok(Array.isArray(pure.avoid) && pure.avoid.length > 0);
  assert.equal('scene_id' in pure.win, false);
  assert.equal('id' in pure.scenes[0], false);
  assert.equal('target_chars' in pure.scenes[0], false);
  assert.ok(pure.scenes[0].sensory && pure.scenes[0].sensory.length > 0);
  assert.ok(pure.scenes[0].subtext && pure.scenes[0].subtext.length > 0);
  assert.ok(Array.isArray(pure.scenes[0].key_lines) && pure.scenes[0].key_lines.length > 0);
});

test('migrateProjectToV2 preserves existing project data and hydrates v2 slots', () => {
  const migrated = migrateProjectToV2(SEED_MUNPIA_PROJECT);
  assert.equal(migrated.id, SEED_MUNPIA_PROJECT.id);
  assert.equal(migrated.blueprints[1].scenes.length, 4);
  assert.ok(migrated.blueprints[1].prose_tone);
});

test('evaluateThreeQDiagnostics passes all 6 items for complete seed project and flags incomplete arc', () => {
  const seedResult = evaluateThreeQDiagnostics(SEED_MUNPIA_PROJECT.phase3, SEED_MUNPIA_PROJECT.phase2);
  assert.equal(seedResult.length, 6);
  assert.ok(seedResult.every((item) => item.status === '충족'));

  const emptyResult = evaluateThreeQDiagnostics(null, null);
  assert.equal(emptyResult.length, 6);
  assert.ok(emptyResult.every((item) => item.status === '위험'));
});

test('analyzeDraftWarnings flags light-novel genre, short N-mark text, and excessive ellipses', () => {
  const warnings = analyzeDraftWarnings(
    '그냥... 너무 무섭다...!! 이게 대체 뭐지?!... 말도 안 돼...!! 어떡해... ... ...',
    ['라이트노벨']
  );
  const categories = warnings.map((w) => w.category);
  assert.ok(categories.includes('비주류 장르 경고'));
  assert.ok(categories.includes('투베 N마크 분량 기준'));
  assert.ok(categories.includes('라노벨식 어투/감정 과잉 감지'));
});

test('parseProjectBackupJson validates project backups safely', () => {
  const validProject = parseProjectBackupJson(JSON.stringify(SEED_MUNPIA_PROJECT));
  assert.equal(validProject.ok, true);
});

test('buildNovelWriterMasterPrompt includes all 4 Munpia practical writing rules and pure v2 JSON', () => {
  const prompt = buildNovelWriterMasterPrompt(
    SEED_MUNPIA_PROJECT.blueprints[1],
    SEED_MUNPIA_PROJECT.phase2
  );
  assert.ok(prompt.includes('단문 위주로 전개'));
  assert.ok(prompt.includes('지문은 건조하고 담백하게'));
  assert.ok(prompt.includes('말하기식(Telling)'));
  assert.ok(prompt.includes('win.stretch: true'));
  assert.ok(prompt.includes('sensory'));
  assert.ok(prompt.includes('key_lines'));
  assert.ok(prompt.includes('avoid'));
  assert.ok(prompt.includes('절단신공'));
  assert.ok(prompt.includes('"prose_tone"'));
  assert.equal(prompt.includes('"scene_id"'), false);
});

test('analyzeArcWarnings passes complete seed intro and warns when 도입(1~5화) omits weapon, goal, or main sub1', () => {
  const seedWarnings = analyzeArcWarnings(SEED_MUNPIA_PROJECT.phase3, SEED_MUNPIA_PROJECT.phase2);
  assert.equal(seedWarnings.length, 0);

  const weakArc = structuredClone(SEED_MUNPIA_PROJECT.phase3!);
  weakArc.blocks[0].goal = '조용히 지냄';
  weakArc.blocks[0].keyBeat = '별채에서 휴식';
  weakArc.blocks[0].cliffhanger = '내일 아침이 밝는다';
  weakArc.kickEvents = weakArc.kickEvents.filter((k) => k.assignedBlockIndex !== 0);

  const warnings = analyzeArcWarnings(weakArc, SEED_MUNPIA_PROJECT.phase2);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].message.includes('초반 5화 내에 패를 전부 공개해야 투베 생존율이 올라갑니다'));
  assert.ok(warnings[0].message.includes('당연화'));
});

test('analyzeBlueprintWarnings flags clickbait ending expressions and allows post-reveal action cliffhangers', () => {
  const bpBait1 = structuredClone(SEED_MUNPIA_PROJECT.blueprints[1]);
  bpBait1.ending.what = '흑막의 정체가 밝혀지려던 찰나 문이 닫힌다.';
  const w1 = analyzeBlueprintWarnings(bpBait1);
  assert.ok(
    w1.some((w) => w.message.includes('보상을 먼저 공개하고 활용 직전에 끊는 것이 편당결제 이탈을 막습니다'))
  );

  const bpBait2 = structuredClone(SEED_MUNPIA_PROJECT.blueprints[1]);
  bpBait2.ending.what = '비밀 상자를 열기 ...직전 화면이 암전된다.';
  const w2 = analyzeBlueprintWarnings(bpBait2);
  assert.ok(
    w2.some((w) => w.message.includes('보상을 먼저 공개하고 활용 직전에 끊는 것이 편당결제 이탈을 막습니다'))
  );

  const bpClean = structuredClone(SEED_MUNPIA_PROJECT.blueprints[1]);
  bpClean.ending.what = '삼혼산 해독 비법을 완전히 입증한 뒤, 독각 시험장에 활용 직전에 발을 들인다.';
  const wClean = analyzeBlueprintWarnings(bpClean);
  assert.equal(
    wClean.some((w) => w.category.includes('엔딩 낚시성')),
    false
  );
});

test('analyzeBlueprintWarnings flags eventless solo scenes and clears when cast>=2, win.scene, or 판단/수쓰기 tag exists', () => {
  const bp = structuredClone(SEED_MUNPIA_PROJECT.blueprints[1]);
  // Seed S1 has 1 cast, is not win.scene, and has only 상황/문제 tags -> should trigger warning
  const wInitial = analyzeBlueprintWarnings(bp);
  assert.ok(
    wInitial.some((w) => w.message.includes('사건 없는 단독 씬은 요약 한 줄로 스킵하는 것을 권장합니다'))
  );

  // Adding '판단' anchor to S1 resolves the solo scene warning
  bp.scenes[0].anchors.push(['판단', '청산 계열 독가스임을 즉각 판별']);
  const wFixed = analyzeBlueprintWarnings(bp);
  assert.equal(
    wFixed.some((w) => w.message.includes('사건 없는 단독 씬은 요약 한 줄로 스킵하는 것을 권장합니다')),
    false
  );
});
