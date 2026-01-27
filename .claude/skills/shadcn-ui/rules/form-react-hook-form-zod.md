---
title: React Hook Form + Zod Integration
impact: HIGH
impactDescription: ensures type-safe, validated forms with proper error handling
tags: shadcn, form, react-hook-form, zod, validation
---

## React Hook Form + Zod Integration

Use react-hook-form with Zod validation and shadcn Form components. This is the canonical pattern for forms in shadcn/ui projects.

**Incorrect (useState-based forms):**

```tsx
// DON'T DO THIS - manual state management without validation
function ContactForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [errors, setErrors] = useState({})

  const handleSubmit = (e) => {
    e.preventDefault()
    // Manual validation logic...
    if (!name) setErrors(prev => ({ ...prev, name: "Required" }))
    if (!email.includes("@")) setErrors(prev => ({ ...prev, email: "Invalid" }))
    // ...
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} />
      {errors.name && <span>{errors.name}</span>}
      {/* ... */}
    </form>
  )
}
```

**Correct (react-hook-form + Zod + shadcn Form):**

```bash
# Install required packages and components
npm install react-hook-form @hookform/resolvers zod
npx shadcn@latest add form input button
```

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
})

type FormValues = z.infer<typeof formSchema>

export function ContactForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  })

  function onSubmit(values: FormValues) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormDescription>Your full name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

**Common Zod schemas:**

```typescript
// Required string
z.string().min(1, "Required")

// Email
z.string().email("Invalid email")

// Password with requirements
z.string()
  .min(8, "Must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain uppercase")
  .regex(/[0-9]/, "Must contain number")

// Optional field
z.string().optional()

// Number field
z.coerce.number().min(0).max(100)

// Select/enum
z.enum(["option1", "option2", "option3"])

// Checkbox (boolean)
z.boolean().refine(val => val === true, "Must accept terms")

// Date
z.coerce.date()

// Array of items
z.array(z.string()).min(1, "Select at least one")
```

**Guidelines:**

- Always define schema with Zod for type-safe validation
- Use `z.infer<typeof schema>` for TypeScript types
- Spread `{...field}` to connect form state to inputs
- Use FormMessage for automatic error display
- Add "use client" directive - forms require client interactivity
- Set sensible defaultValues to avoid uncontrolled input warnings
