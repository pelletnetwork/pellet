"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TIME_WINDOWS } from "@/lib/oli/timeWindow";

const WINDOWS = TIME_WINDOWS;

export function TimeWindowToggle({ current }: { current: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setWindow = (hours: number) => {
    const params = new URLSearchParams(searchParams);
    if (hours === 24) {
      params.delete("w");
    } else {
      const opt = WINDOWS.find((w) => w.value === hours);
      if (opt) params.set("w", opt.label);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="oli-time-toggle">
      {WINDOWS.map((w) => (
        <button
          key={w.value}
          type="button"
          onClick={() => setWindow(w.value)}
          className={`oli-time-toggle-btn${current === w.value ? " oli-time-toggle-btn-active" : ""}`}
          aria-pressed={current === w.value}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}

// Re-export for convenience (server components should import from @/lib/oli/timeWindow directly).
export { windowHoursFromParam } from "@/lib/oli/timeWindow";
