# StartupShow

스타트업과 투자자를 연결하는 통합 플랫폼. 업무 관리부터 투자 유치까지.

## 🚀 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 `.env.local`로 복사하고 값을 채워주세요:

```bash
cp .env.example .env.local
```

필요한 환경 변수:
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (서버 사이드용)
- `OPENAI_API_KEY`: OpenAI API 키 (AI 기능용)

### 3. Supabase 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 `supabase_migration.sql` 실행
3. Authentication > Providers에서 이메일 인증 활성화
4. 프로젝트 설정에서 URL과 API 키 복사

### 4. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인

## 📁 프로젝트 구조

```
startupshow/
├── app/                    # Next.js App Router
│   ├── auth-group/        # 인증 페이지 (로그인, 회원가입)
│   ├── dashboard-group/   # 대시보드 페이지
│   └── api/               # API Routes
├── components/
│   ├── ui/                # 기본 UI 컴포넌트
│   ├── nav/               # 네비게이션 컴포넌트
│   ├── commits/           # 커밋 관련 컴포넌트
│   └── dashboard/         # 대시보드 컴포넌트
├── lib/
│   ├── supabase/          # Supabase 클라이언트
│   └── utils/             # 유틸리티 함수
├── hooks/                 # Custom React Hooks
├── stores/                # Zustand 상태 관리
└── types/                 # TypeScript 타입 정의
```

## 🛠 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **State**: Zustand, React Query
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **AI**: LangChain, OpenAI GPT-4 (추후 구현)

## 📋 주요 기능

### 스타트업 (창업자)
- ✅ 팀 대시보드 및 KPI 모니터링
- ✅ 커밋 기반 업무 기록
- 🔄 프로젝트/태스크 관리 (칸반, 간트)
- 🔄 AI 인사이트 및 위험 예측
- 🔄 투자자 공개 프로필

### 투자자 (VC)
- 🔄 스타트업 탐색 및 필터링
- 🔄 투자 파이프라인 관리
- 🔄 AI 기반 스타트업 추천

## 🔜 다음 단계

1. **Phase 2**: 프로젝트/태스크 CRUD, 칸반 보드, 간트 차트
2. **Phase 3**: AI 분석, 투자자 대시보드
3. **Phase 4**: 알림, 성능 최적화, 배포

## 📄 라이선스

MIT License
