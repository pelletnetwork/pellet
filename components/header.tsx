import { PelletMark } from "./pellet-mark";
import { StatusIndicator } from "./status-indicator";

type Props = {
  agentCount: number;
};

export function Header({ agentCount }: Props) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <PelletMark size={20} />
          <span className="text-sm tracking-tight text-fg">
            pellet <span className="text-muted">// agentics terminal · sol</span>
          </span>
        </div>
        <StatusIndicator state="live" label={`${agentCount} agents · live`} />
      </div>
    </header>
  );
}
