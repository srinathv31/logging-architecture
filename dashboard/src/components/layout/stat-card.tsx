import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendUp?: boolean;
  status?: "success" | "warning" | "error" | "neutral";
  className?: string;
}

const statusStyles = {
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
  neutral: "text-muted-foreground",
};

const iconBgStyles = {
  success: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
  warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
  error: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  neutral: "bg-primary/10 text-primary",
};

export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  trend,
  trendUp,
  status = "neutral",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
        className
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="flex items-baseline gap-2">
            <p className={cn("text-2xl font-bold tabular-nums", status !== "neutral" && statusStyles[status])}>
              {value}
            </p>
            {trend && (
              <span
                className={cn(
                  "text-xs font-medium",
                  trendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {trend}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">{subtitle}</p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconBgStyles[status])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
