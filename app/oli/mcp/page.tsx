import { source } from "@/lib/source";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// Embeds the canonical /docs/wallet-mcp MDX inside the OLI shell — same
// content as /docs/wallet-mcp, kept in lockstep because both pages read the
// same MDX source.
export default async function OliEmbeddedMcpPage() {
  const page = source.getPage(["wallet-mcp"]);
  if (!page) notFound();
  const MDXContent = page.data.body;
  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent components={defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const page = source.getPage(["wallet-mcp"]);
  if (!page) return { title: "MCP" };
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
