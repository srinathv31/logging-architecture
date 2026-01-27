---
title: CSS Variables for Theming
impact: MEDIUM
impactDescription: enables consistent theming and automatic dark mode
tags: shadcn, css-variables, theming, dark-mode, colors
---

## CSS Variables for Theming

Use CSS variables for colors instead of hardcoded Tailwind classes. This enables theme customization and automatic dark mode.

**Incorrect (hardcoded colors):**

```tsx
// DON'T DO THIS - hardcoded colors don't adapt to theme
<div className="bg-white text-black border-gray-200">
  <button className="bg-blue-500 text-white hover:bg-blue-600">
    Click me
  </button>
</div>
```

**Correct (CSS variables):**

```tsx
// Uses CSS variables that adapt to light/dark mode
<div className="bg-background text-foreground border-border">
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Click me
  </button>
</div>
```

**Available semantic colors:**

| Variable | Light Mode | Dark Mode | Use For |
|----------|------------|-----------|---------|
| `--background` | White | Dark gray | Page background |
| `--foreground` | Black | White | Primary text |
| `--card` | White | Darker gray | Card backgrounds |
| `--card-foreground` | Black | White | Card text |
| `--primary` | Brand color | Brand color | Primary actions |
| `--primary-foreground` | White | White | Text on primary |
| `--secondary` | Light gray | Dark gray | Secondary actions |
| `--muted` | Light gray | Dark gray | Muted backgrounds |
| `--muted-foreground` | Gray | Light gray | Muted text |
| `--accent` | Light accent | Dark accent | Hover states |
| `--destructive` | Red | Red | Destructive actions |
| `--border` | Light gray | Dark gray | Borders |
| `--input` | Light gray | Dark gray | Input borders |
| `--ring` | Brand color | Brand color | Focus rings |

**Using in Tailwind:**

```tsx
// Background and text
<div className="bg-background text-foreground" />

// Cards
<div className="bg-card text-card-foreground rounded-lg border" />

// Muted elements
<p className="text-muted-foreground" />
<div className="bg-muted" />

// Primary button
<button className="bg-primary text-primary-foreground" />

// Destructive button
<button className="bg-destructive text-destructive-foreground" />

// Borders and inputs
<input className="border-input bg-background" />
<div className="border border-border" />

// Focus states
<button className="focus-visible:ring-2 focus-visible:ring-ring" />
```

**Customizing theme colors in globals.css:**

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    /* Add custom colors */
    --success: 142.1 76.2% 36.3%;
    --success-foreground: 355.7 100% 97.3%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    /* Dark mode custom colors */
    --success: 142.1 70.6% 45.3%;
    --success-foreground: 144.9 80.4% 10%;
  }
}
```

**Using custom colors in Tailwind config:**

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        success: "hsl(var(--success))",
        "success-foreground": "hsl(var(--success-foreground))",
      },
    },
  },
}
```

**Guidelines:**

- Use semantic color names (primary, secondary, muted) not raw colors
- CSS variables use HSL format without `hsl()` wrapper
- Tailwind classes add the `hsl()` wrapper automatically
- Always define both light and dark mode values
- Use `--foreground` variants for text on colored backgrounds
- Test in both light and dark modes
