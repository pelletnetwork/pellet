// Hero video card. Matches the event-card aesthetic (border, mono header strip)
// so it reads as part of the feed rather than a marketing element. Autoplays
// muted on loop; on iOS playsInline keeps it in-flow rather than fullscreen.
export function Hero() {
  return (
    <article className="border border-border bg-bg">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs text-muted">
        <span>hero</span>
        <span className="inline-flex items-center gap-1">
          <span className="text-accent">⌁</span>
          loop
        </span>
      </header>
      <div className="aspect-video w-full overflow-hidden bg-black">
        <video
          src="/hero.mp4"
          poster="/hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </div>
    </article>
  );
}
