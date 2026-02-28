import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  AlertTriangle,
  Play,
  ArrowRight,
  Square,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";

export const EVENT_TYPES = ["PROCESS_START", "STEP", "PROCESS_END", "ERROR"] as const;

export const EVENT_STATUSES = ["SUCCESS", "FAILURE", "IN_PROGRESS", "SKIPPED", "WARNING"] as const;

export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

export const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  FAILURE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  SKIPPED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  WARNING: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-500",
  FAILURE: "bg-red-500",
  IN_PROGRESS: "bg-yellow-500",
  SKIPPED: "bg-gray-400",
  WARNING: "bg-amber-500",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  PROCESS_START: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  STEP: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PROCESS_END: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export const STATUS_ICONS: Record<string, LucideIcon> = {
  SUCCESS: CheckCircle2,
  FAILURE: XCircle,
  IN_PROGRESS: Clock,
  SKIPPED: MinusCircle,
  WARNING: AlertTriangle,
};

export const EVENT_TYPE_ICONS: Record<string, LucideIcon> = {
  PROCESS_START: Play,
  STEP: ArrowRight,
  PROCESS_END: Square,
  ERROR: AlertCircle,
};

export const STATUS_LEFT_BORDER: Record<string, string> = {
  SUCCESS: "border-l-green-500",
  FAILURE: "border-l-red-500",
  IN_PROGRESS: "border-l-yellow-500",
  SKIPPED: "border-l-gray-400",
  WARNING: "border-l-amber-500",
};

export const HTTP_METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  PUT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  PATCH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  HEAD: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  OPTIONS: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};
