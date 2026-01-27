---
title: Compound Component Patterns
impact: HIGH
impactDescription: ensures proper component composition and behavior
tags: shadcn, compound, asChild, slots, composition
---

## Compound Component Patterns

Understand and use shadcn's compound component API correctly. Most components follow the Radix UI pattern with multiple sub-components that work together.

**Incorrect (ignoring compound structure):**

```tsx
// DON'T DO THIS - trying to use Dialog as a single component
import { Dialog } from "@/components/ui/dialog"

// This won't work - Dialog requires its sub-components
function MyDialog() {
  return <Dialog title="Hello" content="World" />
}

// DON'T DO THIS - missing asChild for custom triggers
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

function Menu() {
  return (
    <DropdownMenuTrigger>
      <MyCustomButton>Open</MyCustomButton>  {/* Won't pass click handler */}
    </DropdownMenuTrigger>
  )
}
```

**Correct (using compound components):**

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

function MyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hello</DialogTitle>
          <DialogDescription>World</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Using `asChild` correctly:**

```tsx
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// Correct - asChild passes click handler to custom element
function Menu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="custom-button">Open Menu</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Item 1</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Common compound component structures:**

| Component | Structure |
|-----------|-----------|
| Dialog | Dialog > DialogTrigger + DialogContent > DialogHeader + DialogFooter |
| AlertDialog | AlertDialog > AlertDialogTrigger + AlertDialogContent |
| DropdownMenu | DropdownMenu > DropdownMenuTrigger + DropdownMenuContent > DropdownMenuItem |
| Select | Select > SelectTrigger > SelectValue + SelectContent > SelectItem |
| Tabs | Tabs > TabsList > TabsTrigger + TabsContent |
| Sheet | Sheet > SheetTrigger + SheetContent |
| Popover | Popover > PopoverTrigger + PopoverContent |
| Command | Command > CommandInput + CommandList > CommandGroup > CommandItem |

**Controlled vs Uncontrolled:**

```tsx
// Uncontrolled - internal state management
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>

// Controlled - external state management
const [open, setOpen] = useState(false)

<Dialog open={open} onOpenChange={setOpen}>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>...</DialogContent>
</Dialog>
```

**Guidelines:**

- Always use compound sub-components, not props
- Use `asChild` when wrapping custom elements as triggers
- Check component docs for required sub-components
- Use controlled mode when you need programmatic open/close
- Compound components share context - keep them properly nested
