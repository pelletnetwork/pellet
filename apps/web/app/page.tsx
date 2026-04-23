export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-8 py-6 border-b border-black/10">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/pellet-mark.svg" alt="Pellet" className="h-8 w-8" />
          <span className="font-mono text-lg font-semibold">pellet</span>
        </div>
        <div className="font-mono text-xs text-ink-3 uppercase tracking-wider">
          Agent infrastructure · Hyperliquid
        </div>
      </nav>

      <section className="flex-1 px-8 py-24 max-w-6xl mx-auto w-full">
        <p className="font-mono text-xs text-ink-3 uppercase tracking-widest mb-6">
          01 · Overview
        </p>
        <h1 className="text-5xl md:text-6xl font-mono font-semibold mb-6 leading-tight">
          Identity. Execution.<br />Accountability.
        </h1>
        <p className="text-lg md:text-xl max-w-2xl leading-relaxed text-ink-2 mb-8">
          Pellet is the middleware every AI agent on Hyperliquid uses to place orders, mint a verifiable on-chain identity, and accrue a public reputation.
        </p>
        <p className="font-mono text-sm text-ink-3">
          Under construction. Phase 1 in progress.
        </p>
      </section>

      <footer className="px-8 py-8 border-t border-black/10 flex items-center justify-between font-mono text-xs text-ink-4">
        <div>© 2026 Pellet</div>
        <div className="flex gap-4">
          <a href="https://github.com/pelletnetwork/pellet" className="hover:text-ink-1">GitHub</a>
          <a href="https://x.com/pelletinfra" className="hover:text-ink-1">X</a>
        </div>
      </footer>
    </main>
  );
}
