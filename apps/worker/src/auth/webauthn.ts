// The passkeys' relying party (plan 04-01, D-10; 04-RESEARCH Pattern 2). In production the RP ID and
// the expected origin come from the config only (vars RP_ID and ORIGIN, identical in both wrangler
// files, tools/wrangler-configs.test.ts), never from the request's Host: a passkey made for
// toc.romaindetroyat.workers.dev works there and nowhere else. Under TOC_TEST_MODE, and only for the
// test hosts toc.test (workerd tests) and localhost (wrangler dev for Playwright), the request's own
// host and origin are used instead.

export type RelyingParty = { id: string; origin: string; name: "TOC" };

const TEST_HOSTS = new Set(["toc.test", "localhost"]);

export function rpFor(url: URL, env: Env): RelyingParty {
  if (env.TOC_TEST_MODE === "1" && TEST_HOSTS.has(url.hostname)) {
    return { id: url.hostname, origin: url.origin, name: "TOC" };
  }
  return { id: env.RP_ID, origin: env.ORIGIN, name: "TOC" };
}
