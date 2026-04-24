import type { NextConfig } from "next";
import createMdx from "@next/mdx";

import pelletHlTheme from "./lib/docs/shiki-theme.json" with { type: "json" };

const prettyCodeOptions = {
  // Custom monochromatic theme — navy for keywords, ink for defaults,
  // muted for comments. Matches Pellet HL brand v2 (no syntax rainbow).
  theme: pelletHlTheme,
  keepBackground: false,
  defaultLang: "plaintext",
};

// Turbopack requires plugins to be referenced by module-specifier string so
// it can serialize them through its loader system. Function references from
// `import rehypeSlug from "..."` trip the "does not have serializable options"
// error on dev start.
const withMdx = createMdx({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [
      ["rehype-slug", {}],
      ["rehype-pretty-code", prettyCodeOptions],
    ],
  },
});

const config: NextConfig = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  async redirects() {
    return [
      // docs.pellet.network is a vanity short-URL for pellet.network/docs.
      // Path-preserving 307 redirect — typing docs.pellet.network/architecture
      // sends you to pellet.network/docs/architecture. One canonical URL for
      // SEO, zero middleware complexity.
      {
        source: "/:path*",
        has: [{ type: "host", value: "docs.pellet.network" }],
        destination: "https://pellet.network/docs/:path*",
        permanent: false,
      },
    ];
  },
};

export default withMdx(config);
