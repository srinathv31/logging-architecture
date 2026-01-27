---
title: Loading Patterns with Skeleton
impact: MEDIUM
impactDescription: provides good UX during data loading
tags: shadcn, nextjs, skeleton, loading, suspense
---

## Loading Patterns with Skeleton

Use shadcn's Skeleton component with Next.js Suspense for smooth loading states.

**Incorrect (no loading state):**

```tsx
// DON'T DO THIS - content pops in without indication
export default async function UsersPage() {
  const users = await getUsers()  // User sees nothing while this loads
  return <UserList users={users} />
}
```

**Correct (with loading.tsx):**

```bash
npx shadcn@latest add skeleton card
```

```tsx
// app/users/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function UsersLoading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

// app/users/page.tsx
export default async function UsersPage() {
  const users = await getUsers()
  return <UserList users={users} />
}
```

**Skeleton patterns:**

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// Avatar skeleton
<Skeleton className="h-12 w-12 rounded-full" />

// Text line skeleton
<Skeleton className="h-4 w-[250px]" />

// Card skeleton
<div className="space-y-3">
  <Skeleton className="h-[125px] w-full rounded-xl" />
  <div className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-[80%]" />
  </div>
</div>

// Table row skeleton
<div className="flex items-center space-x-4">
  <Skeleton className="h-4 w-[100px]" />
  <Skeleton className="h-4 w-[200px]" />
  <Skeleton className="h-4 w-[150px]" />
  <Skeleton className="h-4 w-[80px]" />
</div>
```

**With Suspense boundaries:**

```tsx
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

function UserCardSkeleton() {
  return (
    <div className="flex items-center space-x-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[150px]" />
      </div>
    </div>
  )
}

async function UserCard({ userId }: { userId: string }) {
  const user = await getUser(userId)
  return (
    <div className="flex items-center space-x-4">
      <Avatar>
        <AvatarImage src={user.avatar} />
        <AvatarFallback>{user.name[0]}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-medium">{user.name}</p>
        <p className="text-muted-foreground">{user.email}</p>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<UserCardSkeleton />}>
      <UserCard userId="123" />
    </Suspense>
  )
}
```

**Streaming with multiple Suspense:**

```tsx
export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <UsersChart />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>

      <Suspense fallback={<ListSkeleton />}>
        <TopProducts />
      </Suspense>
    </div>
  )
}
```

**Reusable skeleton components:**

```tsx
// components/skeletons.tsx
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <Skeleton className="h-5 w-1/4" />
        <Skeleton className="h-4 w-2/4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[150px]" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
        </div>
      ))}
    </div>
  )
}
```

**Guidelines:**

- Create loading.tsx files for route-level loading states
- Match skeleton dimensions to actual content
- Use Suspense for component-level loading
- Create reusable skeleton components for consistency
- Consider pulse animation (default) vs static skeletons
