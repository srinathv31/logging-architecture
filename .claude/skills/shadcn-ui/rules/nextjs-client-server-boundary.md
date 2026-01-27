---
title: Client/Server Component Boundaries
impact: HIGH
impactDescription: ensures proper component rendering in Next.js App Router
tags: shadcn, nextjs, use-client, server-components, app-router
---

## Client/Server Component Boundaries

Most shadcn/ui components require the "use client" directive because they use React hooks or browser APIs. Understand when to add it.

**Incorrect (missing "use client"):**

```tsx
// DON'T DO THIS - Dialog uses hooks internally
// app/settings/page.tsx (Server Component by default)

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  return (
    <Dialog>  {/* Error: hooks can only be called in Client Components */}
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>Settings</DialogContent>
    </Dialog>
  )
}
```

**Correct (with "use client"):**

```tsx
// Option 1: Make the whole page a Client Component
// app/settings/page.tsx
"use client"

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export default function SettingsPage() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>Settings</DialogContent>
    </Dialog>
  )
}
```

```tsx
// Option 2: Extract interactive part to Client Component (preferred)
// components/settings-dialog.tsx
"use client"

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function SettingsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open</Button>
      </DialogTrigger>
      <DialogContent>Settings</DialogContent>
    </Dialog>
  )
}

// app/settings/page.tsx (remains Server Component)
import { SettingsDialog } from "@/components/settings-dialog"

export default function SettingsPage() {
  // Can do server-side data fetching here
  return (
    <div>
      <h1>Settings</h1>
      <SettingsDialog />
    </div>
  )
}
```

**Components that require "use client":**

| Component | Reason |
|-----------|--------|
| Dialog, AlertDialog, Sheet | Uses state for open/close |
| DropdownMenu, ContextMenu | Uses state and event handlers |
| Select, Combobox | Uses state for selection |
| Tabs | Uses state for active tab |
| Form (with react-hook-form) | Uses hooks |
| Toast/Sonner | Uses context and state |
| Popover, Tooltip | Uses state for visibility |
| Accordion, Collapsible | Uses state for expand/collapse |
| Checkbox, Switch, RadioGroup | Uses state for checked |

**Components that work in Server Components:**

| Component | Note |
|-----------|------|
| Button | Unless using onClick |
| Card, CardHeader, etc. | Static display only |
| Badge | Static display |
| Separator | Static display |
| Table (static) | Without TanStack Table |
| Avatar | Static display |
| Skeleton | Static display |

**Pattern: Server Component with Client Islands:**

```tsx
// app/dashboard/page.tsx (Server Component)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { InteractiveChart } from "@/components/interactive-chart"
import { DataTableClient } from "@/components/data-table-client"

async function getData() {
  // Server-side data fetching
  return await db.query.users.findMany()
}

export default async function DashboardPage() {
  const data = await getData()

  return (
    <div className="grid gap-4">
      {/* Static Card - Server Component */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Total users: {data.length}</p>
        </CardContent>
      </Card>

      {/* Interactive Chart - Client Component */}
      <InteractiveChart data={data} />

      {/* Interactive Table - Client Component */}
      <DataTableClient data={data} />
    </div>
  )
}
```

**Guidelines:**

- Default to Server Components, add "use client" only when needed
- Extract interactive parts into separate Client Components
- Pass serializable data as props from Server to Client Components
- Keep "use client" boundary as low in the tree as possible
- Static display components (Card, Badge) work without "use client"
