---
title: Recharts Setup with ChartContainer
impact: HIGH
impactDescription: ensures responsive, themed charts with proper structure
tags: shadcn, chart, recharts, ChartContainer, responsive
---

## Recharts Setup with ChartContainer

Use shadcn's ChartContainer wrapper with Recharts for responsive, themed charts. Don't use Recharts directly without the wrapper.

**Incorrect (raw Recharts without wrapper):**

```tsx
// DON'T DO THIS - missing ChartContainer and responsiveness
import { BarChart, Bar, XAxis, YAxis } from "recharts"

function MyChart({ data }) {
  return (
    <BarChart width={400} height={300} data={data}>
      <XAxis dataKey="name" />
      <YAxis />
      <Bar dataKey="value" fill="#8884d8" />
    </BarChart>
  )
}
```

**Correct (with ChartContainer):**

```bash
# Install the chart component
npx shadcn@latest add chart
```

```tsx
"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

const chartData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function MyChart() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart data={chartData}>
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
      </BarChart>
    </ChartContainer>
  )
}
```

**Key components:**

| Component | Purpose |
|-----------|---------|
| ChartContainer | Wrapper for responsiveness and theming |
| ChartConfig | Type-safe configuration object |
| ChartTooltip | Themed tooltip wrapper |
| ChartTooltipContent | Default tooltip content |
| ChartLegend | Themed legend wrapper |
| ChartLegendContent | Default legend content |

**ChartContainer requirements:**

```tsx
// REQUIRED: Set min-h-[VALUE] for responsiveness
<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  {/* Chart content */}
</ChartContainer>

// The container handles:
// - ResponsiveContainer from Recharts
// - CSS variable injection for theming
// - Proper sizing and aspect ratio
```

**Adding tooltips:**

```tsx
import { ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

<BarChart data={data}>
  <ChartTooltip
    content={<ChartTooltipContent />}
    cursor={false}  // Optional: hide cursor line
  />
  <Bar dataKey="value" />
</BarChart>
```

**Adding legend:**

```tsx
import { ChartLegend, ChartLegendContent } from "@/components/ui/chart"

<BarChart data={data}>
  <ChartLegend content={<ChartLegendContent />} />
  <Bar dataKey="desktop" />
  <Bar dataKey="mobile" />
</BarChart>
```

**Guidelines:**

- Always wrap charts in ChartContainer
- Always set `min-h-[VALUE]` on ChartContainer for responsiveness
- Define ChartConfig for type-safe color and label management
- Use CSS variables for colors (var(--color-{key}))
- Don't set fixed width/height - ChartContainer handles sizing
- Add "use client" - charts require client-side rendering
