import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TraceNotFound() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold">Trace Not Found</h1>
      <p className="text-muted-foreground">
        The trace you are looking for does not exist or has been deleted.
      </p>
      <Link href="/">
        <Button variant="outline">&larr; Back to traces</Button>
      </Link>
    </div>
  );
}
