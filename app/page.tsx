import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { EventCard } from "@/components/event-card";

export default function Page() {
  const now = new Date().toISOString();
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Header agentCount={1} />
      <div className="mx-auto max-w-3xl space-y-2 px-4 py-6 sm:px-6">
        <Hero />
        <EventCard
          event={{
            id: "sample-1",
            agentId: "pellet",
            agentLabel: "pellet",
            ts: now,
            kind: "custom",
            summary: "terminal initialized · waiting for upstream events",
            txSig: null,
            isPellet: true,
          }}
        />
        <EventCard
          event={{
            id: "sample-2",
            agentId: "aixbt",
            agentLabel: "aixbt",
            ts: now,
            kind: "swap",
            summary: "aixbt swapped 3.2 SOL → 12,400 $WIF via Jupiter",
            txSig: "5kF2aBcDef1234567890abcdEf1234567890aB91",
          }}
        />
      </div>
    </main>
  );
}
