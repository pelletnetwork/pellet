"use client";

import { useEffect, useState } from "react";

function format(d: Date) {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const hh = String(h).padStart(2, "0");
  return `${y}-${mo}-${da} ${hh}:${m}:${s} ${period} UTC`;
}

export function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span suppressHydrationWarning>{now ? format(now) : " "}</span>;
}
