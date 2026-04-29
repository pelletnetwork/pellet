// Bare hero video. No border, no chrome — just the clip.
// Autoplays muted on loop; on iOS playsInline keeps it in-flow rather than fullscreen.
export function Hero() {
  return (
    <video
      src="/hero.mp4"
      poster="/hero-poster.jpg"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className="block w-full"
    />
  );
}
