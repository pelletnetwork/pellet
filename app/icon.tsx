import { ImageResponse } from "next/og";

// Dynamic favicon at /icon. Renders a bold "P" glyph in mono on black —
// at 32px the full SVG mark loses too much detail to read, so we use the
// monogram letter for the favicon and keep the full mark for larger surfaces
// via <PelletMark/>.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
          fontSize: 24,
          fontFamily: "ui-monospace, monospace",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        P
      </div>
    ),
    { ...size },
  );
}
