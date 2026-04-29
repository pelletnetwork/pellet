import { Header } from "@/components/header";

export default function Page() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <Header agentCount={0} />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <p className="text-muted text-sm">no events yet · waiting for agents</p>
      </div>
    </main>
  );
}
