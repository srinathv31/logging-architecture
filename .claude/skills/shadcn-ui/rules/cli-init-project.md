---
title: Project Initialization
impact: HIGH
impactDescription: ensures proper foundation for all shadcn components
tags: shadcn, cli, init, setup, configuration
---

## Project Initialization

Initialize shadcn/ui properly using the CLI. This sets up the required configuration, CSS variables, and utility functions.

**Incorrect (manual setup):**

```tsx
// DON'T DO THIS - manually creating utils and copying files
// components/ui/button.tsx - copied from somewhere
// lib/utils.ts - manually created
// Manually adding CSS variables to globals.css
```

**Correct (CLI initialization):**

```bash
# Initialize shadcn/ui in your project
npx shadcn@latest init
```

The CLI will prompt for:
- TypeScript or JavaScript
- Style (default, new-york)
- Base color
- CSS variables location
- Tailwind config location
- Component import alias (e.g., @/components)
- Utility import alias (e.g., @/lib/utils)

**Generated `components.json`:**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

**Generated `lib/utils.ts`:**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**CSS Variables in `globals.css`:**

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;
    /* ... more variables */
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    /* ... dark mode variables */
  }
}
```

**Quick start for new projects:**

```bash
# Create a new Next.js project with shadcn pre-configured
npx shadcn@latest init
```

**Guidelines:**

- Always run `npx shadcn@latest init` before adding components
- Don't manually create the `lib/utils.ts` file - the CLI generates it
- Don't manually copy CSS variables - the CLI sets them up correctly
- The `components.json` file is the source of truth for shadcn configuration
- Use the `--defaults` flag to skip prompts: `npx shadcn@latest init --defaults`
