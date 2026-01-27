---
title: Form Field Components
impact: HIGH
impactDescription: ensures consistent form field structure and accessibility
tags: shadcn, form, field, input, select, checkbox
---

## Form Field Components

Use shadcn Form components (FormField, FormItem, FormControl, FormLabel, FormMessage) with various input types for consistent, accessible forms.

**Incorrect (raw inputs without Form wrapper):**

```tsx
// DON'T DO THIS - missing Form structure
<form>
  <label>Email</label>
  <Input {...register("email")} />
  {errors.email && <span>{errors.email.message}</span>}
</form>
```

**Correct (FormField with different input types):**

**Text Input:**

```tsx
<FormField
  control={form.control}
  name="username"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Username</FormLabel>
      <FormControl>
        <Input placeholder="johndoe" {...field} />
      </FormControl>
      <FormDescription>Your unique username.</FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Textarea:**

```tsx
npx shadcn@latest add textarea
```

```tsx
<FormField
  control={form.control}
  name="bio"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Bio</FormLabel>
      <FormControl>
        <Textarea placeholder="Tell us about yourself" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Select:**

```tsx
npx shadcn@latest add select
```

```tsx
<FormField
  control={form.control}
  name="role"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Role</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="guest">Guest</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Checkbox:**

```tsx
npx shadcn@latest add checkbox
```

```tsx
<FormField
  control={form.control}
  name="terms"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>Accept terms and conditions</FormLabel>
        <FormDescription>
          You agree to our Terms of Service and Privacy Policy.
        </FormDescription>
      </div>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Radio Group:**

```tsx
npx shadcn@latest add radio-group
```

```tsx
<FormField
  control={form.control}
  name="type"
  render={({ field }) => (
    <FormItem className="space-y-3">
      <FormLabel>Notification type</FormLabel>
      <FormControl>
        <RadioGroup
          onValueChange={field.onChange}
          defaultValue={field.value}
          className="flex flex-col space-y-1"
        >
          <FormItem className="flex items-center space-x-3 space-y-0">
            <FormControl>
              <RadioGroupItem value="all" />
            </FormControl>
            <FormLabel className="font-normal">All notifications</FormLabel>
          </FormItem>
          <FormItem className="flex items-center space-x-3 space-y-0">
            <FormControl>
              <RadioGroupItem value="important" />
            </FormControl>
            <FormLabel className="font-normal">Important only</FormLabel>
          </FormItem>
        </RadioGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Switch:**

```tsx
npx shadcn@latest add switch
```

```tsx
<FormField
  control={form.control}
  name="marketing"
  render={({ field }) => (
    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
      <div className="space-y-0.5">
        <FormLabel className="text-base">Marketing emails</FormLabel>
        <FormDescription>
          Receive emails about new products and features.
        </FormDescription>
      </div>
      <FormControl>
        <Switch
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
    </FormItem>
  )}
/>
```

**Guidelines:**

- Always wrap inputs in FormField > FormItem > FormControl
- Use FormLabel for accessible labels (auto-linked via context)
- FormMessage automatically displays validation errors
- FormDescription provides helpful context
- For Checkbox/Switch: use `checked` and `onCheckedChange`, not `value` and `onChange`
- For Select: use `onValueChange`, not `onChange`
