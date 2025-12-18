# Repository Guidelines

## Project Structure & Module Organization
This is a Next.js 14 App Router project: auth flows sit in `app/auth-group`, dashboards in `app/dashboard-group`, and API handlers in `app/api/*/route.ts`. Feature and UI blocks live in `components/` (`components/ui`, `components/dashboard`, `components/commits`), while shared logic is grouped in `lib/` and `hooks/`. State is centralized in `stores/`, strict types stay under `types/`, and Supabase SQL plus seed assets live in `supabase/`. Planning docs (`docs/`, `ROADMAP.md`) and automation (`scripts/`, `ai-backend/`, `server/`) should only change when their owning squad approves.

## Build, Test, and Development Commands
- `npm run dev`: start the hot-reloading dev server on http://localhost:3000.
- `npm run build`: compile the production bundle and verify route metadata.
- `npm run start`: serve the built app for staging or Docker smoke tests.
- `npm run lint`: run `next lint` with the repo ESLint + Tailwind rules.
- `npm run typecheck`: execute `tsc --noEmit` to validate shared contracts.

## Coding Style & Naming Conventions
Write React components in TypeScript, 2-space indentation, and favor arrow functions plus hooks over classes. Use PascalCase for components (`AgentCard.tsx`), camelCase for hooks/utilities (`useInboxSync.ts`), and kebab-case folder names. Co-locate Tailwind classes with the JSX, keep Supabase helpers pure inside `lib/supabase/`, and only expose modules through explicit index files to avoid deep imports.

## Testing Guidelines
Current automated coverage is light (only `test_messenger.py` for the inbox agent), so every feature must add UI or integration tests beside the code (`components/foo/__tests__/` or `app/bar/page.test.tsx`). Always run `npm run lint && npm run typecheck` before pushing, and call out anything that remains untested in the PR template. Target 80%+ statements for dashboard panes, auth flows, and messaging surfaces; document lower coverage numbers with rationale.

## Commit & Pull Request Guidelines
Commits generally follow a Conventional Commit prefix (`fix:`, `style:`, `revert:`) and should scope to one feature, referencing Supabase migrations or config bumps explicitly. Pull requests need: a short summary, testing notes, `.env.local` variables touched (`NEXT_PUBLIC_SUPABASE_URL`, `OPENAI_API_KEY`, etc.), and screenshots for UI changes. Mention reviewers responsible for the touched module (`app/dashboard-group`, `ai-agent-builder`, `server/`) and state whether Supabase SQL was applied locally.

## Configuration & Security Tips
Copy `.env.example` to `.env.local`, filling the Supabase URL/keys plus any AI provider secrets before running `npm run dev`. Keep secrets and production URLs out of Git, prefer workspace-specific service roles, and keep experimental agents inside `ai-agent-builder/` until they are audited for production rollout.
