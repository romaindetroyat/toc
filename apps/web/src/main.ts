import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { DEBUG } from "./debug.ts";
import { startInstall } from "./pwa/install.svelte.ts";
import { startUpdates } from "./pwa/update.svelte.ts";

if (DEBUG) {
  window.__tocDebug = { audio: { scheduled: [], history: [] } };
}

const target = document.getElementById("app");
if (!target) throw new Error("#app is missing from index.html");
mount(App, { target });

// The service worker and its update flow (plan 04-08): once per page, in every build (the PWA spec runs
// on the debug build); a refused registration is silent.
startUpdates();
// The install guidance (plan 04-08): listens for the browser's install prompt from the start.
startInstall();
