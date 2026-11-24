export type AnchorTag =
  | '상황'
  | '문제'
  | '판단'
  | '목표'
  | '수쓰기'
  | '주고받기'
  | '이김'
  | '풀이'
  | '갈고리';

export type EndingType = '위기' | '반전' | '정보' | '감정';

export interface NarrativeScene {
  name: string;                    // 씬 제목 (예: "숯과 물")
  lines: number;                   // 목표 줄 수 (예: 55)
  tension: 1 | 2 | 3 | 4 | 5;      // 씬 긴장도
  cast: string[];                  // 해당 씬 등장인물 화이트리스트
  hostile: boolean;                // 적대 갈등/위협 존재 여부
  terms: string[];                 // 필수 표기 고유명사
  note: string;                    // 연출 주의사항 (예: "살았다는 걸 깨닫는 순간을 늘려")
  anchors: [AnchorTag, string][];  // [기능 태그, 전개 비트] 2차원 튜플 배열

  // [v2 씬 단위 풍부화 선택 슬롯]
  sensory?: string;                // 공간·감각 앵커 (시각/후각/촉각 디테일)
  subtext?: string;                // 장면 이면·심리전 (겉과 속의 의도 차이)
  key_lines?: string[];            // 작가가 직접 쓴 결정적 대사/독백 (집필 시 토씨 수정 없이 원문 삽입)

  // 내부 편집/계산 보조 필드 (순수 JSON 내보내기 시 제외 가능)
  id?: string;
  target_chars?: number;
}

export interface EpisodeNarrativeBlueprint {
  episode: string;                 // 예: "1화"
  title: string;                   // 예: "당가의 약골 (1)"
  cast_file: string;               // 인물 시트 참조 경로 (예: "labs/runs/test3/cast.md")
  pov: string;                     // 시점 (예: "1인칭 '나'")
  goal: string;                    // 이번 화 핵심 목표와 수단
  must: string[];                  // 반드시 포함할 필수 사건 리스트
  inner: string;                   // 속마음 비중 및 서술 가이드
  prev: string | null;             // 이전 화 핵심 요약 (1화는 null)

  // [v2 전역 풍부화 선택 슬롯]
  prose_tone?: string;             // 문체·호흡 가이드 (예: "위기 씬은 단문 호흡, 추리는 냉철한 이성 톤")
  info_gap?: string;               // 정보 낙차 (주인공·독자만 아는 진실 vs 조연의 착각)
  avoid?: string[];                // 절대 금지선 (AI가 절대 쓰면 안 되는 전개·용어·설명충 규칙)

  stake: string;                   // 실패 시 치명적 대가
  win: {
    what: string;                  // 핵심 사이다/성취 내용
    scene: string;                 // 연결된 scenes[].name
    reaction: string;              // 주변 인물 반응
    stretch: boolean;              // 카타르시스 구간 호흡 늘리기 플래그
    scene_id?: string;             // v1 하위 호환 보조 ID
  };
  laugh: Array<{
    scene: string;                 // 연결된 scenes[].name
    what: string;                  // 유머/티키타카 포인트
    scene_id?: string;             // v1 하위 호환 보조 ID
  }>;
  relation: Array<{
    who: string;                   // 인물명
    from: string;                  // 이전 태도
    to: string;                    // 변화된 태도
  }>;
  ending: {
    type: EndingType;              // 절단신공 유형
    what: string;                  // 마지막 후킹 내용
  };
  threads: {
    plant: Array<{
      what: string;                // 새로 심는 복선
      scene: string;               // 연결된 scenes[].name
      to: string;                  // 회수 예정 화수 및 단서
      scene_id?: string;           // v1 하위 호환 보조 ID
    }>;
    payoff: Array<{
      what: string;                // 이번 화에서 회수하는 복선
      scene: string;               // 연결된 scenes[].name
      scene_id?: string;           // v1 하위 호환 보조 ID
    }>;
  };

  scenes: NarrativeScene[];
}

export interface SceneSuggestionResult {
  sensory: string;
  subtext: string;
  key_lines: string[];
  anchors: [AnchorTag, string][];
}
