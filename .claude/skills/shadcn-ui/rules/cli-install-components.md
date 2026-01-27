---
title: Install Components via CLI
impact: CRITICAL
impactDescription: prevents recreation of existing primitives and ensures consistency
tags: shadcn, cli, install, components, npx, add
---

## Install Components via CLI

ALWAYS use `npx shadcn@latest add <component>` to add shadcn/ui components. NEVER manually write primitive UI components that shadcn provides.

**Incorrect (manually recreating Button):**

```tsx
// DON'T DO THIS - recreating what shadcn provides
export function Button({ children, variant = "default", ...props }) {
  const baseStyles = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent",
  };
  return (
    <button className={`${baseStyles} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
}
```

**Correct (install and import):**

```bash
# Install the component via CLI
npx shadcn@latest add button
```

```tsx
// Import from the installed location
import { Button } from "@/components/ui/button"

export function MyComponent() {
  return (
    <>
      <Button variant="default">Click me</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="outline" size="sm">Small Outline</Button>
    </>
  )
}
```

**Common components to install (never recreate):**

| Component | Install Command |
|-----------|-----------------|
| Button | `npx shadcn@latest add button` |
| Card | `npx shadcn@latest add card` |
| Dialog | `npx shadcn@latest add dialog` |
| DropdownMenu | `npx shadcn@latest add dropdown-menu` |
| Form | `npx shadcn@latest add form` |
| Input | `npx shadcn@latest add input` |
| Label | `npx shadcn@latest add label` |
| Select | `npx shadcn@latest add select` |
| Table | `npx shadcn@latest add table` |
| Tabs | `npx shadcn@latest add tabs` |
| Toast | `npx shadcn@latest add sonner` |
| Checkbox | `npx shadcn@latest add checkbox` |
| RadioGroup | `npx shadcn@latest add radio-group` |
| Switch | `npx shadcn@latest add switch` |
| Textarea | `npx shadcn@latest add textarea` |
| Sheet | `npx shadcn@latest add sheet` |
| AlertDialog | `npx shadcn@latest add alert-dialog` |
| Popover | `npx shadcn@latest add popover` |
| Tooltip | `npx shadcn@latest add tooltip` |
| Avatar | `npx shadcn@latest add avatar` |
| Badge | `npx shadcn@latest add badge` |
| Skeleton | `npx shadcn@latest add skeleton` |
| ScrollArea | `npx shadcn@latest add scroll-area` |
| Separator | `npx shadcn@latest add separator` |

**Install multiple components at once:**

```bash
npx shadcn@latest add button card dialog input label
```

**Guidelines:**

- Before writing ANY UI component, check if shadcn provides it: https://ui.shadcn.com/docs/components
- If shadcn has it, run `npx shadcn@latest add <component-name>`
- If shadcn doesn't have it, compose from existing shadcn primitives (see `compose-from-primitives.md`)
- The CLI respects your `components.json` configuration for paths and styling
- Use `--overwrite` flag cautiously - it replaces existing customizations
