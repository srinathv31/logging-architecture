# AI Skills

AI Skills are curated rule sets that teach AI coding assistants (Claude Code, Cursor, Copilot, etc.) the patterns, conventions, and architecture of the Event Log Platform.

## The Problem

AI assistants generate code based on general training data. They don't know your project's conventions — which ORM you use, how routes are structured, what error handling looks like, or how tests are organized. The result is generic code that needs heavy manual correction.

## The Solution

Skills bridge this gap. Each skill is a set of markdown rules that get loaded into the AI's context window, giving it project-specific knowledge. Instead of guessing, the AI follows your exact patterns.

```mermaid
flowchart LR
    A[Developer prompts AI] --> B[AI loads relevant skills]
    B --> C[Skills provide rules & patterns]
    C --> D[AI generates correct code]
    D --> E[Code follows project conventions]
```

## Skill Types

| Type | Purpose | Example |
|------|---------|---------|
| **Project-Specific Knowledge** | Teaches patterns unique to this codebase | `event-log-api` — Fastify route structure, service layer, error handling |
| **General-Purpose Knowledge** | Teaches library/framework best practices | `drizzle-core` — Schema definitions, relations, constraints |
| **Task / Scaffold** | Walks through creating something step-by-step | `new-api-endpoint` — Scaffolds schema, service, route, registration |

## Skills Summary

| Skill | Type | Rules | Technologies | Catalog Link |
|-------|------|------:|--------------|--------------|
| `event-log-api` | Project-Specific | 19 | Fastify, Zod, Drizzle, Vitest | [View](/ai-skills/catalog#event-log-api) |
| `event-log-java-sdk` | Project-Specific | 16 | Spring Boot, Java, OAuth | [View](/ai-skills/catalog#event-log-java-sdk) |
| `drizzle-core` | General-Purpose | 9 | Drizzle ORM, TypeScript | [View](/ai-skills/catalog#drizzle-core) |
| `drizzle-mssql` | General-Purpose | 10 | Drizzle ORM, SQL Server | [View](/ai-skills/catalog#drizzle-mssql) |
| `shadcn-ui` | General-Purpose | 19 | shadcn/ui, React, Radix | [View](/ai-skills/catalog#shadcn-ui) |
| `typescript-type-safety` | General-Purpose | 10 | TypeScript | [View](/ai-skills/catalog#typescript-type-safety) |
| `new-api-endpoint` | Task / Scaffold | — | Fastify, Zod, Drizzle | [View](/ai-skills/catalog#new-api-endpoint) |
| `new-api-test` | Task / Scaffold | — | Vitest, Fastify | [View](/ai-skills/catalog#new-api-test) |
| `configure-java-sdk` | Task / Scaffold | — | Spring Boot, Maven/Gradle | [View](/ai-skills/catalog#configure-java-sdk) |

**Total: 9 skills, 83 rules**

## Installation

Skills live in the `.claude/skills/` directory at the repository root. There is nothing to install — any AI tool that reads project context will pick them up automatically.

```
.claude/skills/
├── event-log-api/
│   ├── SKILL.md
│   ├── AGENTS.md
│   └── rules/
│       ├── route-definition.md
│       ├── schema-zod-validation.md
│       └── ... (19 rules)
├── drizzle-core/
│   ├── SKILL.md
│   ├── AGENTS.md
│   └── rules/
│       └── ... (9 rules)
├── new-api-endpoint/
│   └── SKILL.md
└── ...
```

## File Roles

Each skill directory can contain up to three types of files:

| File | Purpose |
|------|---------|
| `SKILL.md` | **Overview** — human-readable description, trigger conditions, and metadata. Present in every skill. |
| `AGENTS.md` | **Full AI guide** — comprehensive reference with all rules expanded inline. Used by AI assistants that load a single file for context. Present in reference skills. |
| `rules/*.md` | **Individual rules** — one file per rule with a focused pattern, examples, and priority. Present in reference skills. |

::: tip How AI Tools Use Skills
- **Claude Code** reads `SKILL.md` to decide when a skill is relevant, then loads `AGENTS.md` or individual rules as needed.
- **Task / Scaffold** skills have all their instructions in `SKILL.md` — they guide the AI through a multi-step workflow rather than providing reference rules.
:::
