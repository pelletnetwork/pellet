import type { ReactNode } from "react";

/**
 * Big mono section header — `<h1>NN Title</h1>` rendered top-left of each
 * /oli page. Mirrors the Commit Mono specimen's `01 Home  02 Concept`
 * numbering. The number is a 2-digit zero-padded string so `1` renders as
 * `01`. Optional `eyebrow` prints a tiny mono label above (e.g. "Reference").
 */
export function SectionTitle({
  number,
  title,
  eyebrow,
  description,
  trailing,
}: {
  number: number | string;
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  trailing?: ReactNode;
}) {
  const padded =
    typeof number === "string"
      ? number
      : String(number).padStart(2, "0");

  return (
    <header className="oli-page-header">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {eyebrow ? <span className="oli-meth-kicker">{eyebrow}</span> : null}
        <h1 className="oli-section-title">
          <span className="oli-section-number">{padded}</span>
          <span className="oli-section-title-text">{title}</span>
        </h1>
        {description ? (
          <p style={{ marginTop: 4 }}>
            {description}
          </p>
        ) : null}
      </div>
      {trailing ? <div>{trailing}</div> : null}
    </header>
  );
}
