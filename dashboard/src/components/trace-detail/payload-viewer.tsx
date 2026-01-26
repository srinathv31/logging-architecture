"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

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
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground italic">No data</p>
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
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">
        {displayContent}
      </pre>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </div>
  );
}
