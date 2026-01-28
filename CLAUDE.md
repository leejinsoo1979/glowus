# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GlowUS** is an Organizational AI Workforce OS - a platform that treats AI not as a simple productivity tool but as "digital employees" with responsibilities, permissions, and growth capabilities. This is a complex system combining an OS kernel, database schema, and workflow compiler - not a simple website.

### Core Architecture: 4-Engine System

1. **Agent Identity & Growth Engine** (`lib/memory/agent-os.ts`) - Agent personas, 5-layer memory (Private/Meeting/Team/Injected/Execution), relationship management, stats-based growth
2. **Skill OS & Marketplace** (`lib/ai/super-agent-tools.ts`) - 50+ tools (file ops, navigation, workflow, browser automation), LangChain DynamicStructuredTool pattern
3. **Workflow Compiler & Runtime** (`lib/ai/workflow-tools.ts`, `lib/workflow/`) - Planner → Compiler → Approval Gate → Runner → Reporter pipeline
4. **Governance & Trust Engine** - Agent scoring, audit logging, HITL approval gates ("Confirm Packets")

## Development Commands

```bash
# Development
npm run dev              # Next.js dev server on port 3000
npm run dev:turbo        # Turbo mode for faster builds
npm run dev:full         # Dev + Stagehand browser automation server
npm run dev:with-tts     # Dev + Qwen3-TTS Python server

# Electron Desktop App
npm run electron:dev     # Full Electron dev (Next.js + terminal + neural-map WS + stagehand servers)
npm run electron:dev:fast # Skip TypeScript compilation (use existing)
npm run electron:pack    # Build production Electron app

# Quality
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking (tsc --noEmit)
npm run test             # Jest tests
npm run test:watch       # Jest in watch mode

# Run a single test file
npx jest lib/path/to/__tests__/file.test.ts

# MCP Servers (run separately)
npm run mcp:neural-map-ws  # WebSocket server for Neural Map
npm run mcp:neural-map     # MCP server for Neural Map
npm run mcp:stagehand      # Stagehand browser automation server

# TTS Server (Python)
npm run tts:install        # Install Python TTS dependencies
npm run tts:server         # Start Qwen3-TTS server on port 8100
```

**Node.js Requirement**: v20.0.0 to v22.x (see `engines` in package.json)

## Key Architecture Patterns

### Directory Structure

```
app/
├── api/                  # Next.js API routes
├── auth-group/           # Authentication pages (login, signup)
├── dashboard-group/      # Main application pages
│   ├── agents/           # Agent chains management
│   ├── messenger/        # Team messaging
│   ├── neurons/          # My Neurons workspace
│   ├── apps/             # AI apps (docs, sheet, slides, summary)
│   └── settings/         # User settings, API keys, prompts
├── agent-builder/        # Agent creation (Genesis)

lib/
├── ai/                   # Super agent tools, workflow tools
├── agent/                # Agent executor, tools, prompts
├── memory/               # 5-layer memory system (private/team/meeting)
├── neural-map/           # Knowledge graph state & tools
├── langchain/            # LangChain/LangGraph integrations
├── llm/                  # LLM providers, model configs
├── supabase/             # Database client (admin/server/client)
├── mission-control/      # Agent pool, task scheduler (new)
├── my-neurons/           # Neurons sync service

components/
├── neural-map/           # 3D knowledge graph visualization
│   ├── canvas/           # Graph rendering (CosmicForceGraph, SchemaView, etc.)
│   ├── panels/           # File tree, properties, git, blueprint panels
│   └── coding/           # Agent chat, diff viewer, tool output
├── chat/                 # Chat UI components
├── task-hub/             # Kanban board, task management
├── my-neurons/           # Neurons canvas components

server/
├── terminal-server.js    # Terminal WebSocket server (node-pty)
├── neural-map-ws-server.js # Neural Map real-time sync
├── stagehand-server.js   # Browser automation server
├── mcp-*.js              # MCP server implementations
```

### State Management

- **Zustand stores** in `stores/` (auth, chat, team, theme, ui)
- **Neural Map store** in `lib/neural-map/store.ts` - complex graph state with immer
- **React Query** for server state (`@tanstack/react-query`)

### Database & Backend

- **Supabase** for PostgreSQL database, auth, and storage
- Database types in `types/database.ts` - regenerate with `npx supabase gen types typescript --local > types/database.ts`
- Admin client in `lib/supabase/admin.ts`, server client in `lib/supabase/server.ts`

### Agent System

The Super Agent (`lib/ai/super-agent-tools.ts`) provides tools for:
- File operations (create, read, write, edit)
- Project management (create project, list projects)
- Neural Editor control (create/update/delete nodes and edges)
- Flowchart control
- Blueprint/task management
- Agent Builder workflow control
- Browser automation via Stagehand
- Multi-step workflow execution

### Node-Based Workflow System

Based on `docs/NODE_BASED_AI_AGENT_ROADMAP.md`:
- **Phase → Epic → Node** 3-tier hierarchy
- **DAG-based dependencies** between nodes
- **Agent types**: PlannerAgent, UIAgent, DevAgent, QAAgent, DataAgent, ContentAgent, ResearchAgent
- **Automation levels**: full (auto), assisted (HITL), manual

## Tech Stack Essentials

- **Framework**: Next.js 14.2 with App Router, standalone output for Electron
- **Language**: TypeScript with strict mode, ES2022 target
- **UI**: React 18, Tailwind CSS, Radix UI primitives, Framer Motion
- **3D**: Three.js, React Three Fiber, force-graph libraries
- **AI/ML**: LangChain, LangGraph, AI SDK (Vercel), OpenAI, Google GenAI, Anthropic
- **Desktop**: Electron with node-pty for terminal
- **Browser Automation**: Playwright, Stagehand (Browserbase)

## Import Aliases

Use `@/*` for imports from project root:
```typescript
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import type { Task } from '@/types'
```

## Testing

Tests use Jest with ts-jest. Test files go in `lib/**/__tests__/*.test.ts`:
```bash
npm test                                    # Run all tests
npm run test:watch                          # Watch mode
npm run test:coverage                       # With coverage report
npx jest lib/memory/__tests__/agent.test.ts # Run single test file
npx jest --testNamePattern="memory"         # Run tests matching pattern
```

## Environment Setup

Copy `.env.example` to `.env.local`:

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` - Core AI features

**Optional LLM Providers:**
- `GOOGLE_GENERATIVE_AI_API_KEY` - Gemini models
- `DEEPSEEK_API_KEY` - Mission Control
- `GROQ_API_KEY` - Fast inference
- `TAVILY_API_KEY` - Web search

**Integrations:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google Drive/Calendar OAuth
- `TELEGRAM_BOT_TOKEN` - Telegram bot for remote agent control
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` - WhatsApp Business API

**Local Servers:**
- `QWEN_TTS_SERVER_URL=http://localhost:8100` - Qwen3-TTS (open source)

## Database

- **Supabase** PostgreSQL with Row Level Security
- Migrations in `supabase/migrations/`
- Regenerate types: `npx supabase gen types typescript --local > types/database.ts`

## Documentation Structure

The `docs/` folder contains detailed specifications:
- `Developguide.md` - System specification (4-core engines, schemas)
- `docs/neuramap/` - Neural Map (knowledge graph) subsystem specs
- `docs/NODE_BASED_AI_AGENT_ROADMAP.md` - Phase → Epic → Node hierarchy
- `docs/agent-memory-system-prd.md` - 5-layer memory architecture

## Key Patterns

### API Routes Organization
API routes follow RESTful patterns in `app/api/`:
- `/api/agents/[id]/...` - Agent CRUD, brain graph, memories
- `/api/chat/rooms/[roomId]/...` - Chat rooms, meetings
- `/api/projects/[id]/...` - Projects, tasks, roadmap nodes
- `/api/neural-map/[mapId]/...` - Knowledge graph operations

### Tool Definition Pattern
Tools in `lib/ai/super-agent-tools.ts` use LangChain's `DynamicStructuredTool`:
```typescript
new DynamicStructuredTool({
  name: 'tool_name',
  description: 'What this tool does',
  schema: z.object({ /* zod schema */ }),
  func: async (input) => { /* implementation */ }
})
```

## Role Clarification

You are the **Builder/Executor**. Implement features based on the specification in `Developguide.md`. When a user says "implement this", write code immediately.

**Source of Truth**: `Developguide.md` contains the complete system specification including the 4-core engines, Workflow Compiler, and Skill Registry schemas.
