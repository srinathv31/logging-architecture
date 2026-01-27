---
title: Chart Configuration and Theming
impact: HIGH
impactDescription: ensures consistent theming and automatic dark mode support
tags: shadcn, chart, config, theming, css-variables, dark-mode
---

## Chart Configuration and Theming

Use ChartConfig with CSS variables for automatic light/dark mode support. Don't hardcode colors.

**Incorrect (hardcoded colors):**

```tsx
// DON'T DO THIS - hardcoded colors don't adapt to theme
const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "#2563eb",  // Hardcoded blue
  },
  mobile: {
    label: "Mobile",
    color: "#60a5fa",  // Hardcoded light blue
  },
}

<Bar dataKey="desktop" fill="#2563eb" />  // Hardcoded
```

**Correct (CSS variables):**

```tsx
"use client"

import { ChartConfig, ChartContainer } from "@/components/ui/chart"

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",  // Uses CSS variable
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

// Reference the color via var(--color-{key})
<Bar dataKey="desktop" fill="var(--color-desktop)" />
<Bar dataKey="mobile" fill="var(--color-mobile)" />
```

**Available CSS variables (defined in globals.css):**

```css
:root {
  --chart-1: 221.2 83.2% 53.3%;  /* Blue */
  --chart-2: 212 95% 68%;        /* Light blue */
  --chart-3: 216 92% 60%;        /* Sky blue */
  --chart-4: 210 98% 78%;        /* Lighter blue */
  --chart-5: 212 97% 87%;        /* Lightest blue */
}

.dark {
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
}
```

**Using theme colors:**

```tsx
const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--primary))",  // Uses primary theme color
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--destructive))",  // Uses destructive color
  },
} satisfies ChartConfig
```

**Multi-series chart config:**

```tsx
const chartConfig = {
  views: {
    label: "Page Views",
  },
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
  mobile: {
    label: "Mobile",
    color: "var(--chart-2)",
  },
  tablet: {
    label: "Tablet",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig

export function MultiSeriesChart() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <AreaChart data={data}>
        <Area dataKey="desktop" fill="var(--color-desktop)" stroke="var(--color-desktop)" />
        <Area dataKey="mobile" fill="var(--color-mobile)" stroke="var(--color-mobile)" />
        <Area dataKey="tablet" fill="var(--color-tablet)" stroke="var(--color-tablet)" />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  )
}
```

**Custom tooltip with config labels:**

```tsx
<ChartTooltip
  content={
    <ChartTooltipContent
      labelFormatter={(value) => `Month: ${value}`}
      formatter={(value, name) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{chartConfig[name]?.label}</span>
          <span>{value}</span>
        </div>
      )}
    />
  }
/>
```

**Guidelines:**

- Use `var(--chart-1)` through `var(--chart-5)` for data series
- Reference colors in components via `var(--color-{configKey})`
- Add `satisfies ChartConfig` for type safety
- Keys in config must match dataKey values
- The label property is used in tooltips and legends
- Dark mode colors are automatically applied
