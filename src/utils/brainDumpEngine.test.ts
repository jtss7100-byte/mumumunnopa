import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendSupplementToMemo,
  BRAIN_DUMP_GUIDE_CHIPS,
  buildProjectFromBrainDump,
  buildSupplementMemoBlock,
  clearEstimatedField,
  extractQuotedLines,
  insertSnippetAtCursor,
  mergeBrainDumpIntoProject,
  normalizeBrainDumpAuditResult,
} from './brainDumpEngine';
import { SEED_MUNPIA_PROJECT } from '../data/seedProject';
import type { BrainDumpAuditResult, BrainDumpParseResult } from '../types/novelPlanner';

function makeSampleParseResult(): BrainDumpParseResult {
  return {
    workingTitle: '회귀한 감정사의 골동품 상점',
    genres: ['현대 판타지(현판)', '전문가물'],
    keywords: ['회귀', '감정안', '재벌'],
    targetVolumePlan: '500화 표준 3막 (20권)',
    proseTone: '단문 위주 건조 지문, 감정 순간에만 감각 확장',
    avoid: ['장황한 설명충 금지', '낚시성 엔딩 금지'],
    inferredFields: ['char.1.archetype', 'arc.block.4.cliffhanger', 'blueprint.1.ending'],
    phase1: {
      genreMix: [{ genre: '현대 판타지(현판)', ratio: 100 }],
      munpiaFitSummary: '전문가 감정물 + 회귀 조합으로 초반 몰입도가 높습니다.',
      munpiaFitLevel: '최적',
      targetReader: '문피아 3040 전문가·회귀물 코어 독자',
      protagonistProfile: {
        personality: '겉으론 무심하나 속으론 냉철한 실리주의자',
        coreConflict: '전생 배신자 강 팀장과의 위작·국보 주도권 싸움',
        desire: '국내 최고 감정사로 복권하고 배신자를 파멸시킨다',
      },
      worldCoreRule: '감정안은 물건의 제작 연대와 진위만 보여준다',
      narrativeEngineOneLine: '가짜로 버려진 국보급 유물의 진가를 홀로 알아보는 정보 낙차',
      toneRatio: { comedy: 25, serious: 75, note: '진지한 추리 + 조연 리액션 유머' },
      ep25HookCandidates: ['런던 소더비 VIP 초대장 수령'],
      tobeAppealPoints: ['1화 즉각 백억 감정 사이다'],
      warnings: ['중반 경매 패턴 반복 주의'],
      undecidedQuestions: [],
      confirmed: false,
    },
    phase2: {
      title: '회귀한 감정사의 골동품 상점',
      subtitleOrLogline: '남들 눈엔 고물, 내 눈엔 백억짜리 국보.',
      basicInfo: {
        genres: ['현대 판타지(현판)', '전문가물'],
        keywords: ['회귀', '감정안'],
        pov: "1인칭 '나'",
        serializationGoal: '500화 표준 3막 (20권)',
        targetCharsPerEp: 5000,
      },
      narrativeEngine: {
        coreIrony: '파산 직전 고물상 주인이 실은 국내 최고 감정안 보유자',
        infoGap: '주인공만 유물 속 숨겨진 낙관과 진품 가치를 안다',
        payPerEpDriver: '헐값 매입 후 초고가 감정 역전 카타르시스',
        oneLineAnswer: '고물상에서 100만 원에 산 도자기가 백억 국보로 밝혀진다.',
      },
      worldview: {
        eraAndSetting: '2016년 서울 인사동 및 글로벌 경매 시장',
        coreRules: ['감정안은 물건에 깃든 제작 연도와 진위만 정확히 보여준다'],
        terminology: [{ term: '진안', meaning: '유물의 미세한 균열과 연대를 읽는 감각' }],
      },
      characters: [
        {
          id: 'char-hero',
          name: '이도현',
          role: '주인공',
          archetypeNumber: 7,
          archetypeName: '지략가형',
          outerPersonality: '허름한 고물상 주인처럼 무심하다',
          innerPersonality: '전생의 배신을 갚기 위해 냉철하게 계산한다',
          ability: '진안(유물 진위·연대 감별)',
          relationshipFlow: '무명 고물상 → 인사동 신화',
          speechNote: '짧고 건조한 단문',
        },
        {
          id: 'char-sub1',
          name: '한서윤',
          role: '히로인/조연',
          archetypeNumber: 99, // intentionally out-of-range to test 18-archetype normalization
          archetypeName: '임의 이름',
          outerPersonality: '까칠한 신입 큐레이터',
          innerPersonality: '진짜 안목을 가진 스승을 갈망한다',
          ability: '미술관 인맥과 경매 실무',
          relationshipFlow: '의심 → 경악 → 전속 파트너',
          speechNote: '정중한 존댓말',
        },
      ],
      storyRoadmap: {
        ep1To25: '인사동 첫 백억 대박 및 배신자 팀장 응징',
        ep26To50: '국내 대형 경매장 진출',
        ep51Plus: '글로벌 소더비 경매 석권',
      },
      munpiaStrategyMemo: '초반 5화 내 진안 무기 + 한서윤 배치',
      pendingItems: ['해외 밀수 조직 정체'],
      confirmed: false,
    },
    phase3: {
      arcNumber: 1,
      title: '1권: 인사동의 백억 고물상',
      epRange: '1~25화',
      arcGoal: '전생 배신자 강 팀장의 위작 사기를 폭로하고 인사동 1인자로 등극',
      kickEvents: [
        {
          id: 'ke-1',
          type: '단발 킥이벤트',
          title: '50만 원 청자 진품 감정',
          summary: '무시당하던 도자기에서 진품 낙관 발견',
          assignedBlockIndex: 0,
          payoffValue: '1화 즉각 사이다',
        },
      ],
      blocks: [
        {
          blockIndex: 0,
          label: '도입',
          epRange: '1~5화',
          role: '진안과 한서윤 합류',
          goal: '이도현의 진안 공개 및 한서윤(메인 서브1) 신뢰 확보',
          keyBeat: '첫 백억 청자 감정 성공',
          cliffhanger: '강 팀장이 직접 고물상을 찾아온다',
        },
        {
          blockIndex: 1,
          label: '확장',
          epRange: '6~10화',
          role: '인사동 진출',
          goal: '소규모 경매장 장악',
          keyBeat: '위작 감별 대결 승리',
          cliffhanger: '재벌 회장 소장품 감정 의뢰',
        },
        {
          blockIndex: 2,
          label: '전환점',
          epRange: '11~15화',
          role: '투베 피크',
          goal: '회장 앞 공개 감정 역전',
          keyBeat: '강 팀장의 위작 폭로',
          cliffhanger: '배후 갤러리 대표 등장',
        },
        {
          blockIndex: 3,
          label: '클라이맥스',
          epRange: '16~20화',
          role: '정면 대결',
          goal: '국보급 병풍 진위 대결',
          keyBeat: '공개 경매장에서 역전 입찰',
          cliffhanger: '강 팀장 몰락 확정',
        },
        {
          blockIndex: 4,
          label: '정리+훅',
          epRange: '21~25화',
          role: '유료 전환',
          goal: '백억 정산 완료 및 글로벌 경매 초대장 수령',
          keyBeat: '보상 정산 후 런던 경매장 출국 직전',
          cliffhanger: '런던 경매 VIP 초대장을 쥐고 공항 게이트로 걸어 들어간다',
        },
      ],
      confirmed: false,
    },
    phase4Blocks: [],
    blueprints: [
      {
        episodeNumber: 1,
        blueprint: {
          episode: '1화',
          title: '고물상에서 건진 백억',
          prev: null,
          pov: "1인칭 '나'",
          cast_file: '캐릭터시트.md',
          goal: '헐값 청자를 사들여 진품임을 입증한다',
          stake: '놓치면 내일 가게 월세를 못 내고 쫓겨난다',
          inner: '속마음 25%',
          must: ['진안 발동', '한서윤 첫 만남'],
          prose_tone: '',
          info_gap: '',
          avoid: [],
          win: {
            scene_id: 'S3',
            scene: '진품 감정',
            what: '청자 바닥 이중 유약 낙관 공개',
            reaction: '한서윤이 숨을 들이켠다',
            stretch: true,
          },
          laugh: [],
          relation: [{ who: '한서윤', from: '무시', to: '경악' }],
          ending: {
            type: '정보',
            what: '100억 감정서를 받아 들고 배신자 강 팀장에게 전화를 건다',
          },
          threads: { plant: [], payoff: [] },
          scenes: [
            {
              id: 'S1',
              name: '회귀 직후',
              lines: 35,
              tension: 2,
              cast: ['이도현'],
              hostile: false,
              terms: ['진안'],
              note: '',
              anchors: [['상황', '2016년 인사동 고물상에서 눈을 뜬다']],
            },
            {
              id: 'S2',
              name: '한서윤 방문',
              lines: 40,
              tension: 3,
              cast: ['이도현', '한서윤'],
              hostile: false,
              terms: [],
              note: '',
              anchors: [['주고받기', '한서윤이 청자를 싸구려라고 평가한다']],
            },
            {
              id: 'S3',
              name: '진품 감정',
              lines: 60,
              tension: 5,
              cast: ['이도현', '한서윤'],
              hostile: false,
              terms: ['진안'],
              note: '',
              sensory: '차갑게 매끄러운 청자 유약 밑으로 은은한 비취빛 균열이 비친다',
              subtext: '겉으론 무심하지만 속으론 전생의 원한이 타오른다',
              key_lines: [],
              anchors: [
                ['이김', '이중 유약 아래 진짜 낙관을 드러낸다'],
                ['갈고리', '강 팀장에게 선전포고 전화를 건다'],
              ],
            },
          ],
        },
      },
    ],
  };
}

describe('Brain Dump Auto-Parsing Engine', () => {
  it('inserts guide chip snippets cleanly at cursor position', () => {
    const chip = BRAIN_DUMP_GUIDE_CHIPS[0];
    const emptyRes = insertSnippetAtCursor('', 0, 0, chip.snippet);
    assert.ok(emptyRes.nextText.startsWith('--- [주인공'));
    assert.equal(emptyRes.nextCursorPos, emptyRes.nextText.length);

    const midRes = insertSnippetAtCursor('앞문장뒷문장', 3, 3, '\n[삽입]\n');
    assert.equal(midRes.nextText, '앞문장\n[삽입]\n뒷문장');
    assert.equal(midRes.nextCursorPos, 3 + '\n[삽입]\n'.length);
  });

  it('extracts verbatim writer quotes in straight and curly double quotes while ignoring template placeholder', () => {
    const memo = `주인공이 말한다 "이 도자기는 50만 원이 아니라 백억짜리요." 그리고 조연이 “말도 안 됩니다!” 라고 외친다. "여기에 꼭 쓰고 싶은 원문 대사를 큰따옴표로 적어두세요."`;
    const quotes = extractQuotedLines(memo);
    assert.deepEqual(quotes, [
      '"이 도자기는 50만 원이 아니라 백억짜리요."',
      '"말도 안 됩니다!"',
    ]);
  });

  it('builds a full project with normalized 18 archetypes, preserved verbatim key_lines, mapped AI estimated fields, and report', () => {
    const memo = `고물상 회귀물. "이 도자기는 50만 원이 아니라 백억짜리요." 꼭 그대로 써줘.`;
    const project = buildProjectFromBrainDump(memo, makeSampleParseResult());

    assert.equal(project.currentPhase, 'dump');
    assert.equal(project.phase2?.characters.length, 2);
    // Out-of-range archetype 99 normalized to valid Munpia archetype #9 (조력자 default)
    assert.equal(project.phase2?.characters[1].archetypeNumber, 9);
    assert.equal(project.phase2?.characters[1].archetypeName, '밝은 조력자형');

    // Verbatim quote from memo preserved in blueprint key_lines
    const allKeyLines = project.blueprints[1].scenes.flatMap((s) => s.key_lines ?? []);
    assert.ok(allKeyLines.includes('"이 도자기는 50만 원이 아니라 백억짜리요."'));

    // Symbolic char.1.archetype resolved to concrete char.char-sub1.archetype
    assert.ok(project.aiEstimatedFields?.includes('char.char-sub1.archetype'));
    assert.ok(project.aiEstimatedFields?.includes('arc.block.4.cliffhanger'));
    assert.ok(project.aiEstimatedFields?.includes('blueprint.1.ending'));

    // Report populated accurately
    assert.equal(project.lastBrainDumpReport?.mode, 'new');
    assert.equal(project.lastBrainDumpReport?.characterCount, 2);
    assert.deepEqual(project.lastBrainDumpReport?.blueprintEpisodes, [1]);
    assert.equal(project.lastBrainDumpReport?.quotedKeyLinesCount, 1);
  });

  it('merges Brain Dump output non-destructively while preserving existing writer edits', () => {
    const existing = structuredClone(SEED_MUNPIA_PROJECT);
    const originalTitle = existing.phase2!.title;
    const originalCharCount = existing.phase2!.characters.length;
    const originalKickCount = existing.phase3!.kickEvents.length;

    const memo = `추가 조연 한서윤과 새 에피소드 추가. "독은 거짓말을 하지 않는다."`;
    const merged = mergeBrainDumpIntoProject(existing, memo, makeSampleParseResult());

    // Existing title preserved
    assert.equal(merged.phase2?.title, originalTitle);
    // New characters appended without deleting existing characters
    assert.equal(merged.phase2?.characters.length, originalCharCount + 2);
    // New kick event appended
    assert.equal(merged.phase3?.kickEvents.length, originalKickCount + 1);
    // Verbatim quote preserved
    const allKeyLines = merged.blueprints[1].scenes.flatMap((s) => s.key_lines ?? []);
    assert.ok(allKeyLines.includes('"독은 거짓말을 하지 않는다."'));
    assert.equal(merged.lastBrainDumpReport?.mode, 'merge');
  });

  it('clears an AI estimated field key cleanly when the writer edits that field', () => {
    const before = ['char.char-1.archetype', 'arc.block.4.cliffhanger', 'blueprint.1.ending'];
    const after = clearEstimatedField(before, 'arc.block.4.cliffhanger');
    assert.deepEqual(after, ['char.char-1.archetype', 'blueprint.1.ending']);
  });

  it('normalizes Brain Dump Audit results and forces warning status when any high-severity flag exists', () => {
    const normalized = normalizeBrainDumpAuditResult({
      status: 'ready', // AI mistakenly said ready despite high flag
      sufficiencyScore: 142,
      verdictSummary: '테스트 총평',
      missingItems: [
        {
          id: '',
          category: '갈등/빌런',
          reason: '적대 세력이 비어 있습니다.',
          question: '1권 핵심 빌런은 누구인가요?',
          quickOptions: ['배신한 장로', '부패한 길드장'],
        },
      ],
      inappropriateFlags: [
        {
          id: '',
          severity: 'high',
          issueType: '설정 모순',
          quotedPart: '내공이 전혀 없는데 천마신공 9성을 펼쳤다',
          reason: '폐맥 설정과 정면 충돌합니다.',
          fixSuggestions: ['내공 대신 화학 촉매로 구현한다', '초반엔 1성 흔적만 남긴다'],
        },
      ],
    });

    assert.equal(normalized.status, 'warning');
    assert.equal(normalized.sufficiencyScore, 100);
    assert.equal(normalized.missingItems[0].id, 'missing-1');
    assert.equal(normalized.inappropriateFlags[0].id, 'flag-1');
  });

  it('builds a clean [보충·수정 메모] block from selected options and custom answers and appends it cleanly', () => {
    const audit: BrainDumpAuditResult = {
      status: 'warning',
      sufficiencyScore: 48,
      verdictSummary: '갈등 축 보충 및 모순 수정이 필요합니다.',
      missingItems: [
        {
          id: 'm1',
          category: '갈등/빌런',
          reason: '적대 세력 부재',
          question: '1권에서 주인공을 압박하는 핵심 적은 누구인가요?',
          quickOptions: ['가문 내 삼장로 파벌', '경쟁 상단'],
        },
        {
          id: 'm2',
          category: '1화 사건',
          reason: '1화 위기 불명확',
          question: '1화 첫 사이다 장면은 무엇인가요?',
          quickOptions: ['독탕 현장 해독'],
        },
      ],
      inappropriateFlags: [
        {
          id: 'f1',
          severity: 'high',
          issueType: '설정 모순',
          quotedPart: '약골인데 맨손으로 성벽을 부쉈다',
          reason: '약골 컨셉과 충돌',
          fixSuggestions: ['폭약 화학 반응으로 성벽을 붕괴시킨다'],
        },
      ],
    };

    const block = buildSupplementMemoBlock(
      audit,
      {
        m1: { selectedOption: '가문 내 삼장로 파벌', customText: '특히 약재고를 독점함' },
        m2: {}, // unanswered should be omitted
      },
      {
        f1: { selectedOption: '폭약 화학 반응으로 성벽을 붕괴시킨다' },
      }
    );

    assert.ok(block.startsWith('[보충·수정 메모]\n'));
    assert.ok(block.includes('[보충 · 갈등/빌런]'));
    assert.ok(block.includes('가문 내 삼장로 파벌 / 특히 약재고를 독점함'));
    assert.ok(!block.includes('1화 첫 사이다'));
    assert.ok(block.includes('[수정 반영 · 설정 모순]'));
    assert.ok(block.includes('폭약 화학 반응으로 성벽을 붕괴시킨다'));

    const appended = appendSupplementToMemo('원본 메모입니다.   \n', block);
    assert.ok(appended.startsWith('원본 메모입니다.\n\n[보충·수정 메모]\n'));
  });
});
