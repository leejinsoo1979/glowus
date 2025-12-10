# StartupShow - AI Development Guide

## Project Overview
**StartupShow**: 스타트업 운영 자동화 및 투자 매칭 플랫폼

### Core Philosophy
> "자기 관리가 곧 자기 홍보가 된다" (Self-Management to Self-PR)

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL + pgvector)
- **Auth**: Supabase Auth (JWT)
- **Realtime**: Supabase Realtime
- **AI**: LangChain + OpenAI GPT-4
- **Styling**: Tailwind CSS
- **State**: Zustand (client) + React Query (server)
- **Deployment**: Vercel

### Key Features
1. 스타트업 경영지원 (KPI Dashboard, Team Management, Goal Tracking)
2. 커밋 기반 업무 기록 시스템 (GitHub-style work commits)
3. AI 분석 (실시간 요약, 병목 예측, 리스크 분석)
4. 투자자 매칭 (탐색, 필터, AI 추천, 파이프라인 CRM)

---

## Directory Structure

```
startupshow/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth pages (login, signup)
│   ├── (dashboard)/              # Dashboard pages
│   │   ├── team/[teamId]/        # Team-specific pages
│   │   └── project/[projectId]/  # Project pages
│   ├── (investor)/               # Investor-only pages
│   └── api/                      # API Routes
├── components/
│   ├── ui/                       # Base UI (Button, Input, Modal, Card)
│   ├── dashboard/                # KPI widgets, summary panels
│   ├── tasks/                    # TaskList, TaskCard
│   ├── board/                    # KanbanBoard, SprintBoard
│   ├── gantt/                    # GanttChart
│   ├── commits/                  # CommitForm, CommitTimeline
│   ├── ai/                       # AIInsightPanel
│   └── investor/                 # StartupCard, PipelineBoard
├── lib/
│   ├── supabase/                 # Supabase client setup
│   ├── langchain/                # AI chains and prompts
│   └── utils/                    # Helpers
├── hooks/                        # Custom React hooks
├── stores/                       # Zustand stores
├── types/                        # TypeScript definitions
└── supabase/
    └── migrations/               # DB migrations
```

---

## Key Patterns

### 1. Supabase Client

**Browser (Client Components)**
```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

**Server (Server Components / API Routes)**
```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createClient = () => {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set(name, value, options),
        remove: (name, options) => cookieStore.set(name, '', options),
      },
    }
  )
}
```

### 2. API Route Pattern

```typescript
// app/api/teams/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { data, error } = await supabase
    .from('teams')
    .select('*, team_members!inner(*)')
    .eq('team_members.user_id', user.id)
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const body = await request.json()
  // validation...
  
  const { data, error } = await supabase
    .from('teams')
    .insert({ ...body, founder_id: user.id })
    .select()
    .single()
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  return NextResponse.json(data, { status: 201 })
}
```

### 3. Component Pattern

**Server Component (default)**
```typescript
// app/(dashboard)/team/[teamId]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { KPIDashboard } from '@/components/dashboard/KPIDashboard'

export default async function TeamDashboard({ params }: { params: { teamId: string } }) {
  const supabase = createClient()
  const { data: team } = await supabase
    .from('teams')
    .select('*, projects(*), team_members(*)')
    .eq('id', params.teamId)
    .single()
  
  return <KPIDashboard team={team} />
}
```

**Client Component (interactivity needed)**
```typescript
// components/tasks/TaskCard.tsx
'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface TaskCardProps {
  task: Task
}

export function TaskCard({ task }: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const queryClient = useQueryClient()
  
  const updateTask = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
  
  // ... render
}
```

### 4. Realtime Subscription

```typescript
// hooks/useRealtime.ts
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'

export function useRealtimeTasks(projectId: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId, queryClient, supabase])
}
```

### 5. AI Integration (LangChain)

```typescript
// lib/langchain/chains.ts
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'

const model = new ChatOpenAI({
  modelName: 'gpt-4',
  temperature: 0.3,
})

const commitAnalysisPrompt = PromptTemplate.fromTemplate(`
당신은 스타트업 프로젝트 분석 전문가입니다.
다음 업무 커밋 내용을 분석하고 요약해주세요.

커밋 내용: {commitDescription}
관련 태스크: {taskTitle}
프로젝트 컨텍스트: {projectContext}

다음 형식으로 응답하세요:
1. 요약 (1-2문장)
2. 영향도 분석
3. 다음 추천 액션
`)

export async function analyzeCommit(commit: Commit, context: string) {
  const chain = commitAnalysisPrompt.pipe(model)
  const result = await chain.invoke({
    commitDescription: commit.description,
    taskTitle: commit.task?.title || '',
    projectContext: context,
  })
  return result.content
}
```

---

## Database Schema (Core Tables)

```sql
-- Users (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('founder', 'member', 'vc')),
  avatar_url TEXT,
  company TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  founder_id UUID REFERENCES public.users(id),
  work_style TEXT NOT NULL CHECK (work_style IN ('agile', 'waterfall')),
  team_size INTEGER,
  business_type TEXT,
  description TEXT,
  logo_url TEXT,
  is_open_call BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team Members
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  team_id UUID REFERENCES public.teams(id),
  role TEXT NOT NULL CHECK (role IN ('founder', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, team_id)
);

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  deadline DATE,
  risk_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date DATE,
  end_date DATE,
  estimated_hours DECIMAL,
  actual_hours DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commits
CREATE TABLE public.commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  task_id UUID REFERENCES public.tasks(id),
  description TEXT NOT NULL,
  impact_level TEXT CHECK (impact_level IN ('low', 'medium', 'high')),
  next_action TEXT,
  files JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VC Requests
CREATE TABLE public.vc_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id),
  vc_user_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Summaries
CREATE TABLE public.summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id),
  content TEXT NOT NULL,
  type TEXT CHECK (type IN ('daily', 'weekly', 'monthly', 'commit')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Coding Standards

### DO ✅
- Use TypeScript strict mode
- Prefer Server Components (no 'use client' unless needed)
- Use React Query for server state
- Use Zustand for client-only state
- Error handling with try/catch and proper error responses
- Loading states with Suspense
- Semantic HTML and accessibility
- Tailwind utility classes (no inline styles)

### DON'T ❌
- Don't use class components
- Don't use default exports for components (use named exports)
- Don't fetch data in useEffect (use Server Components or React Query)
- Don't store server data in Zustand
- Don't use `any` type
- Don't skip error handling

---

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Lint
npm run lint

# Type check
npm run typecheck

# Supabase
npx supabase db push        # Push migrations
npx supabase gen types ts   # Generate TypeScript types
```

---

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxx...
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Related Documentation
- `FRONTEND.md` - UI component guidelines
- `AI.md` - Prompt engineering rules
- `supabase/migrations/` - Database schema history
