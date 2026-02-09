"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TraceDetailError() {
  const router = useRouter();

  return (
    <div className="py-16 text-center space-y-4">
      <div className="flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
      </div>
      <h1 className="text-2xl font-bold">Failed to Load Trace</h1>
      <p className="text-muted-foreground">
        Something went wrong while loading the trace details.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Button variant="outline" onClick={() => router.refresh()}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Try again
        </Button>
        <Link href="/">
          <Button variant="outline">&larr; Back to traces</Button>
        </Link>
      </div>
    </div>
  );
}
