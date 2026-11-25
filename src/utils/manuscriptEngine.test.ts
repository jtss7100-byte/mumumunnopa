import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleFullManuscriptText,
  buildNextEpisodePrevSummary,
  checkAvoidViolationsInManuscript,
  checkKeyLinesInManuscript,
  computeSceneTargetChars,
  countManuscriptChars,
  createEmptyManuscript,
  formatMunpiaExportText,
  getPreviousScenesContext,
  upsertSceneDraft,
} from './manuscriptEngine';
import { SEED_MUNPIA_PROJECT } from '../data/seedProject';

const ep1Blueprint = SEED_MUNPIA_PROJECT.blueprints[1];

test('countManuscriptChars counts spaces and non-spaces accurately with CRLF normalization', () => {
  const res = countManuscriptChars('안녕 하세요.\r\n반갑습니다!');
  assert.equal(res.withSpaces, '안녕 하세요.\n반갑습니다!'.length);
  assert.equal(res.noSpaces, '안녕하세요.반갑습니다!'.length);
});

test('computeSceneTargetChars calculates proportional target chars from scene.lines', () => {
  const totalLines = ep1Blueprint.scenes.reduce((s, sc) => s + sc.lines, 0);
  const expectedS1 = Math.round(5000 * (ep1Blueprint.scenes[0].lines / totalLines));
  assert.equal(computeSceneTargetChars(ep1Blueprint, 0, 5000), expectedS1);

  const expectedS3 = Math.round(5000 * (ep1Blueprint.scenes[2].lines / totalLines));
  assert.equal(computeSceneTargetChars(ep1Blueprint, 2, 5000), expectedS3);
});

test('upsertSceneDraft and assembleFullManuscriptText join scenes cleanly and respect customFullText', () => {
  let ms = createEmptyManuscript(1, ep1Blueprint);
  ms = upsertSceneDraft(ms, 'S1', '연구실의 최후와 빙의', '첫 번째 씬 본문입니다.', '연구실에서 빙의함.');
  ms = upsertSceneDraft(ms, 'S2', '검은 탕약과 폐맥', '두 번째 씬 본문입니다.', '독살 위기 파악.');

  assert.equal(assembleFullManuscriptText(ep1Blueprint, ms), '첫 번째 씬 본문입니다.\n\n두 번째 씬 본문입니다.');
  assert.equal(ms.sceneDrafts.S1.charCountWithSpaces, '첫 번째 씬 본문입니다.'.length);

  const customEdited = { ...ms, customFullText: '작가가 직접 다듬은 통합 원고입니다.' };
  assert.equal(assembleFullManuscriptText(ep1Blueprint, customEdited), '작가가 직접 다듬은 통합 원고입니다.');
});

test('getPreviousScenesContext returns trailing up to 1500 chars from preceding scenes only', () => {
  let ms = createEmptyManuscript(1, ep1Blueprint);
  ms = upsertSceneDraft(ms, 'S1', 'S1', '가'.repeat(1000));
  ms = upsertSceneDraft(ms, 'S2', 'S2', '나'.repeat(1000));
  ms = upsertSceneDraft(ms, 'S3', 'S3', '다'.repeat(500));

  assert.equal(getPreviousScenesContext(ep1Blueprint, ms, 0, 1500), '');
  const ctxForS3 = getPreviousScenesContext(ep1Blueprint, ms, 2, 1500);
  assert.equal(ctxForS3.length <= 1500, true);
  assert.equal(ctxForS3.endsWith('나'.repeat(1000)), true);
  assert.equal(ctxForS3.includes('다'), false);
});

test('checkKeyLinesInManuscript normalizes curly quotes and detects inserted vs missing lines', () => {
  const body = `
“사공자, 숨이 붙어 계십니까? 장로원에서는 오늘 밤을 못 넘길 거라 하셨는데.”

노복이 떨리는 목소리로 물었다.

“노복. 아궁이에 남은 참숯을 곱게 빻아 오너라. 그리고 미지근한 물 한 동이.”
`;
  const results = checkKeyLinesInManuscript(ep1Blueprint, body);
  assert.ok(results.length >= 4);

  const foundLines = results.filter((r) => r.found);
  const missingLines = results.filter((r) => !r.found);
  assert.equal(foundLines.length, 2);
  assert.ok(missingLines.length >= 2);
});

test('checkAvoidViolationsInManuscript flags ellipsis overuse and explicit forbidden keywords', () => {
  const customBp = {
    ...ep1Blueprint,
    avoid: [
      '과도한 말줄임표(...) 남발 금지',
      "'화학식' 용어 직접 나열 금지",
    ],
  };

  const cleanText = '서진은 숯가루를 물에 탔다. 숨이 천천히 트였다.';
  const cleanResults = checkAvoidViolationsInManuscript(customBp, cleanText);
  assert.equal(cleanResults.every((r) => !r.triggered), true);

  const dirtyText = '이게... 정말... 가능한가... 믿을 수 없다... 화학식을 읊었다.';
  const dirtyResults = checkAvoidViolationsInManuscript(customBp, dirtyText);
  assert.equal(dirtyResults[0].triggered, true);
  assert.equal(dirtyResults[1].triggered, true);
});

test('formatMunpiaExportText strips markdown headers/bold and normalizes mobile blank lines', () => {
  let ms = createEmptyManuscript(1, ep1Blueprint);
  ms = upsertSceneDraft(
    ms,
    'S1',
    'S1',
    '## 씬 제목\n**서진**은 눈을 떴다.\n\n\n"어디지?"\n- 메모 항목'
  );
  const exported = formatMunpiaExportText(ep1Blueprint, ms);
  assert.equal(exported.includes('##'), false);
  assert.equal(exported.includes('**'), false);
  assert.equal(exported, '서진은 눈을 떴다.\n\n"어디지?"\n\n메모 항목');
});

test('buildNextEpisodePrevSummary prefers AI scene summaries and falls back cleanly', () => {
  let ms = createEmptyManuscript(1, ep1Blueprint);
  ms = upsertSceneDraft(ms, 'S1', 'S1', '본문1', '연구실 사고 후 당서진의 몸에 빙의했다.');
  ms = upsertSceneDraft(ms, 'S3', 'S3', '본문3', '참숯 활성탄 흡착으로 삼혼산을 해독했다.');

  const summary = buildNextEpisodePrevSummary(ep1Blueprint, ms);
  assert.ok(summary.includes('당서진의 몸에 빙의했다.'));
  assert.ok(summary.includes('삼혼산을 해독했다.'));

  const fallbackSummary = buildNextEpisodePrevSummary(ep1Blueprint, createEmptyManuscript(1, ep1Blueprint));
  assert.ok(fallbackSummary.length > 10);
});
