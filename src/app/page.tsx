import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-semibold">memmgmt</h1>
      <p className="mt-2 text-neutral-500">
        Local-only manager for your Claude Code configuration surface.
      </p>
      <Button className="mt-4">OK</Button>
    </main>
  );
}
