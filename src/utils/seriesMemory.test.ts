import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSeriesMemory,
  formatSeriesMemoryPrompt,
  parsePlannedPayoffEpisode,
} from './seriesMemory';
import {
  formatSaveTimeHHMMSS,
  parseMasterBackupJson,
  serializeMasterBackup,
} from './indexedDbStorage';
import { SEED_MUNPIA_PROJECT, createBlankProject } from '../data/seedProject';

describe('Series Memory Aggregation & Master Backup Engine', () => {
  it('parses planned payoff episode numbers from Korean freeform strings', () => {
    assert.equal(parsePlannedPayoffEpisode('3화 회수'), 3);
    assert.equal(parsePlannedPayoffEpisode('10~15화 전환점'), 15);
    assert.equal(parsePlannedPayoffEpisode('ep.25'), 25);
    assert.equal(parsePlannedPayoffEpisode('미정'), null);
  });

  it('tracks unresolved vs resolved threads and flags overdue planned payoffs', () => {
    const project = structuredClone(SEED_MUNPIA_PROJECT);
    // Ep 1 plants two threads: one resolved in Ep 2, one overdue (planned 2화, latest 5화)
    project.blueprints[1].threads = {
      plant: [
        { what: '탕약 그릇 바닥의 삼촌산 결정체', scene: '숯과 물', to: '2화 회수' },
        { what: '삼장로 약재고 비밀 장부 인장', scene: '숯과 물', to: '3화 회수' },
      ],
      payoff: [],
    };
    const ep2 = structuredClone(project.blueprints[1]);
    ep2.episode = '2화';
    ep2.threads = {
      plant: [{ what: '황실 밀서의 봉인 문양', scene: '숯과 물', to: '25화 회수' }],
      payoff: [{ what: '탕약 그릇 바닥의 삼촌산 결정체 진범 확인', scene: '숯과 물' }],
    };
    project.blueprints[2] = ep2;

    const ep5 = structuredClone(project.blueprints[1]);
    ep5.episode = '5화';
    ep5.threads = { plant: [], payoff: [] };
    project.blueprints[5] = ep5;

    const memory = buildSeriesMemory(project);
    assert.equal(memory.latestEpisodeNumber, 5);
    assert.equal(memory.resolvedThreads.length, 1);
    assert.equal(memory.resolvedThreads[0].payoffEp, 2);

    // Remaining unresolved: Ep1 삼장로 비밀 장부 (overdue: 3 < 5) + Ep2 황실 밀서 (not overdue: 25 > 5)
    assert.equal(memory.unresolvedThreads.length, 2);
    const overdue = memory.unresolvedThreads.find((t) => t.what.includes('비밀 장부'));
    const future = memory.unresolvedThreads.find((t) => t.what.includes('황실 밀서'));
    assert.equal(overdue?.isOverdue, true);
    assert.equal(future?.isOverdue, false);
    assert.equal(memory.overdueThreadCount, 1);
  });

  it('aggregates chronological character relation changes across episodes and deduplicates glossary terms', () => {
    const project = structuredClone(SEED_MUNPIA_PROJECT);
    project.blueprints[1].relation = [{ who: '당연화', from: '멸시', to: '의심' }];
    const ep3 = structuredClone(project.blueprints[1]);
    ep3.episode = '3화';
    ep3.relation = [{ who: '당연화', from: '의심', to: '은밀한 동맹' }];
    ep3.scenes[0].terms = ['백초독', '청산염결정'];
    project.blueprints[3] = ep3;

    const memory = buildSeriesMemory(project);
    const yeonhwa = memory.latestCharacterStates.find((c) => c.who === '당연화');
    assert.ok(yeonhwa);
    assert.equal(yeonhwa.initialStatus, '멸시');
    assert.equal(yeonhwa.currentStatus, '은밀한 동맹');
    assert.equal(yeonhwa.lastUpdatedEp, 3);
    assert.equal(yeonhwa.history.length, 2);

    // Glossary merges phase2 terminology + new scene term without duplicates
    const sceneOnlyTerm = memory.cumulativeTerms.find((t) => t.term === '청산염결정');
    assert.ok(sceneOnlyTerm);
    assert.equal(sceneOnlyTerm.source, '회차 씬');
    assert.deepEqual(sceneOnlyTerm.episodes, [3]);

    // Prompt formatter compresses all 3 sections cleanly
    const prompt = formatSeriesMemoryPrompt(memory);
    assert.ok(prompt.includes('[확정 세계관 규칙]'));
    assert.ok(prompt.includes('[인물 최신 관계 상태'));
    assert.ok(prompt.includes('당연화'));
    assert.ok(prompt.includes('은밀한 동맹'));
    assert.ok(prompt.includes('청산염결정'));
  });

  it('serializes and parses full workspace master backups as well as single-project backups', () => {
    const second = createBlankProject('두 번째 연재작');
    const json = serializeMasterBackup([SEED_MUNPIA_PROJECT, second]);
    const res = parseMasterBackupJson(json);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.isMasterBackup, true);
      assert.equal(res.projects.length, 2);
      assert.equal(res.projects[1].phase0.workingTitle, '두 번째 연재작');
    }

    const singleRes = parseMasterBackupJson(JSON.stringify(SEED_MUNPIA_PROJECT));
    assert.equal(singleRes.ok, true);
    if (singleRes.ok) {
      assert.equal(singleRes.isMasterBackup, false);
      assert.equal(singleRes.projects.length, 1);
    }

    assert.match(formatSaveTimeHHMMSS('2026-11-24T04:05:09.000Z'), /^\d{2}:\d{2}:\d{2}$/);
    assert.equal(formatSaveTimeHHMMSS(null), '--:--:--');
  });
});
