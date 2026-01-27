---
title: Chart Types
impact: MEDIUM
impactDescription: guides selection and implementation of appropriate chart types
tags: shadcn, chart, bar, line, area, pie, radar, radial
---

## Chart Types

shadcn/ui supports various chart types via Recharts. Choose the appropriate type for your data.

**When to use each type:**

| Chart Type | Use For |
|------------|---------|
| Bar | Comparing discrete categories |
| Line | Showing trends over time |
| Area | Showing cumulative values or volume |
| Pie/Donut | Showing parts of a whole |
| Radar | Comparing multiple variables |
| Radial | Progress or single value display |

**Bar Chart:**

```tsx
import { Bar, BarChart, XAxis, YAxis } from "recharts"

<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  <BarChart data={data}>
    <XAxis dataKey="month" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
  </BarChart>
</ChartContainer>

// Stacked bar
<Bar dataKey="desktop" fill="var(--color-desktop)" stackId="a" />
<Bar dataKey="mobile" fill="var(--color-mobile)" stackId="a" />

// Horizontal bar
<BarChart data={data} layout="vertical">
  <XAxis type="number" />
  <YAxis dataKey="name" type="category" />
</BarChart>
```

**Line Chart:**

```tsx
import { Line, LineChart, XAxis, YAxis } from "recharts"

<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  <LineChart data={data}>
    <XAxis dataKey="month" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line
      dataKey="desktop"
      stroke="var(--color-desktop)"
      strokeWidth={2}
      dot={false}
    />
  </LineChart>
</ChartContainer>

// Multiple lines
<Line dataKey="desktop" stroke="var(--color-desktop)" />
<Line dataKey="mobile" stroke="var(--color-mobile)" />
```

**Area Chart:**

```tsx
import { Area, AreaChart, XAxis, YAxis } from "recharts"

<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  <AreaChart data={data}>
    <XAxis dataKey="month" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Area
      dataKey="desktop"
      fill="var(--color-desktop)"
      stroke="var(--color-desktop)"
      fillOpacity={0.4}
    />
  </AreaChart>
</ChartContainer>

// Stacked area
<Area dataKey="desktop" stackId="1" fill="var(--color-desktop)" />
<Area dataKey="mobile" stackId="1" fill="var(--color-mobile)" />
```

**Pie Chart:**

```tsx
import { Pie, PieChart } from "recharts"

const data = [
  { name: "Chrome", value: 275, fill: "var(--color-chrome)" },
  { name: "Safari", value: 200, fill: "var(--color-safari)" },
  { name: "Firefox", value: 187, fill: "var(--color-firefox)" },
]

<ChartContainer config={chartConfig} className="min-h-[250px] w-full">
  <PieChart>
    <ChartTooltip content={<ChartTooltipContent />} />
    <Pie data={data} dataKey="value" nameKey="name" />
  </PieChart>
</ChartContainer>

// Donut chart
<Pie data={data} dataKey="value" innerRadius={60} outerRadius={80} />

// With label
<Pie data={data} dataKey="value" label />
```

**Radar Chart:**

```tsx
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"

const data = [
  { skill: "JavaScript", level: 90 },
  { skill: "TypeScript", level: 85 },
  { skill: "React", level: 88 },
  { skill: "CSS", level: 75 },
  { skill: "Node.js", level: 70 },
]

<ChartContainer config={chartConfig} className="min-h-[250px] w-full">
  <RadarChart data={data}>
    <PolarGrid />
    <PolarAngleAxis dataKey="skill" />
    <Radar
      dataKey="level"
      fill="var(--color-level)"
      fillOpacity={0.5}
      stroke="var(--color-level)"
    />
  </RadarChart>
</ChartContainer>
```

**Radial Chart (Progress):**

```tsx
import { RadialBar, RadialBarChart, PolarRadiusAxis, Label } from "recharts"

<ChartContainer config={chartConfig} className="min-h-[250px] w-full">
  <RadialBarChart
    data={[{ value: 75, fill: "var(--color-progress)" }]}
    startAngle={180}
    endAngle={0}
    innerRadius={80}
    outerRadius={130}
  >
    <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
      <Label
        content={({ viewBox }) => (
          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
            <tspan className="text-3xl font-bold">75%</tspan>
          </text>
        )}
      />
    </PolarRadiusAxis>
    <RadialBar dataKey="value" cornerRadius={10} />
  </RadialBarChart>
</ChartContainer>
```

**Guidelines:**

- Always wrap in ChartContainer with min-h
- Use appropriate chart type for your data
- Keep charts simple - don't overload with data series
- Use ChartTooltip for interactivity
- Use ChartLegend when multiple series exist
- Consider mobile: keep legends below chart on small screens
