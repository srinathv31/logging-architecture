---
title: Wrapper Components for Extension
impact: MEDIUM
impactDescription: enables safe customization without breaking component updates
tags: shadcn, wrapper, extension, customization, components
---

## Wrapper Components for Extension

Create wrapper components in a separate directory instead of directly editing files in `components/ui/`. This preserves your customizations when updating shadcn components.

**Incorrect (editing ui/ files directly):**

```tsx
// DON'T DO THIS - modifying components/ui/button.tsx directly
// Your changes will be lost when you run: npx shadcn@latest add button --overwrite

// components/ui/button.tsx
export function Button({ children, loading, ...props }) {
  // Custom loading logic added directly to shadcn component
  if (loading) {
    return <button disabled>Loading...</button>
  }
  return <button {...props}>{children}</button>
}
```

**Correct (wrapper component):**

```tsx
// components/custom/loading-button.tsx
"use client"

import { forwardRef } from "react"
import { Loader2 } from "lucide-react"
import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
}

const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, loading, disabled, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        className={cn(loading && "cursor-wait", className)}
        {...props}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }
```

**Directory structure:**

```
components/
├── ui/                    # shadcn components (don't modify)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
└── custom/                # Your wrapper components
    ├── loading-button.tsx
    ├── confirm-dialog.tsx
    ├── data-card.tsx
    └── ...
```

**Example wrappers:**

**Confirm Dialog:**

```tsx
// components/custom/confirm-dialog.tsx
"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ConfirmDialogProps {
  trigger: React.ReactNode
  title: string
  description: string
  onConfirm: () => void
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  onConfirm,
  confirmText = "Continue",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              variant === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Data Card:**

```tsx
// components/custom/data-card.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface DataCardProps {
  title: string
  description?: string
  value: string | number
  loading?: boolean
  trend?: {
    value: number
    positive: boolean
  }
}

export function DataCard({
  title,
  description,
  value,
  loading,
  trend,
}: DataCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        {description && (
          <CardTitle className="text-sm font-normal text-muted-foreground">
            {description}
          </CardTitle>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">{value}</span>
            {trend && (
              <span
                className={
                  trend.positive ? "text-green-500" : "text-red-500"
                }
              >
                {trend.positive ? "+" : "-"}{Math.abs(trend.value)}%
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

**Guidelines:**

- Keep `components/ui/` as the source of truth from shadcn
- Create `components/custom/` for your wrapper components
- Wrappers should import from `@/components/ui/*`
- Forward refs when wrapping interactive components
- Add TypeScript interfaces that extend original props
- Use composition over modification
- Document what each wrapper adds beyond the base component
