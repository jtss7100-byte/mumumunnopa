import type { AnchorTag } from '../types/novelPlanner';

export const MUNPIA_SURVIVAL_CONTEXT = {
  billingModel: {
    pricePerEpisode: '1화 = 100원 (100골드)',
    coreRule: '매화 독자가 100원을 결제할 이유(100원 가치: 사이다·정보 해금·위기 돌파·갈고리)가 연독률을 결정합니다.',
  },
  serializationTiers: [
    { tier: '자유연재', condition: '신규 작품 진입 구간', goal: '1~15화 투베 진입 및 선호작(선작) 확보' },
    { tier: '일반연재', condition: '누적 75,000자 이상 승급', goal: '연독률 안정화 및 25화 유료화 전환' },
    { tier: '작가연재', condition: '2질 이상 완결 작가', goal: '100화 선독점 후 시리즈·카카오페이지 유통 확장' },
  ],
  todayBestRules: {
    minCharsForNMark: 3000,
    standardCharsPerEpisode: 5000,
    metric: '단일 편 최고 조회수 기준 (3,000자 미만 시 N 마크 미부여)',
    paywallStandard: '25화 (단행본 1권 분량, 약 125,000자 기준)',
    freeZoneGoal: '1~15화 투베 진입 + 선호작 확보 / 20~25화 강력한 유료 전환 훅 배치',
  },
  longFormDistribution: {
    shortForm: '200화 (8권) 단축형 3막',
    standardForm: '500화 (20권) 표준 3막',
    exclusiveMilestone: '100화 (125,000자 × 4권) 선독점 이후 네이버 시리즈 · 카카오페이지 유통 연계',
  },
  targetAudienceAndWarnings: {
    coreAudience: '20~40대 남성 판타지 · 무협 · 현판 · 헌터 · 경영 · 스포츠 코어 독자',
    preferredStyle: '사건 위주 빠른 전개, 명확한 목표와 보상, 합리적 문제 해결, 뚜렷한 정보 낙차',
    warnings: [
      '3,000자 미만 분량(N 마크 누락으로 투베 노출 불가)',
      '과도한 내면 독백 및 감정 늘여쓰기(템포 저하)',
      '초반 세계관 설명충(Infodump) 장문 서술',
      '문피아 코어 독자와 괴리된 과도한 일본 라노벨식 오타쿠 어투/연출',
    ],
  },
} as const;

export interface GenreTagInfo {
  id: string;
  name: string;
  category: '주력 장르' | '인기 키워드';
  munpiaAffinity: '최상' | '높음' | '보통' | '비주류 주의';
  note: string;
}

export const GENRE_TAGS: GenreTagInfo[] = [
  { id: 'fantasy', name: '판타지', category: '주력 장르', munpiaAffinity: '최상', note: '정통·이세계·영지·아카데미 등 문피아 핵심 축' },
  { id: 'modern-fantasy', name: '현대 판타지(현판)', category: '주력 장르', munpiaAffinity: '최상', note: '헌터·각성·경영·전문가 결합 최강 수요' },
  { id: 'game-fantasy', name: '게임 판타지', category: '주력 장르', munpiaAffinity: '높음', note: '빙의·랭커·시스템 성장과 높은 시너지' },
  { id: 'alt-history', name: '대체역사', category: '주력 장르', munpiaAffinity: '최상', note: '문피아 최상위 충성 독자층 보유, 고증과 쾌감의 균형 중요' },
  { id: 'fusion', name: '퓨전', category: '주력 장르', munpiaAffinity: '최상', note: '무협+현판, 판타지+전문가 등 복합 수요' },
  { id: 'wuxia', name: '무협', category: '주력 장르', munpiaAffinity: '최상', note: '문피아 전통 코어 장르, 회귀·환생·세가물 강세' },
  { id: 'fusion-wuxia', name: '퓨전 무협', category: '주력 장르', munpiaAffinity: '최상', note: '현대 전문지식·시스템·착각 요소 결합으로 진입장벽 완화' },
  { id: 'modern', name: '현대물', category: '주력 장르', munpiaAffinity: '높음', note: '회귀 기반 성공 신화·전문직 서사 중심' },
  { id: 'showbiz', name: '연예계물', category: '주력 장르', munpiaAffinity: '높음', note: '배우·아이돌·PD/매니저, 빠른 작품 에피소드 교체 필수' },
  { id: 'business', name: '경영/기업물', category: '주력 장르', munpiaAffinity: '최상', note: '재벌·투자·산업 패권, 숫자 기반 사이다 강점' },
  { id: 'sports', name: '스포츠물', category: '주력 장르', munpiaAffinity: '높음', note: '야구·축구·농구·e스포츠, 경기 텐션과 기록 갱신 쾌감' },
  { id: 'specialist', name: '전문가물', category: '주력 장르', munpiaAffinity: '최상', note: '의사·검사·셰프·화학자 등 전문성으로 문제를 절단하는 쾌감' },
  { id: 'sf', name: 'SF', category: '주력 장르', munpiaAffinity: '보통', note: '아포칼립스·스페이스 오페라, 초반 진입장벽 최소화 필요' },
  { id: 'light-novel', name: '라이트노벨', category: '주력 장르', munpiaAffinity: '비주류 주의', note: '문피아 비주류 경고: 과한 오타쿠 감성·말줄임 남발 시 초반 이탈 급증' },
];

export const POPULAR_KEYWORDS: string[] = [
  '회귀',
  '성좌물',
  '아카데미물',
  '인방물',
  '헌터물',
  '먼치킨',
  '빙의',
  '환생',
  '상태창',
  '착각물',
  '영지물',
  '전문직',
  '재벌',
  '세가/명문',
  '숨겨진 능력',
];

export interface HookVariant {
  code: string;
  label: string;
  structure: string;
  readerQuestion: string;
}

export interface HookPatternGroup {
  id: string;
  genre: string;
  variants: HookVariant[];
}

export const HOOK_PATTERNS: HookPatternGroup[] = [
  {
    id: 'regression',
    genre: '회귀물',
    variants: [
      { code: 'A', label: '죽음 직후 회귀', structure: '배신·멸망 직전의 비참한 최후 → 10년 전 결정적 기점으로 눈뜸', readerQuestion: '이번 생에는 누구부터 어떻게 갚아줄 것인가?' },
      { code: 'B', label: '아무도 안 믿어줌', structure: '다가올 파국을 경고하지만 무시당함 → 첫 소규모 예언 적중으로 반전 시작', readerQuestion: '무시하던 자들이 언제 무릎 꿇고 매달릴까?' },
      { code: 'C', label: '불완전 기억', structure: '핵심 미래 정보만 조각으로 보유 → 변수가 생길 때마다 지략으로 돌파', readerQuestion: '바뀐 미래 속에서 주인공이 어떤 수를 둘까?' },
    ],
  },
  {
    id: 'hunter',
    genre: '헌터물',
    variants: [
      { code: 'A', label: '측정 실패 숨겨진 능력', structure: '각성 측정기 오류로 F급 판정 → 실제론 등급 외 고유 특성 보유', readerQuestion: '저 저평가된 능력이 실전에서 어떻게 폭주할까?' },
      { code: 'B', label: '최강자 약자 행세', structure: '은퇴·은둔한 최상위 헌터가 말단 길드/신입으로 위장 취업', readerQuestion: '정체가 들통나는 순간 주변 반응은 어떨까?' },
      { code: 'C', label: '이상한 스킬 활용', structure: '쓰레기 취급받는 생활/보조 스킬을 창의적 해석으로 최강 무기로 전환', readerQuestion: '이 기이한 스킬을 다음 보스에겐 어떻게 응용할까?' },
    ],
  },
  {
    id: 'wuxia',
    genre: '무협물',
    variants: [
      { code: 'A', label: '환생+기연', structure: '비명횡사 또는 타계 후 명문가 약골·서자로 환생 + 치명적 위기에서 기연 각성', readerQuestion: '버려진 약골이 가문과 강호를 어떻게 뒤집을까?' },
      { code: 'B', label: '밑바닥 시작', structure: '점소이·노비·약방 심부름꾼이 남들 눈을 피해 무공의 원리를 깨우침', readerQuestion: '천민 출신이 정파 고수들을 어떻게 압도할까?' },
      { code: 'C', label: '전대 고수 귀환', structure: '천하제일인 또는 마교 교주가 수십 년 뒤 쇠락한 문파의 제자 몸으로 깨어남', readerQuestion: '옛 원수들과 몰락한 문파를 어떻게 정리할까?' },
      { code: 'D', label: '사파 출신', structure: '잔혹한 사파·혈교 출신이 생존 논리로 정파의 위선을 깨부수며 전진', readerQuestion: '정파식 규칙을 무시한 사파식 해법이 어디까지 통할까?' },
    ],
  },
  {
    id: 'chaebol',
    genre: '재벌/기업물',
    variants: [
      { code: 'A', label: '팽당한 말단/서자 반격', structure: '승계 구도에서 밀려난 서자·해고 임원이 미래 산업 정보로 첫 빅딜 성사', readerQuestion: '본가와 라이벌을 자본으로 어떻게 역전할까?' },
      { code: 'B', label: '망해가는 계열사 기적', structure: '좌천된 적자 부서를 3화 안에 반전 실적으로 뒤집어 회장 시선 강탈', readerQuestion: '다음엔 어떤 산업과 기업을 집어삼킬까?' },
    ],
  },
  {
    id: 'sports',
    genre: '스포츠물',
    variants: [
      { code: 'A', label: '방출 직전 각성', structure: '부상·노쇠·2군 방출 위기에서 특수 감각/스탯 시야 개안', readerQuestion: '1군 데뷔전에서 어떤 충격적 기록을 세울까?' },
      { code: 'B', label: '천재 감독/에이전트', structure: '선수 생명이 끝난 주인공이 선수 잠재력을 꿰뚫는 안목으로 약팀 개조', readerQuestion: '이 망가진 팀을 우승까지 어떻게 끌어올릴까?' },
    ],
  },
  {
    id: 'possession',
    genre: '빙의물',
    variants: [
      { code: 'A', label: '초반 사망 엑스트라 빙의', structure: '1권에서 죽기로 예정된 악역·허약 엑스트라에 빙의해 원작 지식로 생존 설계', readerQuestion: '원작의 사망 플래그를 어떻게 비틀어 이득을 챙길까?' },
    ],
  },
  {
    id: 'academy',
    genre: '아카데미물',
    variants: [
      { code: 'A', label: '낙제생/교관 잠입', structure: '최하위 반 배정 또는 임시 교관 부임 → 압도적 실전 지식으로 천재들 교정', readerQuestion: '엘리트 학우·교수진의 평가가 언제 뒤집힐까?' },
    ],
  },
  {
    id: 'misunderstanding',
    genre: '착각물',
    variants: [
      { code: 'A', label: '생존 행동이 신화로 오해', structure: '살려고 한 평범한 행동이 주변 강자들에겐 심오한 안배로 해석됨', readerQuestion: '오해가 눈덩이처럼 커질 때 주인공이 어떻게 수습할까?' },
    ],
  },
  {
    id: 'territory',
    genre: '영지물',
    variants: [
      { code: 'A', label: '척박한 변방 영지 수령', structure: '버려진 빚더미 영지를 현대 기술·행정 지식으로 1화부터 개혁 착수', readerQuestion: '이 버려진 땅이 왕국 최강 요새로 어떻게 변할까?' },
    ],
  },
  {
    id: 'specialist',
    genre: '전문가물',
    variants: [
      { code: 'A', label: '불가능한 현장 즉시 해결', structure: '베테랑들도 손 놓은 긴급 사태를 압도적 전문지식으로 1화 만에 진단·처치', readerQuestion: '다음 난제는 어떤 전문 기술로 통쾌하게 뚫어낼까?' },
    ],
  },
  {
    id: 'alt-history',
    genre: '대체역사물',
    variants: [
      { code: 'A', label: '비극적 역사 직전 개입', structure: '임진왜란·병자호란·열강 침탈 직전에 빙의해 기술·외교·군제 개혁 착수', readerQuestion: '역사의 패배를 어떻게 승리로 뒤집고 판도를 바꿀까?' },
    ],
  },
];

export interface CharacterArchetype {
  number: number;
  symbol: string;
  category: '주인공' | '히로인/조연' | '빌런';
  name: string;
  outerDefault: string;
  innerDefault: string;
  contrastTip: string;
  relationFlowDefault: string;
}

export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  { number: 1, symbol: '①', category: '주인공', name: '조용한 무쌍형', outerDefault: '과묵하고 무심하며 티를 내지 않음', innerDefault: '냉철한 계산과 선을 넘은 자에 대한 무자비함', contrastTip: '말은 짧게, 행동의 결과는 압도적으로', relationFlowDefault: '무관심 → 실력 입증 → 절대 신뢰' },
  { number: 2, symbol: '②', category: '주인공', name: '착각물 주인공형', outerDefault: '위엄 있고 속을 알 수 없는 현자/고수 태도', innerDefault: '제발 조용히 살고 싶은 현실적 소시민', contrastTip: '속마음의 절박함과 겉모습의 여유 간 낙차 극대화', relationFlowDefault: '두려움 → 과잉 충성 → 신격화' },
  { number: 3, symbol: '③', category: '주인공', name: '회귀자형', outerDefault: '나이에 맞지 않는 노련함과 여유', innerDefault: '과거의 후회·분노를 지우기 위한 집요한 집착', contrastTip: '정보 우위를 바탕으로 타인의 위선을 선제 타격', relationFlowDefault: '이용 대상 → 검증된 아군 → 생사 동반자' },
  { number: 4, symbol: '④', category: '주인공', name: '빙의자형', outerDefault: '원래 몸 주인과 완전히 달라진 기이한 침착함', innerDefault: '원작 전개 이탈에 대한 경계와 생존 본능', contrastTip: '주변인이 체감하는 전후 태도 변화가 초반 훅', relationFlowDefault: '의심 → 기이한 호감 → 핵심 조력' },
  { number: 5, symbol: '⑤', category: '주인공', name: '먼치킨형', outerDefault: '귀찮아하며 대충 넘기려는 태평함', innerDefault: '압도적 무력 아래 감춘 확고한 원칙과 보호 본능', contrastTip: '힘을 숨기는 제약 조건이나 귀찮음이 코미디 엔진', relationFlowDefault: '경시 → 경악 → 절대 추종' },
  { number: 6, symbol: '⑥', category: '주인공', name: '밑바닥 성장형', outerDefault: '고개 숙이고 버티는 인내심', innerDefault: '기회를 포착하면 물어뜯는 독기와 학습욕', contrastTip: '고구마가 2화를 넘지 않게 작은 승리 연쇄 배치', relationFlowDefault: '멸시 → 경계 → 대등한 인정' },
  { number: 7, symbol: '⑦', category: '주인공', name: '전문가/직업인형', outerDefault: '직업적 냉정함과 데이터 중심 태도', innerDefault: '자기 분야를 모욕하는 불합리에 대한 직업적 분노', contrastTip: '전문 용어를 생활 비유로 풀어내는 순간의 카타르시스', relationFlowDefault: '불신 → 감탄 → 전권 위임' },

  { number: 8, symbol: '⑧', category: '히로인/조연', name: '차가운 미녀형', outerDefault: '도도하고 감정을 드러내지 않는 얼음장 태도', innerDefault: '가문/조직의 중압감과 자신을 이해해 주는 이에 대한 갈망', contrastTip: '주인공에게만 무너지는 한 줄의 표정 변화', relationFlowDefault: '경계 → 호기심 → 신뢰 → 동료' },
  { number: 9, symbol: '⑨', category: '히로인/조연', name: '밝은 조력자형', outerDefault: '쾌활하고 분위기 메이커, 말이 많음', innerDefault: '주인공의 그림자를 가장 먼저 눈치채는 섬세함', contrastTip: '긴장 직후 호흡을 풀어주는 유머 장치로 활용', relationFlowDefault: '친근함 → 의지 → 핵심 파트너' },
  { number: 10, symbol: '⑩', category: '히로인/조연', name: '라이벌형', outerDefault: '오만하고 승부욕 강한 천재', innerDefault: '실력에 대한 순수한 존중과 자기 한계에 대한 초조함', contrastTip: '패배 이후 열등감이 아닌 존경·협력으로 전환될 때 매력 폭발', relationFlowDefault: '적대 → 충격 → 인정 → 경쟁적 동료' },
  { number: 11, symbol: '⑪', category: '히로인/조연', name: '천연/순수형', outerDefault: '세상 물정 모르고 직설적', innerDefault: '본질을 꿰뚫는 엉뚱한 직관과 흔들리지 않는 선의', contrastTip: '주인공의 냉소적 계산을 깨는 의외의 변수', relationFlowDefault: '호기심 → 무조건 신뢰 → 정신적 지주' },
  { number: 12, symbol: '⑫', category: '히로인/조연', name: '소꿉친구형', outerDefault: '허물없이 티격태격하는 익숙함', innerDefault: '달라진 주인공을 잃을까 두려워하는 불안과 애정', contrastTip: '주인공의 인간적 면모와 과거 서사를 비추는 거울', relationFlowDefault: '익숙함 → 위화감 → 재확인 → 확고한 내 편' },
  { number: 13, symbol: '⑬', category: '히로인/조연', name: '스승/후원자형', outerDefault: '괴짜 같거나 엄격한 원로/거물', innerDefault: '제자의 그릇을 알아보고 판을 깔아주는 노회한 전략가', contrastTip: '주인공의 실력을 보증해 주는 권위적 리액션 장치', relationFlowDefault: '시험 → 경탄 → 파격 후원' },
  { number: 14, symbol: '⑭', category: '히로인/조연', name: '이중성 조연형', outerDefault: '비굴하거나 속물적인 이해타산형', innerDefault: '손익 계산 끝에 의외의 결정적 순간에 의리를 지킴', contrastTip: '배신할 것 같다가 판을 뒤집어 주는 의외성', relationFlowDefault: '거래 → 의심 → 실리적 동맹 → 의리' },

  { number: 15, symbol: '⑮', category: '빌런', name: '조직형 중간 빌런', outerDefault: '규율과 권위를 앞세우는 간부/방계 실세', innerDefault: '기득권 유지에 급급한 옹졸함과 공포', contrastTip: '1권(25화) 내 주인공의 첫 대형 사이다 제물로 최적', relationFlowDefault: '압박 → 굴욕 → 발악 → 몰락' },
  { number: 16, symbol: '⑯', category: '빌런', name: '웃는 얼굴 빌런형', outerDefault: '예의 바르고 온화한 신사/군자', innerDefault: '타인을 장기말로만 보는 냉혹한 소시오패스', contrastTip: '웃으며 던지는 한 마디에 서늘한 위협감 배치', relationFlowDefault: '친절 위장 → 본색 노출 → 지략 대결' },
  { number: 17, symbol: '⑰', category: '빌런', name: '신념형 빌런', outerDefault: '당당하고 카리스마 넘치는 지도자', innerDefault: '자신만의 대의를 위해 다수의 희생을 정당화함', contrastTip: '중후반부(2막) 주인공의 가치관과 정면 충돌', relationFlowDefault: '존중 → 이념 충돌 → 사활을 건 결전' },
  { number: 18, symbol: '⑱', category: '빌런', name: '최종 흑막형', outerDefault: '세계의 질서를 설계한 보이지 않는 손', innerDefault: '판 전체를 통제하려는 오만과 치명적 맹점', contrastTip: '1권부터 작은 복선(threads.plant)으로 흔적만 흘림', relationFlowDefault: '흔적 감지 → 대리인 격파 → 진실 대면' },
];

export const PLOT_STRUCTURES = {
  arc25Blocks: [
    { blockIndex: 0, label: '도입', epRange: '1~5화', role: '1화 훅 · 주인공 능력/낙차 입증 · 첫 소승리', focus: '투베 클릭 전환과 첫 3화 잔존율 확보' },
    { blockIndex: 1, label: '확장', epRange: '6~10화', role: '무대/인물 확장 · 첫 조력자 및 중간 빌런 등장', focus: '세계관 규칙 체감 + 100원 사이다 리듬 고정' },
    { blockIndex: 2, label: '전환', epRange: '11~15화', role: '판이 커지는 전환점 · 정보 낙차 폭발 · 투베 정점', focus: '무료 연재 핵심 피크, 선호작 대량 유입' },
    { blockIndex: 3, label: '클라이맥스', epRange: '16~20화', role: '1권 핵심 갈등 정면 충돌 · 중간 빌런 격파', focus: '최대 카타르시스 + 대서사 실마리 노출' },
    { blockIndex: 4, label: '정리+훅', epRange: '21~25화', role: '보상 수령 · 위상 격상 · 2권 대형 위기/반전 훅', focus: '25화 유료화 결제 전환율 극대화' },
  ],
  longForm500: [
    { act: '1막: 확립', range: '1~100화 (1~4권)', milestone: '100화 선독점 구간 · 주인공 기반 확립 · 1차 세력 정리 · 코어 독자 고정' },
    { act: '2막: 확장·시련', range: '101~300화 (5~12권)', milestone: '상위 무대 진출 · 신념형 빌런 및 세력전 · 세계관 핵심 비밀 단계적 해금' },
    { act: '3막: 수렴·결말', range: '301~500화 (13~20권)', milestone: '복선 총회수 · 최종 흑막과의 전면전 · 에필로그 및 외전 여지 확보' },
  ],
  shortForm200: [
    { act: '1막: 확립', range: '1~50화 (1~2권)', milestone: '초고속 성장 및 초기 적대 세력 정리 · 25화/50화 이중 훅' },
    { act: '2막: 확장·시련', range: '51~150화 (3~6권)', milestone: '핵심 무대 패권 경쟁 · 핵심 비밀 폭로 및 반격' },
    { act: '3막: 수렴·결말', range: '151~200화 (7~8권)', milestone: '최종 결전 압축 전개 · 깔끔한 완결(작가연재 2질 완결 전략에 유리)' },
  ],
} as const;

export const ANCHOR_TAG_META: Record<AnchorTag, { label: AnchorTag; purpose: string; colorClass: string }> = {
  상황: { label: '상황', purpose: '시공간·분위기·현재 위치 즉시 제시', colorClass: 'text-zinc-300 border-zinc-700' },
  문제: { label: '문제', purpose: '주인공을 압박하는 즉각적 장애물·위기', colorClass: 'text-rose-300 border-rose-500/40' },
  판단: { label: '판단', purpose: '상황 해석·전문 지식/기억 기반 통찰', colorClass: 'text-sky-300 border-sky-500/40' },
  목표: { label: '목표', purpose: '이번 씬/화에서 달성할 명확한 의도 선언', colorClass: 'text-amber-300 border-amber-500/40' },
  수쓰기: { label: '수쓰기', purpose: '주인공만의 기발한 해법·행동 개시', colorClass: 'text-indigo-300 border-indigo-500/40' },
  주고받기: { label: '주고받기', purpose: '인물 간 대립·심리전·티키타카 공방', colorClass: 'text-violet-300 border-violet-500/40' },
  이김: { label: '이김', purpose: '핵심 사이다·역전·압도적 성취 순간', colorClass: 'text-emerald-300 border-emerald-500/40' },
  풀이: { label: '풀이', purpose: '승리의 원리 해명·주변 반응·보상 정산', colorClass: 'text-teal-300 border-teal-500/40' },
  갈고리: { label: '갈고리', purpose: '다음 화 결제(100원)를 강제하는 엔딩 훅', colorClass: 'text-amber-200 border-amber-400/60' },
};

export const ALL_ANCHOR_TAGS: AnchorTag[] = [
  '상황',
  '문제',
  '판단',
  '목표',
  '수쓰기',
  '주고받기',
  '이김',
  '풀이',
  '갈고리',
];
