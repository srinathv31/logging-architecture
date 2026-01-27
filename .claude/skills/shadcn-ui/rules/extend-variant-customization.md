---
title: Variant Customization with CVA
impact: MEDIUM
impactDescription: enables safe extension of component variants
tags: shadcn, cva, variants, customization, class-variance-authority
---

## Variant Customization with CVA

Use class-variance-authority (CVA) to add new variants to shadcn components. This is how the built-in variants work.

**Incorrect (inline conditional classes):**

```tsx
// DON'T DO THIS - hard to maintain variant logic
function Button({ variant, size, children }) {
  let classes = "inline-flex items-center justify-center"

  if (variant === "primary") classes += " bg-blue-500 text-white"
  else if (variant === "secondary") classes += " bg-gray-500 text-white"
  else if (variant === "success") classes += " bg-green-500 text-white"  // Custom

  if (size === "sm") classes += " h-8 px-3 text-sm"
  else if (size === "lg") classes += " h-12 px-6 text-lg"

  return <button className={classes}>{children}</button>
}
```

**Correct (using CVA):**

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base classes applied to all variants
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Add custom variants
        success: "bg-green-500 text-white hover:bg-green-600",
        warning: "bg-yellow-500 text-black hover:bg-yellow-600",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Add custom sizes
        xs: "h-7 rounded px-2 text-xs",
        xl: "h-14 rounded-lg px-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
```

**Adding variants to existing shadcn components:**

```tsx
// components/ui/button.tsx - extend the existing file
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center...",
  {
    variants: {
      variant: {
        // Keep existing variants
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "...",
        outline: "...",
        secondary: "...",
        ghost: "...",
        link: "...",
        // Add your custom variants
        premium: "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600",
      },
      size: {
        // Existing sizes...
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

**Compound variants (combinations):**

```tsx
const buttonVariants = cva("base-classes", {
  variants: {
    variant: {
      default: "...",
      outline: "...",
    },
    size: {
      sm: "...",
      lg: "...",
    },
  },
  compoundVariants: [
    // Apply special styles when both conditions match
    {
      variant: "outline",
      size: "lg",
      className: "border-2",  // Thicker border for large outline
    },
  ],
})
```

**Extending for specific use cases:**

```tsx
// Create a specialized button variant
const primaryButtonVariants = cva(
  buttonVariants({ variant: "default" }),  // Start with default
  {
    variants: {
      loading: {
        true: "opacity-70 cursor-wait",
        false: "",
      },
    },
  }
)
```

**Guidelines:**

- Use CVA for any component with multiple variants
- Export both the component and the variants function
- Use `VariantProps<typeof variants>` for type safety
- Add custom variants alongside existing ones, don't replace
- Use compoundVariants for variant combinations
- Keep base classes that apply to all variants
