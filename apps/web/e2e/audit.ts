import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { deniedWords } from "../src/i18n/denyList.ts";

/**
 * The accessibility audit of one surface (plan 05-10, UI-SPEC « The audit », APP-05), shared by
 * e2e/accessibilite.spec.ts and e2e-online/accessibilite.spec.ts. It returns the findings, one line
 * each (« surface · check · element »), for the test to assert empty:
 * - axe, with the WCAG 2.0 / 2.1 A and AA rules, on the rendered page in reduced motion (no contrast
 *   read in the middle of a fade). The board drawing (`[data-board-art]`, its numbers are decorative)
 *   is the one part left out; disabled controls are left out of `color-contrast` by axe itself. These
 *   are the UI-SPEC's two exemptions and the only ones;
 * - the project's own 44 px rule (cibles.spec.ts): every visible button, link, tab, switch, radio,
 *   card, chip, row, field and knight hit circle measures at least 44 x 44, 0.2 px tolerance, no
 *   exception (axe's `target-size` is WCAG 2.2's 24 px, weaker);
 * - every interactive element has a non-empty accessible name;
 * - no visible text, accessible name, `title` or `alt` matches the English deny-list;
 * - one `main`, one h1, `<html lang="fr">`.
 */

const MIN = 44;
/** Layout rounding: a box of 43.9 px is a 44 px box (cibles.spec.ts). */
const TOLERANCE = 0.2;

/** What the page measures for one interactive element. */
type Target = {
  what: string;
  width: number;
  height: number;
  name: string;
};

/**
 * Every visible interactive element of the page, with its box and its accessible name (computed as a
 * browser does for the cases this app uses: aria-labelledby, aria-label, a field's label, the text
 * content with images' alt, then the title).
 */
function targetsOf(page: Page): Promise<Target[]> {
  return page.evaluate(() => {
    const SELECTOR = [
      "button",
      "a[href]",
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "summary",
      "[role='button']",
      "[role='link']",
      "[role='tab']",
      "[role='switch']",
      "[role='radio']",
      "[role='checkbox']",
      "[role='option']",
      "[role='menuitem']",
      "[data-card]",
      "[data-tray-option]",
      "[data-step]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    const textOf = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
      if (!(node instanceof Element)) return "";
      if (node.getAttribute("aria-hidden") === "true") return "";
      if (node instanceof HTMLElement && node.hidden) return "";
      const label = node.getAttribute("aria-label");
      if (label !== null && label.trim() !== "") return label;
      if (node instanceof HTMLImageElement) return node.alt;
      let text = "";
      for (const child of node.childNodes) text += ` ${textOf(child)}`;
      return text;
    };

    const nameOf = (el: Element): string => {
      const labelledby = el.getAttribute("aria-labelledby");
      if (labelledby) {
        const text = labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .map((ref) => (ref === null ? "" : textOf(ref)))
          .join(" ");
        if (text.trim() !== "") return text.trim();
      }
      const label = el.getAttribute("aria-label");
      if (label !== null && label.trim() !== "") return label.trim();
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        const labels = el.labels ? [...el.labels].map((l) => textOf(l)).join(" ") : "";
        if (labels.trim() !== "") return labels.trim();
      }
      // A knight's hit circle: its group carries the name.
      if (el instanceof SVGElement) {
        const group = el.closest("[aria-label]");
        if (group !== null) return group.getAttribute("aria-label")?.trim() ?? "";
      }
      const text = textOf(el).replace(/\s+/g, " ").trim();
      if (text !== "") return text;
      return el.getAttribute("title")?.trim() ?? "";
    };

    /** Shown on screen: a box, not hidden, not made invisible, not inside a closed or hidden part. */
    const shown = (el: Element): DOMRect | null => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return null;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return null;
      for (let up: Element | null = el; up !== null; up = up.parentElement) {
        const s = getComputedStyle(up);
        if (Number(s.opacity) === 0) return null;
        if (up.getAttribute("aria-hidden") === "true" && !(up instanceof SVGElement)) return null;
      }
      // The sr-only pattern (a 1 px clipped box) is for screen readers, not for fingers.
      if (box.width <= 1 && box.height <= 1) return null;
      return box;
    };

    const describe = (el: Element, name: string): string => {
      const hook = [...el.attributes]
        .filter((a) => a.name.startsWith("data-") || a.name === "role" || a.name === "href")
        .map((a) => (a.value === "" ? a.name : `${a.name}="${a.value}"`))
        .slice(0, 3)
        .join(" ");
      return `<${el.tagName.toLowerCase()}${hook ? ` ${hook}` : ""}> « ${name.slice(0, 60)} »`;
    };

    const result: { what: string; width: number; height: number; name: string }[] = [];
    const seen = new Set<Element>();
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (seen.has(el)) continue;
      seen.add(el);
      // The board's own parts are measured by their hit circles below (its felt button excepted).
      if (el.closest("[data-board-art]") !== null) continue;
      if (el.closest("[data-hit]") !== null) continue;
      const box = shown(el);
      if (box === null) continue;
      const name = nameOf(el);
      result.push({ what: describe(el, name), width: box.width, height: box.height, name });
    }
    // The knights' hit circles (cibles.spec.ts: « [data-hit] circle:not(.ring) »).
    for (const circle of document.querySelectorAll("[data-hit] circle:not(.ring)")) {
      const box = shown(circle);
      if (box === null) continue;
      const group = circle.closest("[data-hit]");
      const name = group === null ? "" : nameOf(group);
      result.push({
        what: describe(group ?? circle, name),
        width: box.width,
        height: box.height,
        name,
      });
    }
    return result;
  });
}

/** Every text a person can see or hear: visible text, accessible names, titles, alt texts, placeholders. */
function textsOf(page: Page): Promise<{ where: string; text: string }[]> {
  return page.evaluate(() => {
    const out: { where: string; text: string }[] = [
      { where: "texte visible", text: document.body.innerText },
    ];
    for (const el of document.querySelectorAll(
      "[aria-label], [title], [alt], [placeholder], [aria-description], [aria-valuetext]",
    )) {
      for (const attr of [
        "aria-label",
        "title",
        "alt",
        "placeholder",
        "aria-description",
        "aria-valuetext",
      ]) {
        const value = el.getAttribute(attr);
        if (value) out.push({ where: `${attr} de <${el.tagName.toLowerCase()}>`, text: value });
      }
    }
    for (const title of document.querySelectorAll("svg title")) {
      out.push({ where: "<title> svg", text: title.textContent ?? "" });
    }
    out.push({ where: "titre du document", text: document.title });
    return out;
  });
}

/**
 * Waits until no finite animation runs (reduced motion makes the endless ones still, and keeps the
 * fades): two quiet readings 100 ms apart, each after two frames, since a transition may start a frame
 * after the element it moves appears.
 */
async function settle(page: Page) {
  const deadline = Date.now() + 4000;
  let quiet = 0;
  while (Date.now() < deadline && quiet < 2) {
    const running = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              resolve(
                document.getAnimations().filter((a) => {
                  if (a.playState !== "running") return false;
                  const timing = a.effect?.getComputedTiming();
                  return timing !== undefined && timing.endTime !== Number.POSITIVE_INFINITY;
                }).length,
              ),
            ),
          );
        }),
    );
    quiet = running === 0 ? quiet + 1 : 0;
    await page.waitForTimeout(running === 0 ? 100 : 50);
  }
}

/**
 * Audits the page as it stands for `surface`; returns the findings (empty when the surface passes).
 * The caller opens the surface first; reduced motion is set here too, before the measures.
 */
export async function audit(page: Page, surface: string): Promise<string[]> {
  const size = page.viewportSize();
  const at = size ? ` à ${size.width} x ${size.height}` : "";
  const label = `${surface}${at}`;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settle(page);
  const findings: string[] = [];

  // axe, the WCAG 2.0 / 2.1 A and AA rules; the board drawing alone is left out.
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("[data-board-art]")
    .analyze();
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      const html = node.html.replace(/\s+/g, " ").slice(0, 200);
      findings.push(`${label} · axe ${violation.id} · ${node.target.join(" ")} · ${html}`);
    }
  }

  // 44 x 44 and a name, for every visible interactive element.
  for (const target of await targetsOf(page)) {
    if (target.width < MIN - TOLERANCE || target.height < MIN - TOLERANCE) {
      findings.push(
        `${label} · cible ${target.width.toFixed(1)} x ${target.height.toFixed(1)} · ${target.what}`,
      );
    }
    if (target.name === "") findings.push(`${label} · sans nom · ${target.what}`);
  }

  // French everywhere: no English word or leaked value, in what is shown and what is read out.
  for (const { where, text } of await textsOf(page)) {
    for (const word of deniedWords(text))
      findings.push(`${label} · mot interdit « ${word} » · ${where}`);
  }
  const tree = await page.locator("body").ariaSnapshot();
  for (const word of deniedWords(tree))
    findings.push(`${label} · mot interdit « ${word} » · arbre d’accessibilité`);

  // Structure: one main, one h1, the page in French.
  const structure = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    mains: document.querySelectorAll("main, [role='main']").length,
    h1s: document.querySelectorAll("h1, [role='heading'][aria-level='1']").length,
  }));
  if (structure.lang !== "fr") findings.push(`${label} · lang « ${structure.lang} »`);
  if (structure.mains !== 1) findings.push(`${label} · ${structure.mains} main`);
  if (structure.h1s !== 1) findings.push(`${label} · ${structure.h1s} h1`);

  return findings;
}
