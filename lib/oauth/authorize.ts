// Shared validation for the /oauth/authorize endpoint.
// Server component (page.tsx) and POST handler both run this — same input,
// same checks, same outcomes.

import { isAllowedRedirectUri, resolveClient, type Client } from "./clients";
import { isSupportedMethod, isValidChallenge } from "./pkce";
import { mcpResourceUrl } from "./issuer";
import { parseScopeParam, type ScopeName } from "./scopes";

export type AuthorizeRequest = {
  responseType: string | null;
  clientId: string | null;
  redirectUri: string | null;
  scope: string | null;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  resource: string | null;
};

export function readAuthorizeParams(
  search: URLSearchParams,
): AuthorizeRequest {
  return {
    responseType: search.get("response_type"),
    clientId: search.get("client_id"),
    redirectUri: search.get("redirect_uri"),
    scope: search.get("scope"),
    state: search.get("state"),
    codeChallenge: search.get("code_challenge"),
    codeChallengeMethod: search.get("code_challenge_method"),
    resource: search.get("resource"),
  };
}

export type ValidatedAuthorizeRequest = {
  client: Client;
  redirectUri: string;
  scopes: ScopeName[];
  state: string | null;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  audience: string;
};

export type AuthorizeError =
  | { kind: "fatal"; message: string } // can't even safe-redirect; render error page
  | {
      kind: "redirect";
      redirectUri: string;
      state: string | null;
      error: string;
      description: string;
    };

// Two failure modes:
//   * 'fatal' — bad client_id or bad redirect_uri. We CAN'T redirect because
//     we don't trust the URI; render an error page instead. Per OAuth 2.1.
//   * 'redirect' — request was at least client+redirect-correct; report the
//     specific error to the client via redirect with ?error=...
export async function validateAuthorizeRequest(
  req: AuthorizeRequest,
): Promise<{ ok: true; value: ValidatedAuthorizeRequest } | { ok: false; error: AuthorizeError }> {
  if (!req.clientId) {
    return { ok: false, error: { kind: "fatal", message: "missing client_id" } };
  }
  if (!req.redirectUri) {
    return { ok: false, error: { kind: "fatal", message: "missing redirect_uri" } };
  }
  const client = await resolveClient(req.clientId);
  if (!client) {
    return { ok: false, error: { kind: "fatal", message: "unknown client_id" } };
  }
  if (!isAllowedRedirectUri(client, req.redirectUri)) {
    return { ok: false, error: { kind: "fatal", message: "redirect_uri not registered" } };
  }

  // From here, errors are reportable via redirect.
  const fail = (error: string, description: string): AuthorizeError => ({
    kind: "redirect",
    redirectUri: req.redirectUri!,
    state: req.state,
    error,
    description,
  });

  if (req.responseType !== "code") {
    return { ok: false, error: fail("unsupported_response_type", "only response_type=code") };
  }
  if (!req.codeChallenge || !isValidChallenge(req.codeChallenge)) {
    return { ok: false, error: fail("invalid_request", "code_challenge missing or malformed") };
  }
  if (!req.codeChallengeMethod || !isSupportedMethod(req.codeChallengeMethod)) {
    return { ok: false, error: fail("invalid_request", "code_challenge_method must be S256") };
  }

  const { scopes, invalid } = parseScopeParam(req.scope);
  if (invalid.length > 0) {
    return { ok: false, error: fail("invalid_scope", `unknown scope(s): ${invalid.join(", ")}`) };
  }
  if (scopes.length === 0) {
    return { ok: false, error: fail("invalid_scope", "at least one scope required") };
  }

  // Audience binding (RFC 8707). Only one resource accepted v1: the MCP URL.
  // Accept missing for now (treated as MCP) but recommend explicit binding.
  const audience = req.resource ?? mcpResourceUrl();
  if (audience !== mcpResourceUrl()) {
    return { ok: false, error: fail("invalid_target", "unknown resource — only the MCP server is supported") };
  }

  return {
    ok: true,
    value: {
      client,
      redirectUri: req.redirectUri,
      scopes,
      state: req.state,
      codeChallenge: req.codeChallenge,
      codeChallengeMethod: "S256",
      audience,
    },
  };
}

export function buildErrorRedirect(err: Extract<AuthorizeError, { kind: "redirect" }>): string {
  const u = new URL(err.redirectUri);
  u.searchParams.set("error", err.error);
  u.searchParams.set("error_description", err.description);
  if (err.state) u.searchParams.set("state", err.state);
  return u.toString();
}

export function buildSuccessRedirect(
  redirectUri: string,
  code: string,
  state: string | null,
  issuer: string,
): string {
  const u = new URL(redirectUri);
  u.searchParams.set("code", code);
  if (state) u.searchParams.set("state", state);
  u.searchParams.set("iss", issuer);
  return u.toString();
}
