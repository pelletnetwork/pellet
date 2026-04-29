type Props = {
  size?: number;
  className?: string;
  alt?: string;
};

// Renders the Pellet mark inline. Single import surface so we can update the
// brand mark in one place. Uses the static SVG in /public for caching.
export function PelletMark({ size = 24, className, alt = "pellet" }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/pellet-mark.svg"
      alt={alt}
      width={size}
      height={size}
      className={className}
    />
  );
}
