"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const data = [
  { day: "Mon", sales: 1200 },
  { day: "Tue", sales: 1800 },
  { day: "Wed", sales: 1450 },
  { day: "Thu", sales: 2100 },
  { day: "Fri", sales: 1900 },
  { day: "Sat", sales: 2400 },
  { day: "Sun", sales: 2200 }
];

export function SalesOverviewChart() {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(value) => `${value / 1000}k`}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--ring))", strokeWidth: 1 }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8
            }}
            labelStyle={{ color: "hsl(var(--muted-foreground))" }}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.18}
            strokeWidth={2}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

