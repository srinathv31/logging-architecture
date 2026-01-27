"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Code,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface PayloadViewerProps {
  content: string | null;
  label: string;
}

const MAX_COLLAPSED_LENGTH = 500;

export function PayloadViewer({ content, label }: PayloadViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!content) {
    return (
      <div className="rounded-lg border border-dashed p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No {label.toLowerCase()} data</p>
      </div>
    );
  }

  let formatted = content;
  try {
    const parsed = JSON.parse(content);
    formatted = JSON.stringify(parsed, null, 2);
  } catch {
    // Not JSON, use as-is
  }

  const isLong = formatted.length > MAX_COLLAPSED_LENGTH;
  const displayContent = isLong && !expanded
    ? formatted.slice(0, MAX_COLLAPSED_LENGTH) + "..."
    : formatted;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-muted px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Code className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-1">
          {isLong && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Expand
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 text-xs gap-1 ${copied ? "text-green-600 dark:text-green-400" : ""}`}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>
      {/* Code block */}
      <pre className="max-h-80 overflow-auto bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-all">
        {displayContent}
      </pre>
    </div>
  );
}
