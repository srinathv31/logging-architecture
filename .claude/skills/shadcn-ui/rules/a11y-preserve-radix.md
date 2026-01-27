---
title: Preserve Radix Accessibility
impact: MEDIUM
impactDescription: maintains built-in accessibility features from Radix primitives
tags: shadcn, accessibility, a11y, radix, aria, keyboard
---

## Preserve Radix Accessibility

shadcn/ui components are built on Radix UI primitives which have excellent accessibility built-in. Don't break these features when customizing.

**Incorrect (breaking accessibility):**

```tsx
// DON'T DO THIS - removing or overriding accessibility attributes
<DialogContent aria-describedby={undefined}>  {/* Removes description link */}
  <DialogTitle className="sr-only" />  {/* Hides title visually AND from screen readers */}
</DialogContent>

// DON'T DO THIS - preventing keyboard navigation
<DropdownMenuItem onKeyDown={(e) => e.preventDefault()}>
  Item
</DropdownMenuItem>

// DON'T DO THIS - using div instead of proper trigger
<div onClick={() => setOpen(true)}>  {/* Not keyboard accessible */}
  Open Dialog
</div>
```

**Correct (preserving accessibility):**

```tsx
// Use DialogTrigger for proper keyboard and screen reader support
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>  {/* Keyboard accessible button */}
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>  {/* Required for screen readers */}
      <DialogDescription>
        Make changes to your profile here.
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>

// Visually hidden but accessible title
<DialogContent>
  <DialogHeader>
    <DialogTitle className="sr-only">Navigation Menu</DialogTitle>
  </DialogHeader>
  {/* Content */}
</DialogContent>
```

**Built-in Radix accessibility features:**

| Feature | Provided By |
|---------|-------------|
| Focus trapping | Dialog, AlertDialog, Sheet |
| Focus return | Dialog, DropdownMenu, Popover |
| Escape to close | All overlay components |
| Arrow key navigation | DropdownMenu, Select, Tabs |
| Type-ahead | Select, Combobox |
| Screen reader announcements | All components |
| ARIA attributes | Automatic on all components |

**Required elements for accessibility:**

```tsx
// Dialog - MUST have DialogTitle
<Dialog>
  <DialogContent>
    <DialogTitle>Required Title</DialogTitle>  {/* Required */}
    <DialogDescription>Optional but recommended</DialogDescription>
  </DialogContent>
</Dialog>

// AlertDialog - MUST have title and description
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogTitle>Are you sure?</AlertDialogTitle>  {/* Required */}
    <AlertDialogDescription>
      This action cannot be undone.  {/* Required */}
    </AlertDialogDescription>
  </AlertDialogContent>
</AlertDialog>

// Form fields - use Label component
<FormField
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>  {/* Links to input automatically */}
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />  {/* Announced to screen readers */}
    </FormItem>
  )}
/>
```

**Keyboard navigation patterns:**

| Component | Keyboard Support |
|-----------|-----------------|
| Dialog | Tab cycles through, Escape closes |
| DropdownMenu | Arrow keys navigate, Enter selects, Escape closes |
| Select | Arrow keys navigate, Enter selects, Type to search |
| Tabs | Arrow keys switch tabs, Enter/Space activates |
| Accordion | Arrow keys navigate, Enter/Space toggles |

**Adding sr-only labels:**

```tsx
// Icon-only buttons need accessible labels
<Button variant="ghost" size="icon">
  <span className="sr-only">Close</span>
  <X className="h-4 w-4" />
</Button>

// Or use aria-label
<Button variant="ghost" size="icon" aria-label="Close">
  <X className="h-4 w-4" />
</Button>
```

**Guidelines:**

- Never remove DialogTitle - use sr-only if you don't want it visible
- Always provide DialogDescription for AlertDialog
- Use proper trigger components, not generic divs with onClick
- Don't prevent default keyboard events
- Add sr-only or aria-label to icon-only buttons
- Test with keyboard navigation (Tab, Escape, Arrow keys)
- Test with screen readers when possible
