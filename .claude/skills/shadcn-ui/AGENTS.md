# Shadcn/UI Patterns for Next.js - Complete Guide

> This document is mainly for agents and LLMs. For the overview and quick reference, see `SKILL.md`.

## Abstract

This guide provides comprehensive patterns for using shadcn/ui with Next.js App Router. The primary goal is to guide AI agents to **use the shadcn CLI** instead of recreating components, and to **compose from existing primitives** instead of building from scratch.

## Table of Contents

1. [CLI: Install Components](#1-cli-install-components)
2. [CLI: Project Initialization](#2-cli-project-initialization)
3. [Compose from Primitives](#3-compose-from-primitives)
4. [Compound Component Patterns](#4-compound-component-patterns)
5. [Form Integration](#5-form-integration)
6. [Data Tables](#6-data-tables)
7. [Charts](#7-charts)
8. [Styling with cn()](#8-styling-with-cn)
9. [Client/Server Boundaries](#9-clientserver-boundaries)
10. [Accessibility](#10-accessibility)
11. [Extension Patterns](#11-extension-patterns)

---

## 1. CLI: Install Components

**Impact: CRITICAL** - prevents recreation of existing primitives

ALWAYS use `npx shadcn@latest add <component>` instead of manually writing shadcn components.

**Incorrect:**
```tsx
// DON'T recreate what shadcn provides
export function Button({ children, variant = "default" }) {
  const variants = { default: "bg-primary text-primary-foreground" };
  return <button className={variants[variant]}>{children}</button>;
}
```

**Correct:**
```bash
npx shadcn@latest add button
```
```tsx
import { Button } from "@/components/ui/button"
<Button variant="default">Click me</Button>
```

**Common components:** button, card, dialog, dropdown-menu, form, input, select, table, tabs, sonner, checkbox, radio-group, switch, textarea, sheet, alert-dialog, popover, tooltip, avatar, badge, skeleton

---

## 2. CLI: Project Initialization

**Impact: HIGH** - ensures proper foundation

```bash
npx shadcn@latest init
```

This generates:
- `components.json` - configuration
- `lib/utils.ts` - cn() utility
- CSS variables in `globals.css`

---

## 3. Compose from Primitives

**Impact: CRITICAL** - build custom UI from existing components

**Incorrect (custom modal):**
```tsx
function Modal({ open }) {
  if (!open) return null;
  return <div className="fixed inset-0 bg-black/50">...</div>;
}
```

**Correct (compose from AlertDialog):**
```tsx
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

function ConfirmDialog({ trigger, title, description, onConfirm }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Composition patterns:** Confirmation modal (AlertDialog + Button), Settings panel (Sheet + Form), Data table with actions (Table + DropdownMenu), User menu (DropdownMenu + Avatar)

---

## 4. Compound Component Patterns

**Impact: HIGH** - use the Radix compound component API correctly

**Incorrect:**
```tsx
<Dialog title="Hello" content="World" />  // Won't work
```

**Correct:**
```tsx
<Dialog>
  <DialogTrigger asChild><Button>Open</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Hello</DialogTitle>
      <DialogDescription>World</DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

Use `asChild` when wrapping custom elements as triggers:
```tsx
<DropdownMenuTrigger asChild>
  <button className="custom">Open</button>
</DropdownMenuTrigger>
```

---

## 5. Form Integration

**Impact: HIGH** - react-hook-form + Zod + shadcn Form

```bash
npm install react-hook-form @hookform/resolvers zod
npx shadcn@latest add form input
```

```tsx
"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
})

function MyForm() {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", name: "" } })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(console.log)}>
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

**Key patterns:**
- Checkbox/Switch: use `checked` and `onCheckedChange`
- Select: use `onValueChange`
- Always wrap in FormField > FormItem > FormControl

---

## 6. Data Tables

**Impact: HIGH** - use TanStack Table with shadcn Table

```bash
npm install @tanstack/react-table
npx shadcn@latest add table
```

**columns.tsx:**
```tsx
"use client"
import { ColumnDef } from "@tanstack/react-table"

export const columns: ColumnDef<User>[] = [
  { accessorKey: "email", header: "Email" },
  { accessorKey: "name", header: "Name" },
]
```

**data-table.tsx:**
```tsx
"use client"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function DataTable({ columns, data }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() })
  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(hg => (
          <TableRow key={hg.id}>
            {hg.headers.map(h => <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map(cell => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**Features:** Add getSortedRowModel, getFilteredRowModel, getPaginationRowModel as needed.

---

## 7. Charts

**Impact: HIGH** - use ChartContainer with Recharts

```bash
npx shadcn@latest add chart
```

**Incorrect:**
```tsx
<BarChart width={400} height={300} data={data}>...</BarChart>  // Missing wrapper
```

**Correct:**
```tsx
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis } from "recharts"

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
} satisfies ChartConfig

<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  <BarChart data={data}>
    <XAxis dataKey="month" />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" />
  </BarChart>
</ChartContainer>
```

**Key rules:**
- Always set `min-h-[VALUE]` on ChartContainer
- Use CSS variables for colors (var(--chart-1) through var(--chart-5))
- Reference colors as `var(--color-{configKey})`

---

## 8. Styling with cn()

**Impact: HIGH** - proper class merging

**Incorrect:**
```tsx
className={`base ${variant === "primary" ? "bg-blue-500" : ""} ${className}`}
```

**Correct:**
```tsx
import { cn } from "@/lib/utils"
className={cn("base", variant === "primary" && "bg-blue-500", className)}
```

The cn() utility (clsx + tailwind-merge) properly resolves Tailwind class conflicts.

**CSS Variables:** Use semantic colors like `bg-background`, `text-foreground`, `bg-primary` instead of hardcoded values.

---

## 9. Client/Server Boundaries

**Impact: HIGH** - most shadcn components need "use client"

**Components requiring "use client":** Dialog, AlertDialog, Sheet, DropdownMenu, Select, Tabs, Form, Toast, Popover, Tooltip, Accordion, Checkbox, Switch

**Components working in Server Components:** Button (without onClick), Card, Badge, Separator, Avatar, Skeleton (static display only)

**Pattern: Server Component with Client Islands:**
```tsx
// app/page.tsx (Server Component)
import { Card, CardContent } from "@/components/ui/card"
import { InteractiveDialog } from "@/components/interactive-dialog"  // Client Component

export default async function Page() {
  const data = await fetchData()
  return (
    <>
      <Card><CardContent>{data.title}</CardContent></Card>
      <InteractiveDialog />
    </>
  )
}
```

---

## 10. Accessibility

**Impact: MEDIUM** - preserve Radix accessibility features

- Never remove DialogTitle - use `className="sr-only"` if you don't want it visible
- Always provide DialogDescription for AlertDialog
- Use proper trigger components with `asChild`, not divs with onClick
- Add `sr-only` or `aria-label` to icon-only buttons:
```tsx
<Button variant="ghost" size="icon" aria-label="Close">
  <X className="h-4 w-4" />
</Button>
```

---

## 11. Extension Patterns

**Impact: MEDIUM** - safe customization

**Add variants with CVA:**
```tsx
const buttonVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "...",
      success: "bg-green-500 text-white",  // Custom variant
    },
  },
})
```

**Create wrapper components (don't edit ui/ files):**
```tsx
// components/custom/loading-button.tsx
import { Button, ButtonProps } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function LoadingButton({ loading, children, ...props }: ButtonProps & { loading?: boolean }) {
  return (
    <Button disabled={loading} {...props}>
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  )
}
```

**Directory structure:**
```
components/
├── ui/           # shadcn components (don't modify)
└── custom/       # Your wrapper components
```
