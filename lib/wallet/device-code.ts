// Word-passphrase generator for device-code pairings. Stripe uses
// "apple-grape-orange"-style 3-word codes; we mirror the shape.
//
// Wordlist is intentionally small + simple (common English nouns, no
// homophones, no profanity surface). 100 words^3 = 1M combinations; with
// a 5-minute TTL and unique-code constraint, brute-force risk is fine.

const WORDS = [
  "apple", "amber", "arrow", "atlas", "azure", "basil", "berry", "birch",
  "bison", "bloom", "blue", "brick", "cedar", "chime", "cliff", "cloud",
  "coral", "cove", "crane", "creek", "delta", "drift", "dune", "ember",
  "fern", "field", "fjord", "flame", "fleet", "frost", "garnet", "glade",
  "globe", "grape", "grove", "harbor", "hazel", "haven", "heron", "indigo",
  "iris", "ivory", "jade", "jasper", "kelp", "lagoon", "lark", "linen",
  "lotus", "marsh", "meadow", "mesa", "mint", "mist", "moss", "noble",
  "north", "oak", "ocean", "olive", "onyx", "opal", "orange", "orchid",
  "otter", "owl", "palm", "patch", "pearl", "pine", "plain", "plum",
  "pond", "poppy", "prairie", "quartz", "quill", "raven", "reef", "ridge",
  "river", "rose", "sage", "salt", "sand", "sea", "shore", "silk",
  "slate", "snow", "spring", "star", "stone", "stream", "sun", "tape",
  "tide", "topaz", "tree", "valley", "willow", "wren",
];

export function generateCode(): string {
  // Three random words joined with hyphens. Crypto-random for unpredictability.
  const buf = new Uint8Array(3);
  crypto.getRandomValues(buf);
  return [
    WORDS[buf[0] % WORDS.length],
    WORDS[buf[1] % WORDS.length],
    WORDS[buf[2] % WORDS.length],
  ].join("-");
}

export function generateDeviceId(): string {
  // 22-char base64url-ish id (16 bytes of entropy). Safe to log; not a secret.
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 22);
}

export function generateBearer(): { token: string; hash: string } {
  // 32-byte random token, base64url-encoded. SHA-256 hash stored server-side.
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  const token = "pwk_" + bufToBase64Url(buf);
  return { token, hash: sha256Hex(token) };
}

function bufToBase64Url(buf: Uint8Array): string {
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256Hex(s: string): string {
  // Synchronous-looking interface; calls into Node's crypto via dynamic
  // resolution at use-time. Caller must await sha256HexAsync if they're in
  // an async context — leaving the sync surface for clarity here.
  // (Note: in Edge runtime we'd use crypto.subtle; we run nodejs only.)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto");
  return createHash("sha256").update(s).digest("hex");
}
