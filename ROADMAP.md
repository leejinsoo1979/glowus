# GlowUS 개발 로드맵

> 스타트업 운영 자동화 및 투자 매칭 플랫폼

## 완료된 개발 (Completed)

### Phase 1: 기반 구축 ✅
- [x] Next.js 14 프로젝트 설정 (App Router, TypeScript)
- [x] Supabase 연동 및 설정
- [x] 인증 시스템 구현 (로그인, 회원가입)
- [x] 기본 UI 컴포넌트 (Button, Card, Input, Modal)
- [x] 다크모드 테마 시스템

### Phase 2: 데이터베이스 스키마 ✅
- [x] `users` 테이블 (FOUNDER, TEAM_MEMBER, INVESTOR, ADMIN 역할)
- [x] `startups` 테이블 (스타트업 정보, 재무 지표)
- [x] `team_members` 테이블 (팀원 관리)
- [x] `tasks` 테이블 (태스크 관리, AI 분석)
- [x] `updates` 테이블 (스타트업 업데이트)
- [x] `investor_access` 테이블 (투자자 접근 권한)
- [x] `kpi_metrics` 테이블 (KPI 지표)
- [x] `commits` 테이블 (커밋 기록)
- [x] `teams` 테이블 (팀 관리)
- [x] TypeScript 타입 정의 완료

### Phase 3: API 구현 ✅
- [x] `/api/auth` - 인증 API
- [x] `/api/startups` - 스타트업 CRUD
- [x] `/api/startups/[id]` - 개별 스타트업 관리
- [x] `/api/tasks` - 태스크 CRUD
- [x] `/api/tasks/[id]` - 개별 태스크 관리
- [x] `/api/team-members` - 팀원 관리
- [x] `/api/teams` - 팀 CRUD
- [x] `/api/commits` - 커밋 기록
- [x] `/api/kpis` - KPI 지표 관리
- [x] `/api/dashboard` - 대시보드 메트릭스

### Phase 4: 대시보드 UI ✅
- [x] 메인 대시보드 (실시간 메트릭스)
- [x] 사이드바 네비게이션
- [x] 헤더 (사용자 정보, 알림)
- [x] 스타트업 관리 페이지
- [x] 태스크 관리 페이지 (필터링, 정렬)
- [x] KPI 관리 페이지 (차트, CRUD)
- [x] 팀 관리 페이지
- [x] 커밋 모달

### Phase 5: 다크모드 UI 통일 ✅
- [x] 전체 zinc-* 컬러 팔레트 적용
- [x] 카드 컴포넌트 다크모드
- [x] 폼 컴포넌트 다크모드
- [x] 모달 컴포넌트 다크모드
- [x] 태스크 카드 다크모드

### Phase 6: 랜딩 페이지 ✅
- [x] 히어로 섹션 (애니메이션)
- [x] 기능 소개 섹션
- [x] CTA 섹션
- [x] 반응형 디자인

---

## 진행 예정 (Planned)

### Phase 7: AI 기능 ✅
- [x] OpenAI GPT-4 연동
- [x] 태스크 자동 분석 및 요약
- [x] 커밋 인사이트 생성
- [x] 리스크 예측 알고리즘
- [x] AI 인사이트 대시보드
- [ ] 병목 현상 감지 (Phase 9로 이동)
- [ ] AI 추천 시스템 (Phase 9로 이동)

### Phase 8: 투자자 기능 ✅
- [x] 투자자 대시보드
- [x] 스타트업 탐색 페이지
- [x] 파이프라인 관리 (CRM)
- [x] 스타트업 접근 요청/승인
- [ ] 투자자-스타트업 매칭 알고리즘 (Phase 10으로 이동)

### Phase 9: 실시간 기능 ✅
- [x] Supabase Realtime 구독
- [x] 실시간 태스크 업데이트
- [x] 실시간 KPI 업데이트
- [x] 투자자 요청 실시간 알림
- [x] Presence (온라인 상태) 훅
- [x] 브로드캐스트 메시지 훅

### Phase 10: 리포트 및 분석 ✅
- [x] 주간/월간 리포트 생성
- [x] PDF 내보내기
- [x] 리포트 대시보드 페이지
- [ ] 커스텀 대시보드 위젯 (다음 단계)
- [ ] 고급 차트 및 시각화 (다음 단계)

### Phase 11: 통합 기능 ✅
- [x] GitHub 연동 서비스 (`lib/integrations/github.ts`)
- [x] Slack 연동 서비스 (`lib/integrations/slack.ts`)
- [x] 통합 설정 페이지 (`/dashboard-group/settings/integrations`)
- [x] 통합 API (`/api/integrations`)
- [ ] Google Calendar 연동 (다음 단계)
- [ ] 이메일 알림 시스템 (다음 단계)

### Phase 12: 최적화 및 배포
- [x] TypeScript 타입 검증 (0 errors)
- [ ] 성능 최적화
- [ ] SEO 최적화
- [ ] 에러 모니터링 (Sentry)
- [ ] 분석 도구 연동 (GA, Mixpanel)
- [ ] Vercel 프로덕션 배포

### Phase 13: 프로젝트 워크플로우 자동화
- [x] `project_tasks` 테이블 (다형적 할당 - 사람/에이전트)
- [x] `workflow_templates` 테이블 (기본 템플릿 5개)
- [x] 태스크 CRUD API (`/api/projects/[id]/tasks`)
- [x] 태스크 할당 API (`/api/projects/[id]/tasks/[taskId]/assign`)
- [x] AI 워크플로우 생성 API (`/api/projects/[id]/generate-workflow`)
- [x] 칸반 보드 UI (`TaskKanbanBoard`)
- [x] 태스크 할당 모달 (`TaskAssignModal`)
- [ ] 간트 차트 UI
- [ ] 에이전트 태스크 자동 실행

### Phase 14: 에이전트 음성 채팅 & 아바타
- [ ] 음성 입력 컴포넌트 (Web Speech API STT)
- [ ] TTS 재생 컴포넌트 (OpenAI TTS)
- [ ] 아바타 립싱크 애니메이션 (볼륨 기반)
- [ ] 채팅방 UI 통합 (텍스트/음성 모드 전환)
- [ ] 실시간 아바타 표정 애니메이션
- [ ] (선택) D-ID API 연동으로 고품질 립싱크

---

## 기술 스택

| 카테고리 | 기술 |
|---------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Styling | Tailwind CSS |
| State | Zustand + React Query |
| Animation | Framer Motion |
| AI | OpenAI GPT-4 Turbo |
| Deployment | Vercel |

---

## 변경 이력

### 2024-12-13
- **Phase 13: 프로젝트 워크플로우 자동화** 추가
  - 프로젝트 생성 시 에이전트 선택 제거 (태스크에서 할당하는 구조로 변경)
  - 칸반 보드, 태스크 할당 시스템 완료
- **Phase 14: 에이전트 음성 채팅 & 아바타** 로드맵 추가
  - 텍스트/음성 채팅 지원
  - 립싱크 아바타 애니메이션

### 2024-12-10 (Phase 7-11 완료)
- **Phase 7: AI 기능**
  - OpenAI GPT-4 Turbo 연동 (`lib/ai/`)
  - 태스크 분석 API (`/api/ai/analyze-task`)
  - 커밋 인사이트 API (`/api/ai/commit-insight`)
  - 리스크 예측 API (`/api/ai/risk-prediction`)
  - AI 인사이트 대시보드 (`/dashboard-group/insights`)
- **Phase 8: 투자자 기능**
  - 투자자 대시보드 (`/dashboard-group/investor`)
  - 스타트업 탐색 (`/dashboard-group/investor/explore`)
  - 파이프라인 CRM (`/dashboard-group/investor/pipeline`)
  - 투자자 API 라우트 (`/api/investor/*`)
- **Phase 9: 실시간 기능**
  - Supabase Realtime 훅 확장 (`hooks/useRealtime.ts`)
  - 태스크/KPI/투자자요청 실시간 구독
  - Presence 및 브로드캐스트 훅
- **Phase 10: 리포트 및 분석**
  - 리포트 API (`/api/reports`, `/api/reports/[id]`)
  - AI 기반 주간/월간 리포트 생성
  - PDF 내보내기 (브라우저 프린트 기능)
  - 리포트 대시보드 (`/dashboard-group/reports`)
  - DB 마이그레이션 (`002_reports_table.sql`)
- **Phase 11: 통합 기능**
  - GitHub 연동 서비스 (`lib/integrations/github.ts`)
  - Slack 연동 서비스 (`lib/integrations/slack.ts`)
  - 통합 설정 페이지 (`/dashboard-group/settings/integrations`)
  - 통합 API (`/api/integrations`)
  - DB 마이그레이션 (`003_integrations_table.sql`)
- **Google OAuth 설정 완료**
- TypeScript 타입 오류 전체 수정 (0 errors)
- Task 인터페이스 확장 (ai_summary, impact_score, due_date, completed_at 등)

### 2024-12-09
- Phase 2: 스타트업 관리 기능 완성
- API 라우트 구현 완료

### 2024-12-08
- Phase 1: 기반 구축 완료
- Supabase DB 스키마 생성
- 인증 시스템 구현
