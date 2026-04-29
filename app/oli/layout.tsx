import { Sidebar } from "@/components/oli/Sidebar";
import { CommandBar } from "@/components/oli/CommandBar";

export const metadata = {
  title: "Pellet OLI — Open-Ledger Interface for Tempo",
};

export default function OliLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="oli-layout-shell" style={{ display: "flex", minHeight: "100vh", background: "var(--color-bg-base)" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <CommandBar />
    </div>
  );
}
