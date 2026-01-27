---
title: Column Definitions
impact: HIGH
impactDescription: ensures type-safe, well-structured table columns
tags: shadcn, table, columns, columnDef, accessor
---

## Column Definitions

Define type-safe columns with proper accessors, custom cells, headers, and actions.

**Incorrect (inline, untyped columns):**

```tsx
// DON'T DO THIS - inline columns without types
const columns = [
  { header: "Name", accessor: "name" },  // Wrong property name
  { header: "Status", cell: (row) => row.status },  // Missing types
]
```

**Correct (typed ColumnDef with various patterns):**

**Basic columns:**

```tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"

export type Payment = {
  id: string
  amount: number
  status: "pending" | "processing" | "success" | "failed"
  email: string
  createdAt: Date
}

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "amount",
    header: "Amount",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
]
```

**Formatted cells:**

```tsx
import { Badge } from "@/components/ui/badge"

export const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"))
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount)
      return <div className="font-medium">{formatted}</div>
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge variant={status === "success" ? "default" : "secondary"}>
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date
      return <div>{date.toLocaleDateString()}</div>
    },
  },
]
```

**Sortable header:**

```tsx
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

{
  accessorKey: "email",
  header: ({ column }) => {
    return (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    )
  },
}
```

**Actions column with DropdownMenu:**

```tsx
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

{
  id: "actions",
  cell: ({ row }) => {
    const payment = row.original

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(payment.id)}
          >
            Copy payment ID
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>View details</DropdownMenuItem>
          <DropdownMenuItem>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  },
}
```

**Row selection column:**

```tsx
import { Checkbox } from "@/components/ui/checkbox"

{
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
      aria-label="Select all"
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(!!value)}
      aria-label="Select row"
    />
  ),
  enableSorting: false,
  enableHiding: false,
}
```

**Guidelines:**

- Use `accessorKey` for simple property access
- Use `accessorFn` for computed/nested values
- Use `cell` function for custom rendering
- Use `header` function for sortable headers
- Access row data via `row.original` for actions
- Add `id` property for columns without `accessorKey`
