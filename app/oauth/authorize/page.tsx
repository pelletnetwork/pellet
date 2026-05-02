import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import {
  buildErrorRedirect,
  readAuthorizeParams,
  validateAuthorizeRequest,
} from "@/lib/oauth/authorize";
import { describeScope } from "@/lib/oauth/scopes";
import { SpecimenConsent } from "./SpecimenConsent";

export const metadata: Metadata = {
  title: "Authorize agent — Pellet",
  description: "Approve an agent's access to your Pellet wallet.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SearchParams = Record<string, string | string[] | undefined>;

function flat(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const flatVal = flat(v);
    if (flatVal !== null) search.set(k, flatVal);
  }

  const req = readAuthorizeParams(search);
  const validation = await validateAuthorizeRequest(req);

  if (!validation.ok) {
    if (validation.error.kind === "redirect") {
      redirect(buildErrorRedirect(validation.error));
    }
    return (
      <main className="spec-oauth-frame">
        <section className="spec-oauth-card">
          <h1 className="spec-oauth-title">authorize agent</h1>
          <p className="spec-oauth-error">
            {validation.error.message}
          </p>
        </section>
      </main>
    );
  }

  const { client, scopes, state, codeChallenge, codeChallengeMethod, redirectUri, audience } =
    validation.value;

  // Require user signed-in via wallet cookie. Redirect to sign-in with a
  // returnTo that brings them back to this exact /authorize URL.
  const userId = await readUserSession();
  if (!userId) {
    const returnTo = `/oauth/authorize?${search.toString()}`;
    redirect(`/oli/wallet/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return (
    <main className="spec-oauth-frame">
      <SpecimenConsent
        clientName={client.clientName}
        clientId={client.clientId}
        redirectUri={redirectUri}
        audience={audience}
        scopes={scopes.map((s) => ({ name: s, description: describeScope(s) }))}
        state={state}
        codeChallenge={codeChallenge}
        codeChallengeMethod={codeChallengeMethod}
      />
    </main>
  );
}
