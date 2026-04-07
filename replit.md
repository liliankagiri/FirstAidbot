# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (`gpt-5.2`)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### ResQ (artifacts/resq)
- **Kind**: react-vite web app
- **Preview path**: `/`
- **Purpose**: WhatsApp-style first aid chatbot using NLP (GPT-5.2) to provide real-time step-by-step first aid guidance
- **Features**:
  - Natural language understanding via GPT-5.2
  - Emergency severity classification (low/moderate/high/critical)
  - Step-by-step numbered first aid instructions
  - Location-aware emergency referrals (nearby hospital cards)
  - Emergency services banner for critical situations
  - Quick suggestion chips for common emergencies
  - WhatsApp-style chat UI with typing indicators
  - Geolocation support for hospital referrals

### API Server (artifacts/api-server)
- **Routes**: `/api/chat/message`, `/api/hospitals/nearby`, `/api/healthz`
- **AI**: OpenAI integration via `@workspace/integrations-openai-ai-server`
