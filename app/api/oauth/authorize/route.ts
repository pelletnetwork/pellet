import { NextResponse } from "next/server";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { isAllowedRedirectUri, resolveClient } from "@/lib/oauth/clients";
import { isSupportedMethod, isValidChallenge } from "@/lib/oauth/pkce";
import { issueAuthorizationCode } from "@/lib/oauth/codes";
import { issuerUrl, mcpResourceUrl } from "@/lib/oauth/issuer";
import { isValidScope, type ScopeName } from "@/lib/oauth/scopes";
import {
  buildErrorRedirect,
  buildSuccessRedirect,
} from "@/lib/oauth/authorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/oauth/authorize
//
// Cookie-auth'd. The consent UI POSTs here with the user's decision plus
// the request params (echoed from the original /authorize URL so the
// client never has to round-trip through a server-only state cache).
//
// On approve: mints an authorization code, returns the redirect URL with
// ?code=...&state=...&iss=...
// On deny: returns the redirect URL with ?error=access_denied&state=...
//
// We re-validate ALL params on the server side — never trust the consent
// UI to be honest. The user's signed-in cookie is the only thing we trust
// from the request envelope.

type Decision = "approve" | "deny";

type Body = {
  decision?: unknown;
  clientId?: unknown;
  redirectUri?: unknown;
  audience?: unknown;
  scopes?: unknown;
  state?: unknown;
  codeChallenge?: unknown;
  codeChallengeMethod?: unknown;
};

export async function POST(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400 });
  }

  const decision = body.decision as Decision;
  if (decision !== "approve" && decision !== "deny") {
    return NextResponse.json({ error: "decision must be 'approve' or 'deny'" }, { status: 400 });
  }
  if (typeof body.clientId !== "string" || typeof body.redirectUri !== "string") {
    return NextResponse.json({ error: "clientId and redirectUri are required" }, { status: 400 });
  }
  const stateStr =
    typeof body.state === "string" ? body.state : body.state == null ? null : null;

  // Re-validate client + redirect_uri server-side.
  const client = await resolveClient(body.clientId);
  if (!client) {
    return NextResponse.json({ error: "unknown client" }, { status: 400 });
  }
  if (!isAllowedRedirectUri(client, body.redirectUri)) {
    return NextResponse.json({ error: "redirect_uri not registered" }, { status: 400 });
  }

  if (decision === "deny") {
    return NextResponse.json({
      redirectUri: buildErrorRedirect({
        kind: "redirect",
        redirectUri: body.redirectUri,
        state: stateStr,
        error: "access_denied",
        description: "user denied authorization",
      }),
    });
  }

  // Approve path — re-validate everything else.
  if (
    typeof body.codeChallenge !== "string" ||
    !isValidChallenge(body.codeChallenge) ||
    typeof body.codeChallengeMethod !== "string" ||
    !isSupportedMethod(body.codeChallengeMethod)
  ) {
    return NextResponse.json({ error: "invalid PKCE params" }, { status: 400 });
  }
  if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
    return NextResponse.json({ error: "at least one scope required" }, { status: 400 });
  }
  const scopes: ScopeName[] = [];
  for (const s of body.scopes) {
    if (typeof s !== "string" || !isValidScope(s)) {
      return NextResponse.json({ error: `invalid scope: ${String(s)}` }, { status: 400 });
    }
    scopes.push(s);
  }
  const audience = typeof body.audience === "string" ? body.audience : mcpResourceUrl();
  if (audience !== mcpResourceUrl()) {
    return NextResponse.json({ error: "invalid audience" }, { status: 400 });
  }

  const { code } = await issueAuthorizationCode({
    clientId: client.clientId,
    userId,
    redirectUri: body.redirectUri,
    scopes,
    audience,
    codeChallenge: body.codeChallenge,
    codeChallengeMethod: body.codeChallengeMethod,
  });

  return NextResponse.json({
    redirectUri: buildSuccessRedirect(body.redirectUri, code, stateStr, issuerUrl()),
  });
}
