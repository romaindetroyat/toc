#!/usr/bin/env node
// The VAPID key of the push notifications (plan 04-07, RFC 8292, T-04-55): one P-256 pair kept in ONE
// Worker secret, VAPID_PRIVATE_KEY, as `d.x.y` (the private scalar and the public point, three
// base64url fields of 32 bytes). The Worker derives the public key from it (GET /api/push/key), so the
// deploy never edits a config file and the two halves cannot drift apart.
//
//   node tools/vapid-keys.mjs              prints a new secret on stdout, one line, nothing else
//   node tools/vapid-keys.mjs --public     reads a secret on stdin, prints its 65-byte raw public key
//
// The secret is never written to a file and never shown: the deploy pipes it straight into Wrangler
// (plan 04-12):
//
//   node tools/vapid-keys.mjs | $CF secret put VAPID_PRIVATE_KEY -c wrangler.embarque.jsonc
//
// Changing it later makes every device subscribe again. A malformed input exits 1 without echoing it.

const FIELD = /^[A-Za-z0-9_-]{43}$/;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function create() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  process.stdout.write(`${jwk.d}.${jwk.x}.${jwk.y}\n`);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function publicOf() {
  const parts = (await readStdin()).trim().split(".");
  if (parts.length !== 3 || !parts.every((part) => FIELD.test(part))) {
    fail("vapid-keys: not a VAPID secret (d.x.y, three base64url fields of 32 bytes)");
  }
  const [d, x, y] = parts;
  const bytes = parts.map((part) => Buffer.from(part, "base64url"));
  if (!bytes.every((each) => each.length === 32)) {
    fail("vapid-keys: not a VAPID secret (each field must hold 32 bytes)");
  }
  try {
    // The point must be on the curve and the scalar must match it: sign, then verify with x and y.
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", d, x, y },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
    const raw = Buffer.concat([Buffer.from([4]), bytes[1], bytes[2]]);
    const publicKey = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const data = new TextEncoder().encode("vapid-keys");
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      data,
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signature,
      data,
    );
    if (!ok) fail("vapid-keys: the private and public parts do not match");
    process.stdout.write(`${raw.toString("base64url")}\n`);
  } catch {
    fail("vapid-keys: not a valid P-256 key");
  }
}

const args = process.argv.slice(2);
if (args.length === 0) await create();
else if (args.length === 1 && args[0] === "--public") await publicOf();
else fail("usage: node tools/vapid-keys.mjs [--public]");
