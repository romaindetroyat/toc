import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { DEBUG } from "./debug.ts";

if (DEBUG) {
  window.__tocDebug = { audio: { scheduled: [], history: [] } };
}

const target = document.getElementById("app");
if (!target) throw new Error("#app is missing from index.html");
mount(App, { target });
