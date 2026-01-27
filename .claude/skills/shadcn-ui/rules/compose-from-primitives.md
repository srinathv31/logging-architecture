---
title: Compose from Existing Primitives
impact: CRITICAL
impactDescription: ensures UI consistency and prevents duplicate code
tags: shadcn, compose, primitives, components, patterns
---

## Compose from Existing Primitives

When building custom UI that isn't a direct shadcn component, COMPOSE from existing primitives rather than creating from scratch.

**Incorrect (creating custom confirmation dialog):**

```tsx
// DON'T DO THIS - recreating dialog functionality from scratch
export function ConfirmDialog({ open, onConfirm, onCancel, title, message }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md shadow-lg">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-gray-600">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 border rounded">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded">Confirm</button>
        </div>
      </div>
    </div>
  );
}
```

**Correct (compose from shadcn primitives):**

```bash
# First ensure required components are installed
npx shadcn@latest add alert-dialog button
```

```tsx
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
import { Button } from "@/components/ui/button"

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
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === "destructive" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

**Common composition patterns:**

| Need | Compose From | Install |
|------|--------------|---------|
| Confirmation modal | AlertDialog + Button | `alert-dialog button` |
| Settings panel | Sheet + Form + Input/Select | `sheet form input select` |
| Data table with actions | Table + DropdownMenu + Button | `table dropdown-menu button` |
| Search with results | Command + Input | `command input` |
| User menu | DropdownMenu + Avatar + Button | `dropdown-menu avatar button` |
| Notification center | Popover + ScrollArea + Card | `popover scroll-area card` |
| Multi-step form | Tabs + Form + Button | `tabs form button` |
| File upload area | Card + Input + Button | `card input button` |
| Status indicator | Badge + Tooltip | `badge tooltip` |

**Example: User menu composed from primitives:**

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu({ user, onSignOut }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name[0]}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Guidelines:**

- Always check if shadcn has the exact component first
- Compose primitives before creating custom elements
- Maintain the compound component pattern when composing
- Keep custom logic in wrapper, delegate rendering to primitives
- Use `asChild` to pass trigger behavior to custom elements
