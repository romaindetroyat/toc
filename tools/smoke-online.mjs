// Smoke run of the online tables, the accounts and the installable app against a running Worker
// (plans 02-10 and 04-12): the deployed site, or a local `wrangler dev`.
//
//   node tools/smoke-online.mjs [base-url] [--turns N] [--level 1-5] [--read-only] [--verbose]
//
// --verbose prints every frame the socket receives, with the time since the start.
// --read-only skips the two steps that create something (POST /api/tables and the WebSocket game that
// follows it): every other step only reads, and the login options are stateless (nothing written).
// Through the agent proxy, run it with NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt
// (/root/.ccr/README.md). base-url defaults to https://toc.romaindetroyat.workers.dev.
//
// HTTP steps (each must pass, else exit 1):
//   GET  /                     → 200, the app's HTML (<div id="app">)
//   POST /api/tables           → 201 { id } with a 22-character id
//   GET  /api/tables/<id>      → 200, status « lobby »
//   GET  /api/tables/<unknown> → 404
//   GET  /api/me (no cookie)   → 401 (plan 04-01: signed out)
//   GET  /api/push/key         → 200 { key } of 87 characters (the 65-byte VAPID public key); a 503
//                                « push-off » (no VAPID_PRIVATE_KEY secret yet) is reported, not failed
//   GET  /api/invitations/<random code> → 200 { state: "unknown" } (nothing written)
//   POST /api/auth/login/options with the site's Origin → 200, rpId = the site's host (nothing written)
//   GET  /sw.js                → 200 JavaScript, a cache-control that makes the browser revalidate it
//                                (no-cache on the deployed embedded Worker; max-age=0 with
//                                must-revalidate from the static assets of a local `wrangler dev`)
//   GET  /manifest.webmanifest → 200, orientation « landscape », lang « fr »
// WebSocket steps (best effort): hello with a random device token → welcome; sit bleu; the three other
// seats at Champion (level 5, or --level); start; pass a card and play N turns (default 3) with randomLegal on the
// page's own view while the Champions play; then « stop » (the table is saved, 30 days) and close.
// A socket that cannot open from here (a proxy refusing WebSockets) is reported, not failed; a socket
// that opens but breaks the protocol (no welcome, an error frame, no events after an act) fails.
// The table it creates is an ordinary saved table: it is deleted after 30 days without activity.

import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const load = (path) => import(pathToFileURL(resolve(root, path)).href);
const { PROTOCOL_VERSION, parseServerFrame, toBase64Url } = await load(
  "packages/protocol/src/index.ts",
);
const { randomLegal } = await load("packages/bots/src/index.ts");

const args = process.argv.slice(2).filter((arg) => arg !== "--verbose" && arg !== "--read-only");
const verbose = process.argv.includes("--verbose");
const readOnly = process.argv.includes("--read-only");
const t0 = Date.now();
/** The value after `--name`, or `fallback`; its index is skipped when looking for the base URL. */
const taken = new Set();
function option(name, fallback) {
  const at = args.indexOf(`--${name}`);
  if (at === -1) return fallback;
  taken.add(at).add(at + 1);
  return Number(args[at + 1]);
}
const turns = option("turns", 3);
const level = option("level", 5);
const base = (
  args.find((arg, i) => !arg.startsWith("--") && !taken.has(i)) ??
  "https://toc.romaindetroyat.workers.dev"
).replace(/\/$/, "");
if (!Number.isInteger(turns) || turns < 0 || !Number.isInteger(level) || level < 1 || level > 5) {
  console.error(
    "usage: node tools/smoke-online.mjs [base-url] [--turns N] [--level 1-5] [--read-only] [--verbose]",
  );
  process.exit(2);
}

let failed = 0;
function report(ok, step, detail) {
  if (!ok) failed += 1;
  console.log(`${ok ? "ok  " : "FAIL"} ${step}${detail ? ` — ${detail}` : ""}`);
}

async function http(method, path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    text,
    type: response.headers.get("content-type") ?? "",
    cache: response.headers.get("cache-control") ?? "",
  };
}

function json(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// --- HTTP ---
console.log(`smoke-online: ${base}`);
let id = null;
try {
  const home = await http("GET", "/");
  report(
    home.status === 200 && home.text.includes('<div id="app">'),
    "GET /",
    `${home.status} ${home.type}`,
  );

  let goodId = false;
  if (readOnly) {
    console.log("skip POST /api/tables and the WebSocket game — --read-only");
  } else {
    const created = await http("POST", "/api/tables", {});
    id = json(created.text)?.id ?? null;
    goodId = typeof id === "string" && /^[A-Za-z0-9_-]{22}$/.test(id);
    report(
      created.status === 201 && goodId,
      "POST /api/tables",
      `${created.status} ${created.text}`,
    );
  }

  if (goodId) {
    const summary = await http("GET", `/api/tables/${id}`);
    const status = json(summary.text)?.status;
    report(
      summary.status === 200 && status === "lobby",
      "GET /api/tables/<id>",
      `${summary.status} status ${status}`,
    );
  }

  // A well-formed id nobody created reaches the GameRoom and is answered 404 without being written.
  const unknown = toBase64Url(new Uint8Array(randomBytes(16)));
  const missing = await http("GET", `/api/tables/${unknown}`);
  report(missing.status === 404, "GET /api/tables/<unknown>", `${missing.status} ${missing.text}`);
} catch (error) {
  report(false, "HTTP", String(error?.cause ?? error));
}

// --- Accounts, push and the installable app (plan 04-12), HTTP, each must pass ---
try {
  const me = await http("GET", "/api/me");
  report(me.status === 401, "GET /api/me (no cookie)", `${me.status} ${me.text}`);

  const push = await http("GET", "/api/push/key");
  const key = json(push.text)?.key;
  if (push.status === 503 && json(push.text)?.error === "push-off") {
    console.log(
      "push-off GET /api/push/key — 503: no VAPID_PRIVATE_KEY secret yet (not counted as a failure)",
    );
  } else {
    report(
      push.status === 200 && typeof key === "string" && /^[A-Za-z0-9_-]{87}$/.test(key),
      "GET /api/push/key",
      `${push.status} key of ${typeof key === "string" ? key.length : 0} characters`,
    );
  }

  // A well-formed invitation code nobody made (and not the bootstrap code): unknown, nothing written.
  const code = toBase64Url(new Uint8Array(randomBytes(16)));
  const invitation = await http("GET", `/api/invitations/${code}`);
  const state = json(invitation.text)?.state;
  report(
    invitation.status === 200 && state === "unknown",
    "GET /api/invitations/<random code>",
    `${invitation.status} state ${state}`,
  );

  // The passkey sign-in options: stateless (a signed challenge, no D1 row), with the site's RP ID.
  const login = await http("POST", "/api/auth/login/options", {}, { Origin: base });
  const rpId = json(login.text)?.rpId;
  const host = new URL(base).hostname;
  report(
    login.status === 200 && rpId === host,
    "POST /api/auth/login/options",
    `${login.status} rpId ${rpId} (site ${host})`,
  );

  const sw = await http("GET", "/sw.js");
  const revalidates =
    /\bno-cache\b/.test(sw.cache) ||
    (/\bmax-age=0\b/.test(sw.cache) && /\bmust-revalidate\b/.test(sw.cache));
  report(
    sw.status === 200 && /javascript/.test(sw.type) && revalidates,
    "GET /sw.js",
    `${sw.status} ${sw.type}, cache-control « ${sw.cache} »`,
  );

  const manifest = await http("GET", "/manifest.webmanifest");
  const app = json(manifest.text);
  report(
    manifest.status === 200 && app?.orientation === "landscape" && app?.lang === "fr",
    "GET /manifest.webmanifest",
    `${manifest.status} ${manifest.type}, orientation ${app?.orientation}, lang ${app?.lang}`,
  );
} catch (error) {
  report(false, "HTTP", String(error?.cause ?? error));
}

// --- WebSocket, best effort ---
async function socketGame(tableId) {
  const url = `${base.replace(/^http/, "ws")}/ws/table/${tableId}`;
  if (typeof WebSocket !== "function")
    return { reached: false, detail: "no WebSocket in this Node" };
  const ws = new WebSocket(url);
  const frames = [];
  const waiters = [];
  let closed = null;
  ws.addEventListener("message", ({ data }) => {
    if (typeof data !== "string" || data === "pong") return;
    const frame = parseServerFrame(data);
    if (verbose) {
      const at = ((Date.now() - t0) / 1000).toFixed(1);
      const what =
        frame?.t === "events"
          ? `events ${frame.seq} turn ${frame.view.turn} ${frame.view.phase}`
          : (frame?.t ?? "unparsed");
      console.log(`  ${at} s  ${what}${frame?.t === "error" ? ` ${frame.code}` : ""}`);
    }
    if (frame === null) {
      frames.push({ t: "unparsed", data });
    } else {
      frames.push(frame);
    }
    for (const waiter of [...waiters]) waiter();
  });
  ws.addEventListener("close", ({ code }) => {
    closed = code;
    for (const waiter of [...waiters]) waiter();
  });

  const opened = await new Promise((done) => {
    ws.addEventListener("open", () => done(true), { once: true });
    ws.addEventListener("error", () => done(false), { once: true });
    setTimeout(() => done(false), 15_000);
  });
  if (!opened) return { reached: false, detail: `could not open ${url}` };

  const send = (frame) => ws.send(JSON.stringify(frame));
  // The heartbeat of the real client (PING_MS 20 s): without it the server closes a silent socket
  // after 75 s with 4000, and the Champions may think longer than that on the Free plan.
  const pinger = setInterval(() => ws.send("ping"), 20_000);
  /** The first frame from `from` on that matches, within `ms`. */
  function next(match, from, ms = 30_000, allowed = []) {
    return new Promise((done, fail) => {
      const timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(check), 1);
        fail(
          new Error(
            `timed out (last frames: ${frames
              .slice(-3)
              .map((f) => f.t)
              .join(", ")})`,
          ),
        );
      }, ms);
      function check() {
        const error = frames
          .slice(from)
          .find(
            (frame) =>
              frame.t === "unparsed" || (frame.t === "error" && !allowed.includes(frame.code)),
          );
        const found = frames
          .slice(from)
          .find((frame) => match(frame) || (frame.t === "error" && allowed.includes(frame.code)));
        if (found === undefined && error === undefined && closed === null) return;
        clearTimeout(timer);
        waiters.splice(waiters.indexOf(check), 1);
        if (found !== undefined) done(found);
        else if (error !== undefined) fail(new Error(`server answered ${JSON.stringify(error)}`));
        else fail(new Error(`socket closed ${closed}`));
      }
      waiters.push(check);
      check();
    });
  }

  const steps = [];
  try {
    let from = frames.length;
    send({
      t: "hello",
      v: PROTOCOL_VERSION,
      token: randomBytes(32).toString("base64url"),
      name: "Essai",
    });
    await next((frame) => frame.t === "welcome", from);
    steps.push("welcome");

    from = frames.length;
    send({ t: "sit", seat: "bleu" });
    await next((frame) => frame.t === "welcome" && frame.you.seat === "bleu", from);
    steps.push("assis en bleu");

    for (const seat of ["jaune", "rouge", "vert"]) {
      const table = frames.findLast((frame) => frame.t === "table" || frame.t === "welcome")?.table;
      if (table?.seats[seat].level === level) continue;
      from = frames.length;
      send({ t: "level", seat, level });
      await next((frame) => frame.t === "table" && frame.table.seats[seat].level === level, from);
    }
    steps.push(`trois ordinateurs de force ${level}`);

    from = frames.length;
    send({ t: "start" });
    let latest = await next((frame) => frame.t === "events", from);
    steps.push("partie lancée");

    let rng = [20261017, 3, 5, 7];
    let acts = 0;
    let stale = 0;
    /** The longest wait for the next frame of play while the Champions were due, in ms. */
    let longest = 0;
    const started = Date.now();
    /** The latest snapshot of the game this socket got: an events frame or a welcome. */
    const current = () => frames.findLast((frame) => frame.t === "events" || frame.t === "welcome");
    while (acts < turns + 1) {
      latest = current();
      const view = latest.view;
      if (view.phase === "won") break;
      const due =
        view.phase === "exchange"
          ? view.given === null
          : view.phase === "play" && view.turn === "bleu";
      if (!due) {
        // The computers think (a Champion in slices, one alarm each, on the Free plan): wait for the next frame of play.
        from = frames.length;
        const waitStart = Date.now();
        await next((frame) => frame.t === "events" || frame.t === "welcome", from, 120_000);
        longest = Math.max(longest, Date.now() - waitStart);
        continue;
      }
      let action;
      [action, rng] = randomLegal(view, "bleu", rng);
      from = frames.length;
      send({ t: "act", base: latest.seq, action });
      // Our own move shows in our view: the card given, or the turn gone on. A Champion's give that
      // came first makes the act stale: the server sends a fresh welcome, and we choose again.
      const answer = await next(
        (frame) =>
          frame.t === "events" &&
          frame.seq > latest.seq &&
          (view.phase === "exchange"
            ? frame.view.given !== null || frame.view.phase !== "exchange"
            : frame.view.turn !== "bleu" || frame.view.hand.length < view.hand.length),
        from,
        30_000,
        ["stale"],
      );
      if (answer.t === "error") {
        stale += 1;
        await next((frame) => frame.t === "welcome", from);
        continue;
      }
      acts += 1;
    }
    steps.push(
      `${acts} actions jouées, la carte passée comprise, en ${Math.round((Date.now() - started) / 1000)} s (${stale} coup(s) en retard rejoué(s)), attente la plus longue d’un ordinateur ${(longest / 1000).toFixed(1)} s`,
    );

    send({ t: "stop" });
    steps.push("partie arrêtée (sauvegardée)");
    clearInterval(pinger);
    ws.close(1000, "smoke");
    return { reached: true, ok: true, detail: steps.join(", ") };
  } catch (error) {
    clearInterval(pinger);
    ws.close(1000, "smoke");
    return { reached: true, ok: false, detail: `${steps.join(", ")} — ${error.message}` };
  }
}

if (id !== null) {
  const game = await socketGame(id);
  if (!game.reached) {
    console.log(`skip WebSocket — ${game.detail} (not counted as a failure)`);
  } else {
    report(game.ok, "WebSocket", game.detail);
  }
}

console.log(failed === 0 ? "smoke-online: all checks passed" : `smoke-online: ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
