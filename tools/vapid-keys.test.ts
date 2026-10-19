// tools/vapid-keys.mjs (plan 04-07, T-04-55): a new VAPID secret on stdout, one line `d.x.y` (the
// P-256 private scalar and the public point, three base64url fields of 32 bytes), for a pipe into
// `wrangler secret put VAPID_PRIVATE_KEY`; `--public` reads such a line on stdin and prints the
// 65-byte raw public key. Nothing else is printed, nothing is written to a file, and a malformed
// input is never echoed.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TOOL = fileURLToPath(new URL("./vapid-keys.mjs", import.meta.url));

function run(args: string[], input?: string) {
  const done = spawnSync(process.execPath, [TOOL, ...args], {
    cwd: ROOT,
    input,
    encoding: "utf8",
  });
  return { status: done.status, stdout: done.stdout, stderr: done.stderr };
}

const fromBase64Url = (text: string) => Buffer.from(text, "base64url");
const FIELD = /^[A-Za-z0-9_-]{43}$/;

describe("tools/vapid-keys.mjs", () => {
  it("prints one new secret d.x.y and nothing else, and writes no file", () => {
    const before = readdirSync(ROOT).sort();
    const first = run([]);
    expect(first.status).toBe(0);
    expect(first.stderr).toBe("");
    expect(first.stdout.endsWith("\n")).toBe(true);
    const line = first.stdout.trimEnd();
    expect(line).not.toContain("\n");
    const parts = line.split(".");
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part).toMatch(FIELD);
      expect(fromBase64Url(part).length).toBe(32);
    }
    // A new pair every time.
    expect(run([]).stdout).not.toBe(first.stdout);
    expect(readdirSync(ROOT).sort()).toEqual(before);
  });

  it("--public prints the 65-byte raw public key of a secret read on stdin", async () => {
    const secret = run([]).stdout.trimEnd();
    const [, x, y] = secret.split(".") as [string, string, string];
    const done = run(["--public"], `${secret}\n`);
    expect(done.status).toBe(0);
    expect(done.stderr).toBe("");
    const key = done.stdout.trimEnd();
    expect(key).toMatch(/^[A-Za-z0-9_-]{87}$/);
    const raw = fromBase64Url(key);
    expect(raw.length).toBe(65);
    expect(raw[0]).toBe(4);
    expect(raw.subarray(1, 33).toString("base64url")).toBe(x);
    expect(raw.subarray(33).toString("base64url")).toBe(y);
    // The pair is a real one: the private part signs, the public part verifies.
    const [d] = secret.split(".") as [string];
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", d, x, y },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    const publicKey = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const data = new TextEncoder().encode("toc");
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      data,
    );
    expect(
      await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, signature, data),
    ).toBe(true);
  });

  it("a malformed input exits 1 without echoing it", () => {
    const secret = run([]).stdout.trimEnd();
    const [d, x] = secret.split(".") as [string, string];
    for (const bad of [
      "",
      "not-a-key",
      `${d}.${x}`,
      `${d}.${x}.${x}.${x}`,
      `${d}.${x}.${"A".repeat(42)}`,
      `${d}.${x}.${"A".repeat(43)}`,
      `${d}!.${x}.${x}`,
    ]) {
      const done = run(["--public"], bad);
      expect(done.status, bad).toBe(1);
      expect(done.stdout).toBe("");
      if (bad !== "") expect(done.stderr).not.toContain(bad);
      expect(done.stderr).not.toContain(d);
    }
  });

  it("an unknown option exits 1", () => {
    const done = run(["--private"]);
    expect(done.status).toBe(1);
    expect(done.stdout).toBe("");
  });
});
