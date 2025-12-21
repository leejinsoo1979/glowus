# Repository Guidelines

## Project Structure & Module Organization
GlowUS는 Next.js 14 기반의 멀티 앱 구조다. 클라이언트 라우팅과 주요 화면은 `app/` 하위의 `dashboard-group/`, `agent-builder/`, `auth/` 도메인으로 나뉘며, 공유 UI는 `components/`에 모듈화되어 있다. 비즈니스 로직과 워크플로 엔진, 메모리 계층, 스킬 어댑터는 각각 `lib/engine`, `lib/memory`, `lib/skills`에서 관리한다. 서버 사이드 작업자는 `server/`·`ai-backend/`, 자동화 스크립트와 데이터 정리는 `scripts/`에 위치한다. 정적 자산과 Supabase 마이그레이션은 `public/`과 `supabase/`에 버전 관리된다.

## Build, Test, and Development Commands
Node 20.x를 설치한 뒤 `npm install`로 의존성을 구성한다. 로컬 개발은 `npm run dev`로 3000번 포트에서 기동하며, 배포 전 검증은 `npm run build` 후 `npm run start`로 프로덕션 모드 실행해 본다. 타입 안정성은 `npm run typecheck`, 스타일·접근성 규칙은 `npm run lint`로 확인한다. 데이터 수선이나 메모리 마이그레이션은 `node scripts/run-migration-101.js`처럼 스크립트를 개별 실행하되 필요한 `.env.local` 항목을 먼저 로드한다.

## Coding Style & Naming Conventions
TypeScript + React Server Component 조합을 기본으로, 필요 시 Client Component에 `"use client"` 프라그마를 명시한다. 들여쓰기는 2스페이스, 문자열은 단일 인용부호, 콜백은 화살표 함수로 통일한다. 컴포넌트는 PascalCase, 훅은 `useCamelCase`, Zustand 스토어는 `createXStore` 패턴을 따른다. Tailwind 유틸 조합이 길어지면 `app/globals.css`에 추상화하고, `npm run lint -- --fix`로 ESLint와 Tailwind 플러그인 정렬을 유지한다.

## Testing Guidelines
현재 전용 테스트 러너는 도입되지 않았으므로 린트·타입체크·수동 시나리오 테스트를 필수 단계로 삼는다. 주요 회귀 포인트는 `app/dashboard-group`의 워크보드/인박스, `app/agent-builder`의 에이전트 생성과 스킬 선언 흐름이다. `lib/engine`이나 `lib/memory`에 순수 함수 로직을 추가할 때는 JSDoc과 간단한 assertion helper를 제공해 리뷰어가 케이스를 재현할 수 있게 한다. 버그 픽스 시 PR 본문에 재현 절차와 기대 결과를 한국어로 기록한다.

## Commit & Pull Request Guidelines
Git 기록은 `type: 내용` 포맷을 유지한다. 예) `fix: cosmic 뷰 파티클 복원`, `feat: 트리 패널 토글 동기화`. 한 커밋에는 하나의 논리 변경만 담고, 새 마이그레이션이나 산출물이 포함되면 같은 커밋 메시지에 명시한다. PR은 문제 배경, 해결 전략, 수동 테스트 로그(`npm run dev`, 화면 캡처 링크 등), 관련 이슈 태그를 포함해야 한다. 스키마나 환경변수 변경이 있다면 체크리스트 항목으로 분리해 승인자에게 리스크를 명확히 알린다.

## Security & Configuration Tips
`.env.example`을 복사해 `.env.local`을 만들고 Supabase 키, OAuth 클라이언트, 모델 API 토큰을 채운다. 민감 키는 Vercel/KMS에만 저장하고 저장소에 노출하지 않는다. `server/`나 `ai-backend/`에서 외부 호출을 다룰 때 Governance/HITL 훅을 연결해 승인 없이 임의 실행되지 않게 한다. 데모나 테스트 계정을 배포 전에 정리하고, 로그에 남는 사용자 데이터는 GDPR 지침에 맞춰 마스킹한다.
