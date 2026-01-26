export const EVENT_TYPES = ["PROCESS_START", "STEP", "PROCESS_END", "ERROR"] as const;

export const EVENT_STATUSES = ["SUCCESS", "FAILURE", "IN_PROGRESS", "SKIPPED"] as const;

export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

export const STATUS_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  FAILURE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  SKIPPED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

export const STATUS_DOT_COLORS: Record<string, string> = {
  SUCCESS: "bg-green-500",
  FAILURE: "bg-red-500",
  IN_PROGRESS: "bg-yellow-500",
  SKIPPED: "bg-gray-400",
};

export const EVENT_TYPE_COLORS: Record<string, string> = {
  PROCESS_START: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  STEP: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  PROCESS_END: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  ERROR: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
