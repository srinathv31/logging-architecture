---
title: TanStack Table Setup
impact: HIGH
impactDescription: enables powerful data tables with sorting, filtering, pagination
tags: shadcn, table, tanstack, react-table, datatable
---

## TanStack Table Setup

Use @tanstack/react-table with shadcn's Table component for data tables. Don't recreate table logic with useState.

**Incorrect (custom table state management):**

```tsx
// DON'T DO THIS - recreating table functionality
function DataTable({ data }) {
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState("")

  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(filter.toLowerCase())
  )

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0
    // Manual sorting logic...
  })

  const paginatedData = sortedData.slice(
    (currentPage - 1) * 10,
    currentPage * 10
  )

  return (
    <table>
      {/* Manual table rendering... */}
    </table>
  )
}
```

**Correct (TanStack Table + shadcn):**

```bash
# Install dependencies
npm install @tanstack/react-table
npx shadcn@latest add table button
```

**File structure:**

```
components/
  data-table/
    columns.tsx      # Column definitions (client component)
    data-table.tsx   # DataTable component (client component)
app/
  users/
    page.tsx         # Server component that fetches data
```

**columns.tsx:**

```tsx
"use client"

import { ColumnDef } from "@tanstack/react-table"

export type User = {
  id: string
  email: string
  name: string
  status: "active" | "inactive"
}

export const columns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "status",
    header: "Status",
  },
]
```

**data-table.tsx:**

```tsx
"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
```

**page.tsx (Server Component):**

```tsx
import { DataTable } from "@/components/data-table/data-table"
import { columns } from "@/components/data-table/columns"

async function getData() {
  // Fetch data from API or database
  return [
    { id: "1", name: "John", email: "john@example.com", status: "active" },
    // ...
  ]
}

export default async function UsersPage() {
  const data = await getData()

  return (
    <div className="container mx-auto py-10">
      <DataTable columns={columns} data={data} />
    </div>
  )
}
```

**Guidelines:**

- Use TanStack Table for all table logic (sorting, filtering, pagination)
- Keep column definitions in a separate file
- DataTable is a client component ("use client")
- Page component can be a server component that fetches data
- Use getCoreRowModel() as the minimum, add other row models as needed
