import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type, type Schema } from '@google/genai';
import {
  GEMINI_MAX_ATTEMPTS,
  is429RateLimitError,
  is503UnavailableError,
  withGeminiRetry,
} from './src/utils/geminiRetry.ts';
import { buildDynamicRulesInstruction } from './src/utils/ruleProfileEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// gemini-4-hydrogen supports both ThinkingLevel.HIGH and ThinkingLevel.MEDIUM on standard keys.
const MODEL_COMPLEX = 'gemini-4-hydrogen';
const MODEL_FAST = 'gemini-4-hydrogen';
// Free-tier fallback model used only on the final retry attempt if the primary model remains overloaded (503/429).
const MODEL_FALLBACK = 'gemini-3.1-flash-lite';

const MUNPIA_SYSTEM_BASE = `당신은 한국 상업 웹소설(문피아·네이버 시리즈·카카오페이지) 전문 기획 아키텍트이자 편집자입니다.
모든 제안과 분석은 반드시 문피아 플랫폼 생존 공식에 기반해야 합니다:
- 편당결제 구조: 1화 = 100원. 매화 독자가 돈을 낼 이유('100원 가치': 사이다·정보 해금·위기 돌파·갈고리)가 있어야 함.
- 투데이베스트(투베) 진입: 단일 편 최고 조회수 기준. 최소 3,000자 이상(N 마크), 표준 5,000자 내외.
- 25화(1권) 유료화 전환: 1~15화 무료 구간 투베 진입 + 선호작 확보, 20~25화 강력한 유료 전환 훅 배치.
- 장기 연재: 200화(8권) 단축형 또는 500화(20권) 3막, 100화(125,000자) 선독점 후 타 플랫폼 확장.
- 코어 타깃: 20~40대 남성 판타지·무협·현판·헌터·경영·스포츠 독자. 사건 위주 전개, 설명충(Infodump)·과도한 내면 독백·일본 라노벨식 오타쿠 감성 경계.
- 모든 응답은 한국어로 작성하며, 요청된 JSON 스키마를 정확히 준수하십시오.`;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 서버 환경 변수에 설정되어 있지 않습니다. Settings > Secrets 패널에서 API 키를 확인해 주세요. (수동 설계·JSON 입출력·글자 수 계산기는 API 키 없이도 100% 작동합니다.)'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateStructuredJson<T>(
  prompt: string,
  responseSchema: Schema,
  options: {
    tier: 'high' | 'medium';
    extraSystem?: string;
  }
): Promise<T> {
  const ai = getGeminiClient();
  const primaryModel = options.tier === 'high' ? MODEL_COMPLEX : MODEL_FAST;
  const thinkingLevel = options.tier === 'high' ? ThinkingLevel.HIGH : ThinkingLevel.MEDIUM;
  const systemInstruction = options.extraSystem
    ? `${MUNPIA_SYSTEM_BASE}\n\n${options.extraSystem}`
    : MUNPIA_SYSTEM_BASE;

  return withGeminiRetry<T>(
    async (attempt, lastError) => {
      const useFallback =
        attempt === GEMINI_MAX_ATTEMPTS - 1 &&
        (is503UnavailableError(lastError) || is429RateLimitError(lastError));
      const model = useFallback ? MODEL_FALLBACK : primaryModel;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: { thinkingLevel },
        },
      });
      const text = (response.text ?? '').trim();
      if (!text) {
        throw new Error('AI 모델이 빈 응답을 반환했습니다.');
      }
      return JSON.parse(text) as T;
    },
    {
      onRetry: ({ attempt, nextAttempt, delayMs, error }) => {
        const tag = is503UnavailableError(error)
          ? '503 UNAVAILABLE'
          : is429RateLimitError(error)
            ? '429 RATE_LIMIT'
            : 'transient error';
        console.log(
          `[Gemini Retry] Attempt ${attempt + 1}/${GEMINI_MAX_ATTEMPTS} (${tag}) — retrying #${nextAttempt + 1} in ${delayMs}ms`
        );
      },
    }
  );
}

const preReadSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    genreMix: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          genre: { type: Type.STRING },
          ratio: { type: Type.INTEGER },
        },
        required: ['genre', 'ratio'],
      },
    },
    munpiaFitSummary: { type: Type.STRING },
    munpiaFitLevel: { type: Type.STRING, enum: ['최적', '적합', '조정 권장', '비주류 주의'] },
    targetReader: { type: Type.STRING },
    protagonistProfile: {
      type: Type.OBJECT,
      properties: {
        personality: { type: Type.STRING },
        coreConflict: { type: Type.STRING },
        desire: { type: Type.STRING },
      },
      required: ['personality', 'coreConflict', 'desire'],
    },
    worldCoreRule: { type: Type.STRING },
    narrativeEngineOneLine: { type: Type.STRING },
    toneRatio: {
      type: Type.OBJECT,
      properties: {
        comedy: { type: Type.INTEGER },
        serious: { type: Type.INTEGER },
        note: { type: Type.STRING },
      },
      required: ['comedy', 'serious', 'note'],
    },
    ep25HookCandidates: { type: Type.ARRAY, items: { type: Type.STRING } },
    tobeAppealPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    undecidedQuestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          context: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          selectedOption: { type: Type.STRING },
          customAnswer: { type: Type.STRING },
        },
        required: ['id', 'question', 'context', 'options', 'selectedOption', 'customAnswer'],
      },
    },
  },
  required: [
    'genreMix',
    'munpiaFitSummary',
    'munpiaFitLevel',
    'targetReader',
    'protagonistProfile',
    'worldCoreRule',
    'narrativeEngineOneLine',
    'toneRatio',
    'ep25HookCandidates',
    'tobeAppealPoints',
    'warnings',
    'undecidedQuestions',
  ],
};

const settingBibleSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    subtitleOrLogline: { type: Type.STRING },
    basicInfo: {
      type: Type.OBJECT,
      properties: {
        genres: { type: Type.ARRAY, items: { type: Type.STRING } },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        pov: { type: Type.STRING },
        serializationGoal: { type: Type.STRING },
        targetCharsPerEp: { type: Type.INTEGER },
      },
      required: ['genres', 'keywords', 'pov', 'serializationGoal', 'targetCharsPerEp'],
    },
    narrativeEngine: {
      type: Type.OBJECT,
      properties: {
        coreIrony: { type: Type.STRING },
        infoGap: { type: Type.STRING },
        payPerEpDriver: { type: Type.STRING },
        oneLineAnswer: { type: Type.STRING },
      },
      required: ['coreIrony', 'infoGap', 'payPerEpDriver', 'oneLineAnswer'],
    },
    worldview: {
      type: Type.OBJECT,
      properties: {
        eraAndSetting: { type: Type.STRING },
        coreRules: { type: Type.ARRAY, items: { type: Type.STRING } },
        terminology: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              meaning: { type: Type.STRING },
            },
            required: ['term', 'meaning'],
          },
        },
      },
      required: ['eraAndSetting', 'coreRules', 'terminology'],
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          name: { type: Type.STRING },
          role: { type: Type.STRING, enum: ['주인공', '히로인/조연', '빌런'] },
          archetypeNumber: { type: Type.INTEGER },
          archetypeName: { type: Type.STRING },
          outerPersonality: { type: Type.STRING },
          innerPersonality: { type: Type.STRING },
          ability: { type: Type.STRING },
          relationshipFlow: { type: Type.STRING },
          speechNote: { type: Type.STRING },
        },
        required: [
          'id',
          'name',
          'role',
          'archetypeNumber',
          'archetypeName',
          'outerPersonality',
          'innerPersonality',
          'ability',
          'relationshipFlow',
          'speechNote',
        ],
      },
    },
    storyRoadmap: {
      type: Type.OBJECT,
      properties: {
        ep1To25: { type: Type.STRING },
        ep26To50: { type: Type.STRING },
        ep51Plus: { type: Type.STRING },
      },
      required: ['ep1To25', 'ep26To50', 'ep51Plus'],
    },
    munpiaStrategyMemo: { type: Type.STRING },
    pendingItems: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: [
    'title',
    'subtitleOrLogline',
    'basicInfo',
    'narrativeEngine',
    'worldview',
    'characters',
    'storyRoadmap',
    'munpiaStrategyMemo',
    'pendingItems',
  ],
};

const arcPlanSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    arcNumber: { type: Type.INTEGER },
    title: { type: Type.STRING },
    epRange: { type: Type.STRING },
    arcGoal: { type: Type.STRING },
    kickEvents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          type: { type: Type.STRING, enum: ['단발 킥이벤트', '대서사 필수'] },
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          assignedBlockIndex: { type: Type.INTEGER },
          payoffValue: { type: Type.STRING },
        },
        required: ['id', 'type', 'title', 'summary', 'assignedBlockIndex', 'payoffValue'],
      },
    },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blockIndex: { type: Type.INTEGER },
          label: { type: Type.STRING },
          epRange: { type: Type.STRING },
          role: { type: Type.STRING },
          goal: { type: Type.STRING },
          keyBeat: { type: Type.STRING },
          cliffhanger: { type: Type.STRING },
        },
        required: ['blockIndex', 'label', 'epRange', 'role', 'goal', 'keyBeat', 'cliffhanger'],
      },
    },
  },
  required: ['arcNumber', 'title', 'epRange', 'arcGoal', 'kickEvents', 'blocks'],
};

const deep3QSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    overallVerdict: { type: Type.STRING },
    paywallReadiness: { type: Type.STRING },
    weakPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    upgrades: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['overallVerdict', 'paywallReadiness', 'weakPoints', 'upgrades'],
};

const blockGuideSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    blockIndex: { type: Type.INTEGER },
    epRange: { type: Type.STRING },
    blockGoal: { type: Type.STRING },
    episodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          episodeNumber: { type: Type.INTEGER },
          episodeLabel: { type: Type.STRING },
          oneLineTitle: { type: Type.STRING },
          opening: { type: Type.STRING },
          coreIncident: { type: Type.STRING },
          ending: { type: Type.STRING },
          value100Won: { type: Type.STRING },
          serviceScene: { type: Type.STRING },
        },
        required: [
          'episodeNumber',
          'episodeLabel',
          'oneLineTitle',
          'opening',
          'coreIncident',
          'ending',
          'value100Won',
          'serviceScene',
        ],
      },
    },
    checklist: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          checked: { type: Type.BOOLEAN },
        },
        required: ['id', 'text', 'checked'],
      },
    },
  },
  required: ['blockIndex', 'epRange', 'blockGoal', 'episodes', 'checklist'],
};

const blueprintV2Schema: Schema = {
  type: Type.OBJECT,
  properties: {
    episode: { type: Type.STRING },
    title: { type: Type.STRING },
    cast_file: { type: Type.STRING },
    pov: { type: Type.STRING },
    prev: { type: Type.STRING, nullable: true },
    goal: { type: Type.STRING },
    stake: { type: Type.STRING },
    inner: { type: Type.STRING },
    must: { type: Type.ARRAY, items: { type: Type.STRING } },
    prose_tone: { type: Type.STRING },
    info_gap: { type: Type.STRING },
    avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
    win: {
      type: Type.OBJECT,
      properties: {
        what: { type: Type.STRING },
        scene: { type: Type.STRING },
        reaction: { type: Type.STRING },
        stretch: { type: Type.BOOLEAN },
      },
      required: ['what', 'scene', 'reaction', 'stretch'],
    },
    laugh: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          scene: { type: Type.STRING },
          what: { type: Type.STRING },
        },
        required: ['scene', 'what'],
      },
    },
    relation: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          who: { type: Type.STRING },
          from: { type: Type.STRING },
          to: { type: Type.STRING },
        },
        required: ['who', 'from', 'to'],
      },
    },
    ending: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['위기', '반전', '정보', '감정'] },
        what: { type: Type.STRING },
      },
      required: ['type', 'what'],
    },
    threads: {
      type: Type.OBJECT,
      properties: {
        plant: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              what: { type: Type.STRING },
              scene: { type: Type.STRING },
              to: { type: Type.STRING },
            },
            required: ['what', 'scene', 'to'],
          },
        },
        payoff: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              what: { type: Type.STRING },
              scene: { type: Type.STRING },
            },
            required: ['what', 'scene'],
          },
        },
      },
      required: ['plant', 'payoff'],
    },
    scenes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          lines: { type: Type.INTEGER },
          tension: { type: Type.INTEGER },
          cast: { type: Type.ARRAY, items: { type: Type.STRING } },
          hostile: { type: Type.BOOLEAN },
          terms: { type: Type.ARRAY, items: { type: Type.STRING } },
          note: { type: Type.STRING },
          sensory: { type: Type.STRING },
          subtext: { type: Type.STRING },
          key_lines: { type: Type.ARRAY, items: { type: Type.STRING } },
          anchors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tag: {
                  type: Type.STRING,
                  enum: ['상황', '문제', '판단', '목표', '수쓰기', '주고받기', '이김', '풀이', '갈고리'],
                },
                beat: { type: Type.STRING },
              },
              required: ['tag', 'beat'],
            },
          },
        },
        required: [
          'name',
          'lines',
          'tension',
          'cast',
          'hostile',
          'terms',
          'note',
          'sensory',
          'subtext',
          'key_lines',
          'anchors',
        ],
      },
    },
  },
  required: [
    'episode',
    'title',
    'cast_file',
    'pov',
    'goal',
    'stake',
    'inner',
    'must',
    'prose_tone',
    'info_gap',
    'avoid',
    'win',
    'laugh',
    'relation',
    'ending',
    'threads',
    'scenes',
  ],
};

const sceneSuggestSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sensory: { type: Type.STRING },
    subtext: { type: Type.STRING },
    key_lines: { type: Type.ARRAY, items: { type: Type.STRING } },
    anchors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tag: {
            type: Type.STRING,
            enum: ['상황', '문제', '판단', '목표', '수쓰기', '주고받기', '이김', '풀이', '갈고리'],
          },
          beat: { type: Type.STRING },
        },
        required: ['tag', 'beat'],
      },
    },
  },
  required: ['sensory', 'subtext', 'key_lines', 'anchors'],
};

const brainDumpResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    workingTitle: { type: Type.STRING },
    genres: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    targetVolumePlan: { type: Type.STRING, enum: ['200화 단축형 (8권)', '500화 표준 3막 (20권)'] },
    proseTone: { type: Type.STRING },
    avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
    phase1: preReadSchema,
    phase2: settingBibleSchema,
    phase3: arcPlanSchema,
    phase4Blocks: {
      type: Type.ARRAY,
      items: blockGuideSchema,
    },
    blueprints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          episodeNumber: { type: Type.INTEGER },
          blueprint: blueprintV2Schema,
        },
        required: ['episodeNumber', 'blueprint'],
      },
    },
    inferredFields: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'workingTitle',
    'genres',
    'keywords',
    'targetVolumePlan',
    'proseTone',
    'avoid',
    'phase1',
    'phase2',
    'phase3',
    'phase4Blocks',
    'blueprints',
    'inferredFields',
  ],
};

const MUNPIA_18_ARCHETYPES_PROMPT = `문피아 18종 캐릭터 아키타입 번호표 (반드시 번호와 이름 일치):
[주인공 1~7] 1:냉철한 계산형 / 2:복수귀·집념형 / 3:느긋한 먼치킨형 / 4:생존 본능형 / 5:오만·당당형 / 6:호구→각성형 / 7:전문가·직업인형
[히로인/조연 8~13] 8:차가운 미녀형 / 9:밝은 조력자형 / 10:스승·노괴형 / 11:라이벌→동료형 / 12:충신·부하형 / 13:마스코트·귀요미형
[빌런 14~18] 14:오만한 귀족·재벌형 / 15:조직형 중간 빌런 / 16:광기·사이코형 / 17:배신자형 / 18:최종 흑막형`;

function extractServerQuotedLines(memo: string): string[] {
  const found: string[] = [];
  const regex = /"([^"\n]{3,160})"|“([^”\n]{3,160})”/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(memo)) !== null) {
    const inner = (match[1] ?? match[2] ?? '').trim();
    if (!inner || inner.includes('여기에 꼭 쓰고 싶은 원문 대사를')) continue;
    const quoted = `"${inner}"`;
    if (!found.includes(quoted)) found.push(quoted);
  }
  return found;
}

function prependSeriesMemory(prompt: string, seriesMemoryText: unknown): string {
  const memoryText = typeof seriesMemoryText === 'string' ? seriesMemoryText.trim() : '';
  if (!memoryText) return prompt;
  return `[누적 시리즈 바이블 — 세계관·인물 최신 상태·미회수 복선·확정 고유명사]
아래 누적 설정은 이미 확정된 앞 화의 진실입니다. 인물 관계·고유명사 표기·세계관 규칙·복선 흐름이 아래 내용과 충돌하지 않도록 철저히 일관성을 유지하십시오.
${memoryText}

---
${prompt}`;
}

function convertAnchorObjects(raw: Record<string, unknown>, episodeNumber: number, prevSummary: string | null) {
  const scenes = Array.isArray(raw.scenes)
    ? raw.scenes.map((sc: Record<string, unknown>, idx: number) => ({
        ...sc,
        id: `S${idx + 1}`,
        anchors: Array.isArray(sc.anchors)
          ? sc.anchors.map((a: Record<string, string>) => [a.tag, a.beat])
          : [],
      }))
    : [];

  return {
    ...raw,
    prev: episodeNumber === 1 ? null : raw.prev ?? prevSummary ?? null,
    scenes,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, version: 'v2', modelComplex: MODEL_COMPLEX, modelFast: MODEL_FAST });
  });

  app.post('/api/ai/preread', async (req, res) => {
    try {
      const { phase0 } = req.body;
      if (!phase0?.rawIdeaOrPrologue?.trim()) {
        return res.status(400).json({ error: '프롤로그, 시놉시스 또는 아이디어 메모를 입력해 주세요.' });
      }
      const prompt = `작가가 입력한 작품 기획 초안을 문피아 기준으로 선읽기(Phase 1) 분석하세요.
[가제]: ${phase0.workingTitle || '미정'}
[선택 장르]: ${(phase0.selectedGenres || []).join(', ')}
[인기 키워드]: ${(phase0.selectedKeywords || []).join(', ')}
[선택 1화 훅]: ${phase0.selectedHookPatternId || '미지정'}
[목표 연재 볼륨]: ${phase0.targetVolumePlan}
[작가 메모]: ${phase0.authorNotes || '없음'}
[프롤로그/아이디어 본문]:
${phase0.rawIdeaOrPrologue}

요구사항:
1. genreMix 비율 합이 100이 되도록 산출.
2. undecidedQuestions는 3~5개 생성하고, 각 질문마다 선택지 3개(options)와 추천 기본값(selectedOption)을 채울 것.
3. ep25HookCandidates는 25화 유료화 전환용 강력한 훅 후보 3개 제시.
4. warnings에는 문피아 독자 이탈 위험(설명충, 독백 과다, 라노벨 톤 등)을 냉정하게 지적.`;

      const data = await generateStructuredJson<Record<string, unknown>>(prompt, preReadSchema, { tier: 'medium' });
      return res.json({ data: { ...data, confirmed: false } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI 선읽기 요청에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/setting', async (req, res) => {
    try {
      const { phase0, phase1 } = req.body;
      const answered = (phase1?.undecidedQuestions || [])
        .map(
          (q: { question: string; selectedOption: string; customAnswer: string }) =>
            `- 질문: ${q.question}\n  작가 결정: ${q.customAnswer?.trim() || q.selectedOption}`
        )
        .join('\n');

      const prompt = `Phase 0 원안과 Phase 1 선읽기 및 작가 결정사항을 바탕으로 완성도 높은 Phase 2 세팅 바이블(SettingBible)을 작성하세요.
[가제]: ${phase0?.workingTitle || '미정'}
[원안]: ${phase0?.rawIdeaOrPrologue || ''}
[서사 엔진 요약]: ${phase1?.narrativeEngineOneLine || ''}
[세계관 핵심 룰]: ${phase1?.worldCoreRule || ''}
[작가 확정 답변]:
${answered || '기본 추천안 따름'}

요구사항:
1. characters는 최소 4명(주인공 1, 히로인/조연 2, 1권 중간 빌런 1)을 생성하고, 문피아 18종 아키타입 번호(1~18)와 겉 성격 / 속 성격 낙차, 관계 변화 흐름을 반드시 포함.
2. worldview.terminology는 최소 4개 핵심 고유명사와 간결한 정의 작성.
3. storyRoadmap에 1~25화(1권), 26~50화(2권), 51화~ 장기 로드맵을 구체적으로 작성.`;

      const data = await generateStructuredJson<Record<string, unknown>>(prompt, settingBibleSchema, { tier: 'high' });
      return res.json({ data: { ...data, confirmed: false } });
    } catch (err) {
      const message = err instanceof Error ? err.message : '세팅 바이블 생성에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/arc', async (req, res) => {
    try {
      const { phase2 } = req.body;
      if (!phase2) {
        return res.status(400).json({ error: 'Phase 2 세팅 바이블이 먼저 필요합니다.' });
      }
      const prompt = `다음 세팅 바이블을 바탕으로 Phase 3 25화(1권) 아크 설계도를 생성하세요.
[작품명]: ${phase2.title}
[서사 엔진]: ${JSON.stringify(phase2.narrativeEngine)}
[인물표]: ${JSON.stringify(phase2.characters)}
[1~25화 로드맵]: ${phase2.storyRoadmap?.ep1To25 || ''}

요구사항:
1. kickEvents는 '단발 킥이벤트' 7~8개 + '대서사 필수' 2~3개로 총 10개를 생성하고, assignedBlockIndex(0~4)에 고르게 배치.
2. blocks는 반드시 5개(blockIndex 0~4: 도입 1~5화 / 확장 6~10화 / 전환 11~15화 / 클라이맥스 16~20화 / 정리+훅 21~25화).
3. 각 블록의 cliffhanger는 다음 블록 결제를 강제할 만큼 구체적 사건으로 작성.`;

      const data = await generateStructuredJson<Record<string, unknown>>(prompt, arcPlanSchema, { tier: 'high' });
      return res.json({ data: { ...data, confirmed: false } });
    } catch (err) {
      const message = err instanceof Error ? err.message : '25화 아크 생성에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/diagnose-3q', async (req, res) => {
    try {
      const { phase2, phase3, seriesMemoryText, ruleProfile } = req.body;
      if (!phase3) {
        return res.status(400).json({ error: '진단할 25화 아크 설계도가 필요합니다.' });
      }
      const dynamicRules = buildDynamicRulesInstruction(ruleProfile, 'diagnose');
      const prompt = prependSeriesMemory(
        `문피아 상업 편집자 시점에서 다음 25화(1권) 아크 설계도의 3-Q 밀도와 유료화 전환력을 냉정하게 정밀 진단하세요.
[작품 세팅]: ${JSON.stringify(phase2 || {})}
[25화 아크]: ${JSON.stringify(phase3)}

${dynamicRules}

진단 지침:
- 위 [활성 연출·플롯 규칙 프로필]에서 ON으로 켜진 규칙과 선택된 플롯 골격을 기준으로 이탈 위험 구간(weakPoints)과 밀도 보강 처방(upgrades)을 구체적으로 제시하십시오.
- 프로필에서 OFF로 해제된 규칙(예: 초반 5화 패 공개 해제, 낚시 엔딩 금지 해제, 무변화 씬 스킵 해제 등)에 대해서는 불필요한 지적을 하지 마십시오.`,
        seriesMemoryText
      );

      const data = await generateStructuredJson<Record<string, unknown>>(prompt, deep3QSchema, { tier: 'high' });
      return res.json({ data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI 3-Q 정밀 진단에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/block-guide', async (req, res) => {
    try {
      const { phase2, phase3, blockIndex, ruleProfile } = req.body;
      const idx = Number(blockIndex ?? 0);
      const startEp = idx * 5 + 1;
      const endEp = startEp + 4;
      const block = phase3?.blocks?.find((b: { blockIndex: number }) => b.blockIndex === idx);
      const blockKicks = (phase3?.kickEvents || []).filter(
        (k: { assignedBlockIndex: number }) => k.assignedBlockIndex === idx
      );
      const dynamicRules = buildDynamicRulesInstruction(ruleProfile, 'block');

      const prompt = `Phase 4 5화 단위 에피소드 가이드(${startEp}~${endEp}화)를 생성하세요.
[작품명]: ${phase2?.title || ''}
[서사 엔진]: ${phase2?.narrativeEngine?.oneLineAnswer || ''}
[블록 정보]: ${JSON.stringify(block || { epRange: `${startEp}~${endEp}화` })}
[이 블록 배정 킥이벤트]: ${JSON.stringify(blockKicks)}
[주요 인물]: ${(phase2?.characters || []).map((c: { name: string; role: string }) => `${c.name}(${c.role})`).join(', ')}

${dynamicRules}

요구사항:
1. episodes 배열에 정확히 ${startEp}화부터 ${endEp}화까지 5개 회차를 작성 (episodeLabel은 "ep.${startEp}" 형식).
2. 위 [활성 연출·플롯 규칙 프로필]의 플롯 골격과 ON 규칙을 반영해 각 회차의 시작·핵심 사건·끝·value100Won·serviceScene을 선명하게 구성할 것.
3. checklist에 현재 프로필과 문피아 연재 기준에 맞는 점검 항목 4개 작성.`;

      const data = await generateStructuredJson<Record<string, unknown>>(prompt, blockGuideSchema, { tier: 'medium' });
      return res.json({ data });
    } catch (err) {
      const message = err instanceof Error ? err.message : '5화 블록 가이드 생성에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/blueprint', async (req, res) => {
    try {
      const { phase2, episodeGuide, prevSummary, seriesMemoryText, ruleProfile } = req.body;
      if (!episodeGuide) {
        return res.status(400).json({ error: '회차 가이드 정보가 필요합니다.' });
      }
      const dynamicRules = buildDynamicRulesInstruction(ruleProfile, 'blueprint');
      const prompt = prependSeriesMemory(
        `Phase 4 미시 회차 서사 제어 설계도 v2(EpisodeNarrativeBlueprint)를 정밀 조립하세요.
[작품명]: ${phase2?.title || ''}
[시점]: ${phase2?.basicInfo?.pov || "1인칭 '나'"}
[인물표]: ${JSON.stringify(phase2?.characters || [])}
[고유명사]: ${JSON.stringify(phase2?.worldview?.terminology || [])}
[대상 회차]: ${episodeGuide.episodeNumber}화 — ${episodeGuide.oneLineTitle}
[시작]: ${episodeGuide.opening}
[핵심 사건]: ${episodeGuide.coreIncident}
[끝]: ${episodeGuide.ending}
[100원 가치]: ${episodeGuide.value100Won}
[서비스 씬]: ${episodeGuide.serviceScene}
[이전 화 요약]: ${prevSummary || '없음 (1화)'}

${dynamicRules}

구조적 필수 요구사항:
1. 전역 v2 슬롯(prose_tone, info_gap, avoid)을 위 활성 규칙 프로필에 맞춰 구체적으로 작성.
2. scenes는 4개로 구성하고, lines 합계가 약 165줄(5,000자 기준)이 되도록 배분.
3. 각 씬에 sensory(공간·감각 디테일), subtext(장면 이면·심리전), key_lines(원문 무수정 삽입용 결정적 대사/독백 1~2줄)를 모두 작성.
4. win.scene, laugh[].scene, threads.plant[].scene, threads.payoff[].scene은 반드시 scenes[].name과 정확히 일치. 마지막 씬의 마지막 anchor tag는 반드시 '갈고리'. 1화라면 prev는 null.`,
        seriesMemoryText
      );

      const raw = await generateStructuredJson<Record<string, unknown>>(prompt, blueprintV2Schema, { tier: 'high' });
      return res.json({
        data: convertAnchorObjects(raw, Number(episodeGuide.episodeNumber || 1), prevSummary ?? null),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '회차 서사 설계도 생성에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/blueprint-assemble', async (req, res) => {
    try {
      const { phase2, episodeNumber, memo, prevSummary, seriesMemoryText, ruleProfile } = req.body;
      if (!memo || !String(memo).trim()) {
        return res.status(400).json({ error: '5~6줄 분량의 한국어 줄거리 메모를 먼저 입력해 주세요.' });
      }
      const epNum = Number(episodeNumber || 1);
      const dynamicRules = buildDynamicRulesInstruction(ruleProfile, 'assemble');
      const prompt = prependSeriesMemory(
        `작가가 입력한 거친 줄거리 메모를 바탕으로 MUNPIA FORGE v2 정밀 회차 서사 제어 설계도(JSON)를 완성도 높게 자동 조립하세요.
[작품명]: ${phase2?.title || '미정'}
[시점]: ${phase2?.basicInfo?.pov || "1인칭 '나'"}
[인물표]: ${JSON.stringify(phase2?.characters || [])}
[고유명사]: ${JSON.stringify(phase2?.worldview?.terminology || [])}
[대상 회차]: ${epNum}화
[이전 화 요약]: ${prevSummary || '없음 (1화)'}
[작가의 줄거리 메모]:
${memo}

${dynamicRules}

구조적 필수 요구사항:
1. 작가의 메모 속 핵심 사건과 인물을 놓치지 않고 4개 씬(scenes)과 앵커 비트(anchors)로 구조화할 것.
2. v2 전역 슬롯(prose_tone, info_gap, avoid)과 씬별 슬롯(sensory, subtext, key_lines)을 위 활성 규칙 프로필에 맞춰 풍부하게 채울 것.
3. win.scene, laugh[].scene, threads.*.scene은 반드시 scenes[].name과 정확히 일치시킬 것. 마지막 씬의 마지막 앵커 태그는 반드시 '갈고리'.`,
        seriesMemoryText
      );

      const raw = await generateStructuredJson<Record<string, unknown>>(prompt, blueprintV2Schema, { tier: 'high' });
      return res.json({
        data: convertAnchorObjects(raw, epNum, prevSummary ?? null),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '메모 기반 AI 설계도 자동 조립에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/scene-suggest', async (req, res) => {
    try {
      const { blueprint, scene, seriesMemoryText } = req.body;
      if (!scene?.name) {
        return res.status(400).json({ error: '추천을 생성할 씬 정보가 필요합니다.' });
      }
      const prompt = prependSeriesMemory(
        `작가가 정밀 디렉팅 중인 단일 씬에 대해 비파괴적 보강 아이디어(감각 디테일·서브텍스트·결정적 대사·추가 앵커 비트)를 제안하세요.
[회차]: ${blueprint?.episode || ''} ${blueprint?.title || ''}
[회차 목표]: ${blueprint?.goal || ''}
[씬 이름]: ${scene.name}
[등장인물]: ${(scene.cast || []).join(', ')}
[긴장도]: ${scene.tension}/5 · 적대 갈등: ${scene.hostile ? '있음' : '없음'}
[연출 메모]: ${scene.note || '없음'}
[현재 앵커]: ${JSON.stringify(scene.anchors || [])}

요구사항:
1. sensory: 시청각·후각·촉각을 자극하는 현장 감각 1~2문장.
2. subtext: 겉대사 뒤에 숨은 인물들의 의도와 심리전 1문장.
3. key_lines: 문피아 독자가 카타르시스를 느낄 만한 짧고 강렬한 원문 대사/독백 후보 2개.
4. anchors: 기존 앵커를 보강하거나 바로 덧붙일 수 있는 2~3개의 전개 비트.`,
        seriesMemoryText
      );

      const raw = await generateStructuredJson<Record<string, unknown>>(prompt, sceneSuggestSchema, { tier: 'medium' });
      const anchors = Array.isArray(raw.anchors)
        ? raw.anchors.map((a: Record<string, string>) => [a.tag, a.beat])
        : [];
      return res.json({
        data: {
          sensory: String(raw.sensory ?? ''),
          subtext: String(raw.subtext ?? ''),
          key_lines: Array.isArray(raw.key_lines) ? raw.key_lines.map(String) : [],
          anchors,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '씬 앵커·감각 아이디어 추천에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/brain-dump', async (req, res) => {
    try {
      const { memo, mode, existingSummary, seriesMemoryText, ruleProfile } = req.body;
      if (!memo || !String(memo).trim()) {
        return res.status(400).json({ error: '혼잣말 아이디어 메모를 먼저 입력해 주세요.' });
      }

      const rawMemo = String(memo).trim();
      const verbatimQuotes = extractServerQuotedLines(rawMemo);
      const quoteSection =
        verbatimQuotes.length > 0
          ? `[작가 직필 큰따옴표 대사 목록 — 토씨 하나 수정하지 말고 해당 씬 key_lines에 원문 그대로 삽입 필수]:\n${verbatimQuotes.map((q, i) => `${i + 1}. ${q}`).join('\n')}`
          : '[작가 직필 큰따옴표 대사]: 없음 (필요 시 문피아 톤의 결정적 대사 1~2줄 제안)';

      const mergeSection =
        mode === 'merge' && existingSummary
          ? `[병합 모드 컨텍스트 — 기존 작품 설정]: ${JSON.stringify(existingSummary)}\n기존 설정과 충돌하지 않게 새로 언급된 인물·사건·회차 위주로 정밀하게 추출하고 보완하십시오.`
          : '[신규 작품 전체 자동 세팅 모드]: 입력된 혼잣말 메모를 바탕으로 Phase 1~4 전체 설계도를 한 번에 완성하십시오.';

      const dynamicRules = buildDynamicRulesInstruction(ruleProfile, 'brain_dump');

      const prompt = prependSeriesMemory(
        `당신은 작가가 형식 없이 혼잣말처럼 적은 긴 아이디어 메모(Brain Dump)를 한 번에 분석하여 MUNPIA FORGE v2 전체 데이터(Phase 1 선읽기, Phase 2 세팅 바이블·인물표, Phase 3 25화 아크, Phase 4 5화 가이드 및 회차별 정밀 설계도)로 일괄 구조화하는 엔진입니다.

${mergeSection}

${MUNPIA_18_ARCHETYPES_PROMPT}

${quoteSection}

${dynamicRules}

[작가의 자유 입력 아이디어 메모]:
${rawMemo}

필수 추출 및 매핑 규칙:
1. 작품 세팅(phase1 & phase2): 메모에서 장르, 핵심 아이러니, info_gap(정보 낙차), 세계관 핵심 룰, proseTone, avoid를 활성 규칙 프로필에 맞춰 정확히 추출해 채울 것.
2. 인물 시트(phase2.characters): 메모에 등장하는 모든 인물을 빠짐없이 추출하고, 위 18종 캐릭터 아키타입 중 가장 유사한 archetypeNumber(1~18)와 archetypeName을 매칭하며, 겉 성격(outerPersonality)과 속 성격(innerPersonality)의 낙차, 주인공과의 관계 변화(relationshipFlow: "초기 → 변화")를 채울 것.
3. 25화(1권) 아크(phase3): 메모에 언급된 크고 작은 사건을 5블록(blockIndex 0~4: 도입 1~5화 / 확장 6~10화 / 전환 11~15화 / 클라이맥스 16~20화 / 정리+훅 21~25화)에 배치하고, 비어 있는 블록에는 단발/대서사 킥이벤트 후보를 제안해 총 9~10개를 채울 것. (도입 1~5화 패 공개 여부 등 세부 작법 제약은 위 활성 규칙 프로필을 따를 것.)
4. 회차별 정밀 설계도(phase4Blocks & blueprints):
   - phase4Blocks에는 최소 1~5화(blockIndex: 0) 가이드를 생성할 것.
   - blueprints 배열에는 메모에 구체적 장면/화수 묘사가 있는 회차(없더라도 최소 1화)를 정밀 조립할 것.
   - 각 회차 blueprint는 4개 scenes[], 9종 태그 anchors, sensory, subtext, key_lines를 모두 채우며, 플롯 골격·win.stretch·엔딩 구조·단독 씬 허용 여부는 위 활성 규칙 프로필을 정확히 따를 것.
   - 위 [작가 직필 큰따옴표 대사 목록]에 있는 대사는 절대 수정하지 말고 가장 알맞은 씬의 key_lines 배열에 원문 그대로 넣을 것.
5. inferredFields(AI 추정 항목 기록): 작가가 메모에 명시하지 않아 AI가 문맥상 추론/보완한 항목의 키만 문자열 배열로 반환할 것. 사용 가능한 키 형식:
   - "setting.coreIrony", "setting.infoGap", "setting.worldview", "setting.roadmap"
   - "char.0.archetype", "char.1.archetype", "char.0.personality", "char.1.relation" (characters 배열 인덱스 기준)
   - "arc.arcGoal", "arc.block.0.cliffhanger" ~ "arc.block.4.cliffhanger"
   - "blueprint.1.prose_tone", "blueprint.1.info_gap", "blueprint.1.ending" (해당 화수 기준)`,
        seriesMemoryText
      );

      const raw = await generateStructuredJson<Record<string, unknown>>(prompt, brainDumpResponseSchema, {
        tier: 'high',
      });

      const rawBlueprints = Array.isArray(raw.blueprints)
        ? (raw.blueprints as Array<{ episodeNumber: number; blueprint: Record<string, unknown> }>).map(
            (item) => {
              const epNum = Math.max(1, Math.round(Number(item.episodeNumber || 1)));
              return {
                episodeNumber: epNum,
                blueprint: convertAnchorObjects(item.blueprint || {}, epNum, null),
              };
            }
          )
        : [];

      return res.json({
        data: {
          ...raw,
          phase1: { ...(raw.phase1 as Record<string, unknown>), confirmed: false },
          phase2: { ...(raw.phase2 as Record<string, unknown>), confirmed: false },
          phase3: { ...(raw.phase3 as Record<string, unknown>), confirmed: false },
          blueprints: rawBlueprints,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '아이디어 덤프 자동 파싱에 실패했습니다.';
      return res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MUNPIA FORGE v2 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
