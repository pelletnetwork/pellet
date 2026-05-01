import type { Metadata } from "next";
import { SpecimenShell } from "@/components/specimen/SpecimenShell";
import "./specimen.css";

export const metadata: Metadata = {
  title: "Specimen — Pellet",
  description: "Specimen sheet for the Pellet OLI dashboard.",
};

export default function SpecimenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SpecimenShell>{children}</SpecimenShell>;
}
