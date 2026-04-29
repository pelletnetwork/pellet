import { test, expect } from "@playwright/test";

test("home renders header with OLI framing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header")).toContainText("pellet");
  await expect(page.locator("header")).toContainText("open-ledger interface");
  await expect(page.locator("header")).toContainText("tempo");
});

test("favicon serves", async ({ request }) => {
  const res = await request.get("/icon.png");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/png");
});

test("brand mark serves as svg", async ({ request }) => {
  const res = await request.get("/pellet-mark.svg");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("svg");
});

test("agents api returns json with the seeded list", async ({ request }) => {
  const res = await request.get("/api/agents");
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(Array.isArray(json.agents)).toBe(true);
  expect(json.agents.length).toBeGreaterThan(0);
  expect(json.agents.map((a: { id: string }) => a.id)).toContain("pellet");
});

test("feed api responds with SSE content-type", async ({ baseURL }) => {
  // SSE streams stay open; we only need to confirm the response opened with
  // the right headers, then abort.
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 2000);
  try {
    const res = await fetch(`${baseURL}/api/feed`, { signal: ac.signal });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    ac.abort();
  } finally {
    clearTimeout(t);
  }
});
