import { setTimeout as sleep } from "node:timers/promises";
import { defaultBaseUrl, readSession, writeSession, clearSession } from "../config.js";

const POLL_TIMEOUT_MS = 6 * 60 * 1000; // 6 min — pairing TTL is 5

type StartResponse = {
  code: string;
  device_id: string;
  approve_url: string;
  expires_at: string;
  poll_interval_seconds: number;
};

type PollResponseApproved = {
  status: "approved";
  bearer_token: string;
  session_expires_at: string;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  label: string | null;
};

type PollResponse =
  | { status: "pending" }
  | { status: "claimed" }
  | { status: "expired" }
  | PollResponseApproved;

export async function authStart(opts: { agentLabel?: string; baseUrl?: string }): Promise<number> {
  const baseUrl = opts.baseUrl ?? defaultBaseUrl();

  process.stdout.write(`\n  ${dim("Starting connection…")}\n`);
  process.stdout.write(`  └ ${dim("Calling pellet auth start")}\n\n`);

  let started: StartResponse;
  try {
    const res = await fetch(`${baseUrl}/api/wallet/device/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent_label: opts.agentLabel ?? null }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`failed to start pairing (${res.status}): ${detail}`);
      return 1;
    }
    started = (await res.json()) as StartResponse;
  } catch (e) {
    console.error("network error starting pairing:", e instanceof Error ? e.message : String(e));
    return 1;
  }

  process.stdout.write(`  Visit ${accent(started.approve_url)}\n`);
  process.stdout.write(`  and follow the instructions to connect your Pellet wallet.\n`);
  process.stdout.write(`  When prompted, verify or enter the following passphrase:\n`);
  process.stdout.write(`  ${accent(started.code)}\n\n`);
  process.stdout.write(`  ${dim("Waiting for approval…")}`);

  const interval = Math.max(1, started.poll_interval_seconds) * 1000;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(interval);
    process.stdout.write(".");

    let poll: PollResponse;
    try {
      const res = await fetch(
        `${baseUrl}/api/wallet/device/poll?device_id=${encodeURIComponent(started.device_id)}`,
      );
      if (!res.ok) {
        // 4xx/5xx shouldn't be treated as terminal — keep polling unless 404.
        if (res.status === 404) {
          process.stdout.write("\n");
          console.error("\npairing not found — try again");
          return 1;
        }
        continue;
      }
      poll = (await res.json()) as PollResponse;
    } catch {
      continue;
    }

    if (poll.status === "pending") continue;

    process.stdout.write("\n\n");

    if (poll.status === "expired") {
      console.error("  pairing expired — run `pellet auth start` again");
      return 1;
    }

    if (poll.status === "claimed") {
      console.error("  pairing was already claimed by another device");
      return 1;
    }

    // approved — store the session
    await writeSession({
      bearer: poll.bearer_token,
      baseUrl,
      label: poll.label,
      spendCapWei: poll.spend_cap_wei,
      perCallCapWei: poll.per_call_cap_wei,
      expiresAt: poll.session_expires_at,
      pairedAt: new Date().toISOString(),
    });

    process.stdout.write(`  ${ok("✓")} approved.\n`);
    process.stdout.write(`  ${dim("session label:")} ${poll.label ?? "—"}\n`);
    process.stdout.write(`  ${dim("spend cap:    ")} $${formatUsd(poll.spend_cap_wei)}\n`);
    process.stdout.write(`  ${dim("per-call cap: ")} $${formatUsd(poll.per_call_cap_wei)}\n`);
    process.stdout.write(`  ${dim("expires:      ")} ${poll.session_expires_at}\n\n`);
    process.stdout.write(`  ${dim("config saved to ~/.pellet/config.json")}\n`);
    return 0;
  }

  process.stdout.write("\n");
  console.error("  timed out waiting for approval");
  return 1;
}

export async function authStatus(): Promise<number> {
  const s = await readSession();
  if (!s) {
    console.error("no active session — run `pellet auth start`");
    return 1;
  }
  process.stdout.write(`\n  ${dim("session label:")} ${s.label ?? "—"}\n`);
  process.stdout.write(`  ${dim("base url:     ")} ${s.baseUrl}\n`);
  process.stdout.write(`  ${dim("spend cap:    ")} $${formatUsd(s.spendCapWei)}\n`);
  process.stdout.write(`  ${dim("per-call cap: ")} $${formatUsd(s.perCallCapWei)}\n`);
  process.stdout.write(`  ${dim("paired at:    ")} ${s.pairedAt}\n`);
  process.stdout.write(`  ${dim("expires:      ")} ${s.expiresAt}\n`);
  process.stdout.write(`  ${dim("bearer:       ")} ${s.bearer.slice(0, 10)}…${s.bearer.slice(-4)}\n\n`);
  return 0;
}

export async function authRevoke(): Promise<number> {
  await clearSession();
  process.stdout.write(`  ${ok("✓")} local bearer cleared. (server-side revoke ships in phase 3.)\n`);
  return 0;
}

function formatUsd(wei: string): string {
  const n = Number(wei) / 1_000_000;
  return n.toFixed(2);
}

function dim(s: string): string {
  return process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s;
}

function accent(s: string): string {
  return process.stdout.isTTY ? `\x1b[36m${s}\x1b[0m` : s;
}

function ok(s: string): string {
  return process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s;
}
