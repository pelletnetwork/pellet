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

// Embeds the canonical /docs/wallet-cli MDX inside the OLI shell so users
// reading OLI can pull up the CLI reference without leaving the sidebar
// context. Same source file, different shell.
export default async function OliEmbeddedCliPage() {
  const page = source.getPage(["wallet-cli"]);
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
  const page = source.getPage(["wallet-cli"]);
  if (!page) return { title: "CLI" };
  return {
    title: page.data.title,
    description: page.data.description,
  };
}
