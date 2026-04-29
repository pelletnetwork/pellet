import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Feed } from "@/components/feed";
import { listActiveAgents } from "@/lib/db/agents";

export const dynamic = "force-dynamic";

export default async function Page() {
  const agents = await listActiveAgents();
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Header agentCount={agents.length} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="grid gap-6 md:grid-cols-[1fr_360px]">
          <div className="space-y-2 md:order-first">
            <Feed />
          </div>
          <aside className="md:order-last">
            <Hero />
          </aside>
        </div>
      </div>
    </main>
  );
}
