import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Lazy initialization
let genAI: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not configured')
    }
    genAI = new GoogleGenerativeAI(apiKey)
  }
  return genAI
}

// Raw PCM을 WAV로 변환 (Gemini TTS는 audio/L16 PCM을 반환)
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, channels: number = 1, bitsPerSample: number = 16): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.length
  const headerSize = 44
  const fileSize = headerSize + dataSize - 8

  const wavBuffer = Buffer.alloc(headerSize + dataSize)

  // RIFF header
  wavBuffer.write('RIFF', 0)
  wavBuffer.writeUInt32LE(fileSize, 4)
  wavBuffer.write('WAVE', 8)

  // fmt chunk
  wavBuffer.write('fmt ', 12)
  wavBuffer.writeUInt32LE(16, 16)
  wavBuffer.writeUInt16LE(1, 20)
  wavBuffer.writeUInt16LE(channels, 22)
  wavBuffer.writeUInt32LE(sampleRate, 24)
  wavBuffer.writeUInt32LE(byteRate, 28)
  wavBuffer.writeUInt16LE(blockAlign, 32)
  wavBuffer.writeUInt16LE(bitsPerSample, 34)

  // data chunk
  wavBuffer.write('data', 36)
  wavBuffer.writeUInt32LE(dataSize, 40)
  pcmBuffer.copy(wavBuffer, 44)

  return wavBuffer
}

/**
 * Gemini 2.5 Flash TTS로 음성 생성 (기존 @google/generative-ai 사용)
 */
async function generateGeminiTTS(text: string, voice: 'male' | 'female' = 'female'): Promise<string | undefined> {
  try {
    const client = getGeminiClient()
    const voiceName = voice === 'male' ? 'Puck' : 'Kore'
    console.log(`[TTS] Gemini 2.5 TTS 요청: ${text.slice(0, 50)}... (voice: ${voiceName})`)

    const ttsModel = client.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-tts',
    })

    const response = await ttsModel.generateContent({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      } as any
    })

    const audioData = response.response.candidates?.[0]?.content?.parts?.[0]
    if (audioData && 'inlineData' in audioData && audioData.inlineData?.data) {
      // Gemini TTS는 raw PCM 반환 → WAV로 변환
      const pcmBuffer = Buffer.from(audioData.inlineData.data, 'base64')
      const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16)
      const audioUrl = `data:audio/wav;base64,${wavBuffer.toString('base64')}`
      console.log(`[TTS] Gemini TTS 완료, WAV 크기: ${wavBuffer.length} bytes`)
      return audioUrl
    }

    console.error('[TTS] Gemini TTS: 오디오 데이터 없음')
    return undefined
  } catch (error) {
    console.error('[TTS] Gemini TTS 요청 실패:', error)
    return undefined
  }
}

interface Source {
  id: string
  type: 'pdf' | 'web' | 'youtube' | 'text' | 'image'
  title: string
  content?: string
  summary?: string
}

interface ImageSource {
  title: string
  imageDataUrl: string // base64 data URL
}

type GenerationType = 'briefing' | 'faq' | 'timeline' | 'study-guide' | 'deep-dive' | 'slides' | 'video-overview' | 'briefing-doc' | 'audio-overview' | 'mindmap' | 'report' | 'flashcard' | 'quiz' | 'infographic' | 'data-table'

const GENERATION_PROMPTS: Record<GenerationType, { systemPrompt: string; outputFormat: string }> = {
  'briefing': {
    systemPrompt: `당신은 전문 비즈니스 분석가입니다. 제공된 자료를 기반으로 전문적인 브리핑 문서를 작성합니다.`,
    outputFormat: `# 브리핑 문서

## 📋 요약 (Executive Summary)
[2-3문장으로 핵심 내용 요약]

## 🔑 핵심 포인트
1. [주요 발견사항 1]
2. [주요 발견사항 2]
3. [주요 발견사항 3]

## 📊 상세 분석
[자료의 주요 내용을 구조화하여 설명]

## 💡 시사점 및 권장사항
- [권장사항 1]
- [권장사항 2]
- [권장사항 3]

## 📝 추가 참고사항
[관련 컨텍스트나 배경 정보]`
  },
  'faq': {
    systemPrompt: `당신은 Q&A 전문가입니다. 제공된 자료를 기반으로 예상되는 질문과 명확한 답변을 생성합니다.`,
    outputFormat: `# 자주 묻는 질문 (FAQ)

**Q1. [질문]**
A: [답변]

**Q2. [질문]**
A: [답변]

**Q3. [질문]**
A: [답변]

**Q4. [질문]**
A: [답변]

**Q5. [질문]**
A: [답변]

**Q6. [질문]**
A: [답변]

**Q7. [질문]**
A: [답변]

**Q8. [질문]**
A: [답변]

**Q9. [질문]**
A: [답변]

**Q10. [질문]**
A: [답변]`
  },
  'timeline': {
    systemPrompt: `당신은 타임라인 분석 전문가입니다. 제공된 자료에서 시간순 이벤트와 단계를 추출하여 명확한 타임라인을 작성합니다.`,
    outputFormat: `# 타임라인

## 🕐 주요 이벤트/단계

### [시점/단계 1]
- **이벤트**: [설명]
- **영향/결과**: [설명]

### [시점/단계 2]
- **이벤트**: [설명]
- **영향/결과**: [설명]

### [시점/단계 3]
- **이벤트**: [설명]
- **영향/결과**: [설명]

## 📈 전체 흐름 요약
[전체적인 흐름과 패턴 설명]

## 🔮 향후 예상
[향후 진행 방향이나 예상 사항]`
  },
  'study-guide': {
    systemPrompt: `당신은 교육 콘텐츠 전문가입니다. 제공된 자료를 기반으로 효과적인 학습 가이드를 작성합니다.`,
    outputFormat: `# 학습 가이드

## 📚 학습 목표
이 가이드를 통해 배울 수 있는 내용:
1. [목표 1]
2. [목표 2]
3. [목표 3]

## 🔤 핵심 개념 및 용어
| 용어 | 설명 |
|------|------|
| [용어 1] | [설명] |
| [용어 2] | [설명] |
| [용어 3] | [설명] |

## 📖 주요 내용 정리

### 섹션 1: [제목]
[핵심 내용 설명]

### 섹션 2: [제목]
[핵심 내용 설명]

### 섹션 3: [제목]
[핵심 내용 설명]

## ✏️ 연습 문제
1. [문제 1]
2. [문제 2]
3. [문제 3]

## 💡 핵심 정리
- [핵심 포인트 1]
- [핵심 포인트 2]
- [핵심 포인트 3]

## 📎 추가 학습 자료
[관련 주제나 심화 학습을 위한 제안]`
  },
  'deep-dive': {
    systemPrompt: `당신은 심층 분석 전문가입니다. 제공된 자료를 깊이 분석하여 숨겨진 통찰, 패턴, 연결고리를 발견합니다.`,
    outputFormat: `# 심층 분석 (Deep Dive)

## 🔬 분석 개요
[분석 대상과 접근 방법 설명]

## 🧩 핵심 발견사항

### 발견 1: [제목]
- **관찰**: [무엇을 발견했는지]
- **의미**: [왜 중요한지]
- **영향**: [어떤 영향이 있는지]

### 발견 2: [제목]
- **관찰**: [무엇을 발견했는지]
- **의미**: [왜 중요한지]
- **영향**: [어떤 영향이 있는지]

## 🔗 패턴 및 연결고리
[데이터 간의 관계, 반복되는 패턴, 숨겨진 연결]

## 💎 숨겨진 통찰
1. [통찰 1]
2. [통찰 2]
3. [통찰 3]

## ⚡ 강점과 약점 분석
**강점:**
- [강점 1]
- [강점 2]

**약점/개선점:**
- [약점 1]
- [약점 2]

## 🎯 전략적 제안
[분석 결과를 기반으로 한 실행 가능한 제안]

## 📌 결론
[핵심 메시지와 다음 단계]`
  },
  'slides': {
    systemPrompt: `당신은 프레젠테이션 전문가입니다. 제공된 자료를 기반으로 효과적인 프레젠테이션 슬라이드 구조를 작성합니다.`,
    outputFormat: `# 프레젠테이션 슬라이드

## 슬라이드 1: 제목
**[프레젠테이션 제목]**
부제목: [핵심 메시지]

📝 발표자 노트: [오프닝 멘트]

---

## 슬라이드 2: 목차/개요
- 섹션 1: [제목]
- 섹션 2: [제목]
- 섹션 3: [제목]

📝 발표자 노트: [전체 흐름 설명]

---

## 슬라이드 3: [핵심 내용 1]
• 포인트 1
• 포인트 2
• 포인트 3

📝 발표자 노트: [상세 설명]

---

[10-15개 슬라이드 계속...]

---

## 마지막 슬라이드: 요약 및 결론
**핵심 메시지:**
1. [요약 1]
2. [요약 2]
3. [요약 3]

📝 발표자 노트: [마무리 멘트와 Q&A 안내]`
  },
  'video-overview': {
    systemPrompt: `당신은 NotebookLM 스타일의 오디오 개요 생성기입니다.
제공된 소스 자료를 분석하고, 슬라이드별 나레이션 대본을 작성합니다.

중요: 각 슬라이드는 [SLIDE:번호:제목] 형식으로 시작하고, 그 아래에 TTS가 읽을 나레이션 텍스트만 작성합니다.
TTS 텍스트에는 마크다운, 특수문자, 타임스탬프를 절대 넣지 마세요.`,
    outputFormat: `[SLIDE:1:오프닝]
오늘 살펴볼 자료는 [주제]에 관한 내용입니다. 이 자료가 왜 중요한지, 핵심이 뭔지 같이 알아보겠습니다.

[SLIDE:2:자료 소개]
먼저 이 자료의 배경을 간단히 설명드리면, [자료의 맥락과 배경 설명]입니다. [왜 이 자료가 만들어졌는지 설명]

[SLIDE:3:핵심 포인트 1]
첫 번째로 주목할 점은 [핵심 포인트 1]입니다. [구체적인 내용 설명] 이게 왜 중요하냐면, [분석과 해석]이기 때문입니다. 쉽게 말해서 [쉬운 비유나 예시]라고 생각하시면 됩니다.

[SLIDE:4:핵심 포인트 2]
두 번째로 중요한 건 [핵심 포인트 2]인데요. [구체적인 내용] 이 부분의 의미는 [시사점]입니다. 실제로 [적용 가능성이나 영향]을 생각해볼 수 있습니다.

[SLIDE:5:핵심 포인트 3]
세 번째는 [핵심 포인트 3]입니다. [상세 설명] 앞에서 말씀드린 내용과 연결해보면, [연결고리 설명]이 됩니다.

[SLIDE:6:분석 및 시사점]
이 내용들을 종합해보면, [전체적인 분석과 해석]입니다. 시사점은 [시사점 설명]입니다.

[SLIDE:7:정리]
정리하자면, 첫째 [요약 1], 둘째 [요약 2], 셋째 [요약 3]입니다. 이상으로 [주제] 분석을 마치겠습니다.

7-10개 슬라이드로 구성하고, 각 슬라이드별 나레이션은 자연스럽게 작성하세요.`
  },
  'briefing-doc': {
    systemPrompt: `당신은 전문 비즈니스 분석가입니다. 제공된 자료를 기반으로 전문적인 브리핑 문서를 작성합니다.`,
    outputFormat: `# 브리핑 문서

## 📋 요약 (Executive Summary)
[2-3문장으로 핵심 내용 요약]

## 🔑 핵심 포인트
1. [주요 발견사항 1]
2. [주요 발견사항 2]
3. [주요 발견사항 3]

## 📊 상세 분석
[자료의 주요 내용을 구조화하여 설명]

## 💡 시사점 및 권장사항
- [권장사항 1]
- [권장사항 2]
- [권장사항 3]

## 📝 추가 참고사항
[관련 컨텍스트나 배경 정보]`
  },
  'audio-overview': {
    systemPrompt: `당신은 전문 오디오 콘텐츠 크리에이터입니다. 제공된 자료를 분석하여 청취자가 쉽게 이해할 수 있는 오디오 스크립트를 작성합니다.`,
    outputFormat: `# 오디오 개요

## 🎙️ 오프닝 (30초)
[친근한 인사와 주제 소개]

## 📖 본문 (3-5분)
### 섹션 1: [핵심 주제]
[상세 설명 - 청취자가 듣기만 해도 이해할 수 있도록]

### 섹션 2: [세부 내용]
[예시와 비유를 활용한 설명]

### 섹션 3: [추가 정보]
[관련 맥락과 배경]

## 🎯 핵심 요약 (30초)
- 포인트 1
- 포인트 2
- 포인트 3

## 👋 마무리 (15초)
[감사 인사와 마무리]`
  },
  'mindmap': {
    systemPrompt: `당신은 시각적 사고 전문가입니다. 제공된 자료를 분석하여 체계적인 마인드맵 구조를 생성합니다. 중심 주제에서 가지가 뻗어나가는 형태로 정보를 조직화합니다.`,
    outputFormat: `# 마인드맵

## 🎯 중심 주제
**[핵심 주제]**

## 🌿 주요 가지 1: [카테고리명]
- 하위 항목 1.1
  - 세부 사항
  - 세부 사항
- 하위 항목 1.2
  - 세부 사항

## 🌿 주요 가지 2: [카테고리명]
- 하위 항목 2.1
  - 세부 사항
- 하위 항목 2.2
  - 세부 사항

## 🌿 주요 가지 3: [카테고리명]
- 하위 항목 3.1
- 하위 항목 3.2

## 🌿 주요 가지 4: [카테고리명]
- 하위 항목 4.1
- 하위 항목 4.2

## 🔗 연결 관계
- [가지 1] ↔ [가지 2]: 관계 설명
- [가지 2] → [가지 3]: 영향 관계`
  },
  'report': {
    systemPrompt: `당신은 전문 비즈니스 리포트 작성자입니다. 제공된 자료를 분석하여 체계적이고 전문적인 보고서를 작성합니다.`,
    outputFormat: `# 분석 보고서

## 📋 개요
**작성 목적**: [보고서 목적]
**분석 대상**: [분석 자료 요약]

## 🔍 현황 분석
### 주요 발견사항
1. [발견사항 1]
2. [발견사항 2]
3. [발견사항 3]

### 데이터 분석
- 핵심 지표 1: [수치/내용]
- 핵심 지표 2: [수치/내용]
- 핵심 지표 3: [수치/내용]

## 💡 인사이트
### 강점
- [강점 1]
- [강점 2]

### 개선 필요 영역
- [개선점 1]
- [개선점 2]

## 📊 결론 및 권장사항
### 결론
[종합적인 결론 2-3문장]

### 권장사항
1. **단기 (1-3개월)**: [권장사항]
2. **중기 (3-6개월)**: [권장사항]
3. **장기 (6개월+)**: [권장사항]

## 📎 부록
[추가 참고 자료 및 출처]`
  },
  'flashcard': {
    systemPrompt: `당신은 교육 콘텐츠 전문가입니다. 제공된 자료에서 핵심 개념을 추출하여 학습용 플래시카드를 생성합니다. 각 카드는 질문-답변 형식으로 기억하기 쉽게 작성합니다.`,
    outputFormat: `# 플래시카드 세트

## 카드 1
**Q**: [질문]
**A**: [답변]
📝 힌트: [기억 팁]

---

## 카드 2
**Q**: [질문]
**A**: [답변]
📝 힌트: [기억 팁]

---

## 카드 3
**Q**: [질문]
**A**: [답변]
📝 힌트: [기억 팁]

---

[10-20개 카드 계속...]

---

## 복습 요약
**핵심 개념 정리**:
1. [개념 1]
2. [개념 2]
3. [개념 3]`
  },
  'quiz': {
    systemPrompt: `당신은 교육 평가 전문가입니다. 제공된 자료를 기반으로 이해도를 점검할 수 있는 퀴즈 문제를 생성합니다. 다양한 유형의 문제를 포함합니다.`,
    outputFormat: `# 퀴즈

## 📝 객관식 문제

### 문제 1
[질문]
- A) [선택지]
- B) [선택지]
- C) [선택지]
- D) [선택지]

**정답**: [정답]
**해설**: [해설]

---

### 문제 2
[질문]
- A) [선택지]
- B) [선택지]
- C) [선택지]
- D) [선택지]

**정답**: [정답]
**해설**: [해설]

---

## ✍️ 단답형 문제

### 문제 3
[질문]

**정답**: [정답]
**해설**: [해설]

---

## 🤔 서술형 문제

### 문제 4
[질문]

**모범 답안**: [답안]
**채점 기준**: [기준]

---

## 📊 정답 및 해설
| 문제 | 정답 | 난이도 |
|------|------|--------|
| 1 | [정답] | ⭐ |
| 2 | [정답] | ⭐⭐ |
| 3 | [정답] | ⭐⭐ |
| 4 | [정답] | ⭐⭐⭐ |`
  },
  'infographic': {
    systemPrompt: `당신은 인포그래픽 디자인 전문가입니다. 제공된 자료를 시각적으로 표현하기 좋은 인포그래픽 구조로 변환합니다. 숫자, 통계, 비교, 프로세스를 시각화합니다.`,
    outputFormat: `# 인포그래픽

## 📌 헤드라인
**[핵심 메시지 - 한 문장으로]**

## 📊 핵심 통계
| 항목 | 수치 | 의미 |
|------|------|------|
| [항목1] | [수치] | [설명] |
| [항목2] | [수치] | [설명] |
| [항목3] | [수치] | [설명] |

## 🔄 프로세스/단계
1️⃣ **[단계 1]**: [설명]
   ⬇️
2️⃣ **[단계 2]**: [설명]
   ⬇️
3️⃣ **[단계 3]**: [설명]
   ⬇️
4️⃣ **[단계 4]**: [설명]

## ⚖️ 비교 분석
| 기준 | 항목 A | 항목 B |
|------|--------|--------|
| [기준1] | [값] | [값] |
| [기준2] | [값] | [값] |
| [기준3] | [값] | [값] |

## 🎯 핵심 포인트
✅ [포인트 1]
✅ [포인트 2]
✅ [포인트 3]

## 💡 결론
[시각적으로 기억할 핵심 메시지]`
  },
  'data-table': {
    systemPrompt: `당신은 데이터 분석 전문가입니다. 제공된 자료에서 구조화된 데이터를 추출하여 체계적인 표 형식으로 정리합니다.`,
    outputFormat: `# 데이터 표

## 📋 데이터 개요
**데이터 출처**: [출처]
**분석 기준**: [기준]
**데이터 기간**: [기간]

## 📊 주요 데이터 표

### 표 1: [표 제목]
| 항목 | 값 1 | 값 2 | 값 3 | 비고 |
|------|------|------|------|------|
| [항목1] | [값] | [값] | [값] | [설명] |
| [항목2] | [값] | [값] | [값] | [설명] |
| [항목3] | [값] | [값] | [값] | [설명] |
| **합계/평균** | [값] | [값] | [값] | - |

### 표 2: [표 제목]
| 카테고리 | 세부 항목 | 수치 | 비율 |
|----------|----------|------|------|
| [카테고리1] | [항목] | [수치] | [%] |
| [카테고리2] | [항목] | [수치] | [%] |
| [카테고리3] | [항목] | [수치] | [%] |

## 📈 데이터 요약
- **최대값**: [항목] - [값]
- **최소값**: [항목] - [값]
- **평균**: [값]
- **특이사항**: [설명]

## 💡 데이터 인사이트
1. [인사이트 1]
2. [인사이트 2]
3. [인사이트 3]`
  }
}

export async function POST(req: Request) {
  try {
    const { type, prompt, sources, images } = await req.json() as {
      type: GenerationType
      prompt: string
      sources: Source[]
      images?: ImageSource[] // video-overview에서 전달되는 이미지들
    }

    if (!type || !sources || sources.length === 0) {
      return NextResponse.json({ error: '타입과 소스가 필요합니다' }, { status: 400 })
    }

    const generationConfig = GENERATION_PROMPTS[type]
    if (!generationConfig) {
      return NextResponse.json({ error: '지원하지 않는 생성 타입입니다' }, { status: 400 })
    }

    // Build context from sources
    const sourceContext = sources.map((s, i) => {
      const content = s.content || s.summary || ''
      return `[소스 ${i + 1}: ${s.title}]\n타입: ${s.type}\n내용:\n${content.slice(0, 15000)}`
    }).join('\n\n---\n\n')

    // Use Gemini for content generation
    const client = getGeminiClient()
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    })

    // video-overview: 소스 분석 → 슬라이드 구조 생성 → 슬라이드별 대본 작성 → 크리에이터 TTS
    if (type === 'video-overview') {
      console.log(`[Generate] video-overview - 소스 기반 슬라이드 재구성 시작`)

      // ===== 1단계: 소스 자료 심층 분석 + 슬라이드 구조 생성 =====
      const slideStructurePrompt = `당신은 최고의 프레젠테이션 전략가입니다.
제공된 자료를 분석하여 유튜브 설명 영상에 적합한 슬라이드 구조를 설계하세요.

## 원본 자료
${sourceContext}

## 슬라이드 구조 설계 원칙
1. 자료의 핵심 메시지를 추출하여 논리적 흐름으로 재구성
2. 각 슬라이드는 하나의 핵심 포인트만 담음
3. 시청자가 쉽게 이해할 수 있는 순서로 배열
4. 8-12개 슬라이드 (오프닝, 본론 6-10개, 마무리)

## 출력 형식 (반드시 이 JSON 형식으로)
\`\`\`json
{
  "title": "영상 제목",
  "summary": "전체 요약 (1-2문장)",
  "slides": [
    {
      "slideNumber": 1,
      "slideTitle": "슬라이드 제목",
      "keyPoint": "이 슬라이드의 핵심 메시지 (1문장)",
      "details": ["세부 포인트 1", "세부 포인트 2", "세부 포인트 3"],
      "visualSuggestion": "이 슬라이드에 어울리는 시각자료 설명"
    }
  ]
}
\`\`\`

자료를 깊이 분석하고 슬라이드 구조를 생성하세요.`

      const slideStructureResult = await model.generateContent(slideStructurePrompt)
      const slideStructureText = await slideStructureResult.response.text()
      console.log(`[Generate] 슬라이드 구조 생성 완료`)

      // JSON 파싱
      let slideStructure: {
        title: string
        summary: string
        slides: Array<{
          slideNumber: number
          slideTitle: string
          keyPoint: string
          details: string[]
          visualSuggestion: string
        }>
      }

      try {
        // JSON 블록 추출
        const jsonMatch = slideStructureText.match(/```json\s*([\s\S]*?)\s*```/)
        const jsonText = jsonMatch ? jsonMatch[1] : slideStructureText
        slideStructure = JSON.parse(jsonText)
      } catch {
        console.error('[Generate] 슬라이드 구조 JSON 파싱 실패, 기본 구조 사용')
        slideStructure = {
          title: '자료 분석',
          summary: '소스 자료 기반 분석 영상',
          slides: [
            { slideNumber: 1, slideTitle: '오프닝', keyPoint: '오늘 주제 소개', details: [], visualSuggestion: '' },
            { slideNumber: 2, slideTitle: '핵심 내용', keyPoint: '주요 포인트', details: [], visualSuggestion: '' },
            { slideNumber: 3, slideTitle: '마무리', keyPoint: '요약 및 정리', details: [], visualSuggestion: '' }
          ]
        }
      }

      // ===== 2단계: 슬라이드별 크리에이터 대본 작성 =====
      const slidesForScript = slideStructure.slides.map(s =>
        `[슬라이드 ${s.slideNumber}: ${s.slideTitle}]
핵심: ${s.keyPoint}
세부: ${s.details.join(', ')}`
      ).join('\n\n')

      const creatorScriptPrompt = `당신은 인기 유튜브 크리에이터입니다. 시청자에게 친근하고 생동감 있게 설명하는 대본을 작성하세요.

[자료]
${slidesForScript}

${sourceContext.slice(0, 5000)}

[스타일 가이드]
1. 친근하고 자연스러운 말투 (뉴스 앵커처럼 딱딱하지 않게)
2. 중간중간 호흡과 리듬감: "자,", "그래서요,", "근데요,", "음..."
3. 감정 표현: "와 정말 신기하죠?", "이게 핵심인데요!", "대단하지 않나요?"
4. 청자와 소통하는 느낌: "여러분", "다들 아시죠?", "궁금하시죠?"

[예시]
"자, 오늘은 정말 흥미로운 주제를 가져왔는데요. 바로 인공지능에 대한 이야기입니다! 요즘 AI가 정말 핫하잖아요? 근데요, 그중에서도 LLM이라는 게 있는데, 이게 뭐냐면요... 쉽게 말해서 대화를 할 수 있는 AI예요. 신기하죠? 자, 그럼 좀 더 자세히 알아볼까요?"

[분량: ${process.env.NODE_ENV === 'development' ? '30초 정도' : '1분 30초 정도'}]

마크다운 기호 없이 순수 텍스트로 출력하세요.`

      const creatorScriptResult = await model.generateContent(creatorScriptPrompt)
      const creatorScriptRaw = await creatorScriptResult.response.text()

      // TTS용 대본: 마크다운 기호 제거
      const creatorScript = creatorScriptRaw
        .replace(/^#{1,6}\s+/gm, '')  // # 헤딩 제거
        .replace(/\*\*([^*]+)\*\*/g, '$1')  // **굵은글씨** → 굵은글씨
        .replace(/\*([^*]+)\*/g, '$1')  // *기울임* → 기울임
        .replace(/^[-*]\s+/gm, '')  // - 또는 * 리스트 마커 제거
        .replace(/^---+$/gm, '')  // --- 구분선 제거
        .replace(/`([^`]+)`/g, '$1')  // `코드` → 코드
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [링크](url) → 링크
        .replace(/\n{3,}/g, '\n\n')  // 연속 줄바꿈 정리
        .trim()

      console.log(`[Generate] 크리에이터 대본 생성 완료 (TTS용 정리됨)`)

      // ===== 3단계: TTS 생성 (Qwen3-TTS) =====
      let audioUrl: string | undefined

      if (creatorScript.length > 0) {
        // Gemini 2.5 Flash TTS 사용
        try {
          console.log(`[Generate] Gemini TTS 시작 (video-overview)...`)
          audioUrl = await generateGeminiTTS(creatorScript, 'female')
          if (audioUrl) {
            console.log(`[Generate] Gemini TTS 완료`)
          } else {
            console.error('[Generate] Gemini TTS returned undefined')
          }
        } catch (err) {
          console.error('[Generate] Gemini TTS error:', err)
        }
      }

      // 프론트엔드용 slides 형태로 변환 (모든 슬라이드) + 이미지 배치
      const slides = slideStructure.slides.map((s, idx) => {
        // 이미지가 있으면 슬라이드에 순차적으로 배치
        const slideImage = images && images[idx] ? images[idx].imageDataUrl : undefined

        return {
          number: s.slideNumber,
          title: s.slideTitle,
          narration: s.keyPoint,  // 각 슬라이드의 핵심 메시지
          bulletPoints: s.details.length > 0 ? s.details : [s.keyPoint],
          audioUrl: idx === 0 ? audioUrl : undefined,  // 첫 슬라이드에만 전체 오디오
          imageUrl: slideImage  // 이미지 소스에서 가져온 이미지
        }
      })

      // 화면 표시용 콘텐츠 (마크다운 기호 없이)
      const formattedContent = `${slideStructure.title}

${slideStructure.summary}

대본:
${creatorScriptRaw}`

      return NextResponse.json({
        success: true,
        content: formattedContent,
        type,
        slides,  // 프론트엔드에서 사용할 슬라이드 데이터
        script: creatorScriptRaw,
        audioUrl
      })
    }

    // audio-overview: 두 명이 대화하는 팟캐스트 형식 (민수 + 지은)
    if (type === 'audio-overview') {
      console.log(`[Generate] audio-overview - 2인 팟캐스트 대본 생성 시작`)

      const podcastScriptPrompt = `당신은 인기 팟캐스트 "테크 톡톡"의 대본 작가입니다.
두 명의 진행자가 대화하는 형식으로 대본을 작성하세요.

## 진행자
- 민수: 남성, 메인 진행자, 전문적이면서도 친근함
- 지은: 여성, 공동 진행자, 질문하고 리액션하며 청취자 대변

## 원본 자료
${sourceContext}

## 대본 형식 (반드시 이 형식으로)
[민수] 대사 내용
[지은] 대사 내용
[민수] 대사 내용
...

## 스타일 가이드
1. 자연스러운 대화체 (뉴스 앵커처럼 딱딱하지 않게)
2. 민수가 주로 설명하고, 지은이 질문하거나 리액션
3. 서로 호응하며 대화: "맞아요", "오 정말요?", "그렇구나"
4. 적절한 감탄사와 추임새 사용
5. 청취자가 듣기만 해도 이해할 수 있도록

## 구조
1. 오프닝 인사 (민수 시작, 지은 호응)
2. 주제 소개 및 본론 (번갈아가며 대화)
3. 핵심 포인트 정리
4. 마무리 인사

## 분량
총 10-15개 대사 (약 2분 분량)

마크다운 기호 없이 [민수] 또는 [지은]으로 시작하는 대사만 출력하세요.`

      const scriptResult = await model.generateContent(podcastScriptPrompt)
      const rawScript = await scriptResult.response.text()
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .trim()

      console.log(`[Generate] 팟캐스트 대본 생성 완료`)

      // 대사 파싱: [민수] 또는 [지은] 형식
      const dialogueRegex = /\[(민수|지은)\]\s*([^\[]+)/g
      const dialogues: Array<{ speaker: string; text: string; ttsVoice: 'male' | 'female' }> = []
      let match

      while ((match = dialogueRegex.exec(rawScript)) !== null) {
        const speaker = match[1]
        const text = match[2].trim()
        if (text.length > 0) {
          dialogues.push({
            speaker,
            text,
            ttsVoice: speaker === '민수' ? 'male' : 'female'  // 민수=남성, 지은=여성
          })
        }
      }

      console.log(`[Generate] 파싱된 대사 수: ${dialogues.length}`)

      // 각 대사별 TTS 생성 (병렬 처리)
      const audioSegments: Array<{ speaker: string; text: string; audioUrl?: string }> = []

      if (dialogues.length > 0) {
        console.log(`[Generate] Qwen3-TTS 시작 (${dialogues.length}개 대사)...`)

        const ttsPromises = dialogues.map(async (d, idx) => {
          try {
            const audioUrl = await generateGeminiTTS(d.text, d.ttsVoice)
            return { speaker: d.speaker, text: d.text, audioUrl }
          } catch (err) {
            console.error(`[Generate] TTS error for dialogue ${idx}:`, err)
            return { speaker: d.speaker, text: d.text, audioUrl: undefined }
          }
        })

        const results = await Promise.all(ttsPromises)
        audioSegments.push(...results)

        console.log(`[Generate] TTS 완료: ${audioSegments.filter(s => s.audioUrl).length}/${dialogues.length}`)
      }

      // 모든 오디오를 하나로 합치기 (Base64 WAV 연결)
      let combinedAudioUrl: string | undefined

      const validAudios = audioSegments.filter(s => s.audioUrl)
      if (validAudios.length > 0) {
        try {
          // 각 Base64 WAV에서 PCM 데이터 추출 후 합치기
          const pcmBuffers: Buffer[] = []

          for (const segment of validAudios) {
            if (segment.audioUrl) {
              // data:audio/wav;base64,... 에서 base64 부분 추출
              const base64Data = segment.audioUrl.replace(/^data:audio\/wav;base64,/, '')
              const wavBuffer = Buffer.from(base64Data, 'base64')

              // WAV 헤더(44바이트) 건너뛰고 PCM 데이터만 추출
              if (wavBuffer.length > 44) {
                const pcmData = wavBuffer.subarray(44)
                pcmBuffers.push(pcmData)

                // 대사 사이에 0.3초 무음 추가 (24000Hz * 2bytes * 0.3초 = 14400 bytes)
                const silenceBuffer = Buffer.alloc(14400, 0)
                pcmBuffers.push(silenceBuffer)
              }
            }
          }

          if (pcmBuffers.length > 0) {
            // 모든 PCM 데이터 합치기
            const combinedPcm = Buffer.concat(pcmBuffers)

            // WAV 헤더 생성
            const sampleRate = 24000
            const channels = 1
            const bitsPerSample = 16
            const byteRate = sampleRate * channels * (bitsPerSample / 8)
            const blockAlign = channels * (bitsPerSample / 8)
            const dataSize = combinedPcm.length
            const headerSize = 44
            const fileSize = headerSize + dataSize - 8

            const wavBuffer = Buffer.alloc(headerSize + dataSize)

            // RIFF header
            wavBuffer.write('RIFF', 0)
            wavBuffer.writeUInt32LE(fileSize, 4)
            wavBuffer.write('WAVE', 8)

            // fmt chunk
            wavBuffer.write('fmt ', 12)
            wavBuffer.writeUInt32LE(16, 16)
            wavBuffer.writeUInt16LE(1, 20)
            wavBuffer.writeUInt16LE(channels, 22)
            wavBuffer.writeUInt32LE(sampleRate, 24)
            wavBuffer.writeUInt32LE(byteRate, 28)
            wavBuffer.writeUInt16LE(blockAlign, 32)
            wavBuffer.writeUInt16LE(bitsPerSample, 34)

            // data chunk
            wavBuffer.write('data', 36)
            wavBuffer.writeUInt32LE(dataSize, 40)
            combinedPcm.copy(wavBuffer, 44)

            combinedAudioUrl = `data:audio/wav;base64,${wavBuffer.toString('base64')}`
            console.log(`[Generate] 오디오 합성 완료: ${wavBuffer.length} bytes`)
          }
        } catch (err) {
          console.error('[Generate] 오디오 합성 오류:', err)
        }
      }

      // 화면 표시용 대본 구성
      const formattedDialogue = audioSegments
        .map(s => `**${s.speaker}**: ${s.text}`)
        .join('\n\n')

      const displayContent = `# 🎧 오디오 개요 - 팟캐스트

## 진행자
- 🎙️ **민수** (메인 진행)
- 🎤 **지은** (공동 진행)

---

## 대본

${formattedDialogue}

---

${combinedAudioUrl ? '✅ 오디오가 생성되었습니다.' : '⚠️ 오디오 생성에 실패했습니다.'}`

      // dialogueLines 형식으로 변환 (프론트엔드 팟캐스트 UI용)
      const dialogueLines = audioSegments.map(s => ({
        speaker: s.speaker,
        text: s.text
      }))

      return NextResponse.json({
        success: true,
        content: displayContent,
        type,
        script: rawScript,
        audioUrl: combinedAudioUrl,
        dialogueLines  // 프론트엔드에서 팟캐스트 UI 렌더링용
      })
    }

    // 이미지가 없으면 기존 텍스트 기반 생성
    const fullPrompt = `${generationConfig.systemPrompt}

## 자료
${sourceContext}

## 요청
${prompt}

## 출력 형식
다음 형식에 맞춰 한국어로 작성해주세요:

${generationConfig.outputFormat}

위 형식을 참고하여 제공된 자료를 기반으로 내용을 작성해주세요. 자료에 없는 내용은 추측하지 말고, 자료에서 직접적으로 도출할 수 있는 내용만 포함해주세요.`

    const result = await model.generateContent(fullPrompt)
    const content = await result.response.text()

    return NextResponse.json({
      success: true,
      content,
      type
    })
  } catch (error) {
    console.error('Content generation error:', error)
    return NextResponse.json(
      { error: '콘텐츠 생성 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
