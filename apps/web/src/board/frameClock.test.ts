import { describe, expect, it } from "vitest";
import { animateNow } from "./frameClock.ts";

// The frame clock in the browser is checked in e2e/animations.spec.ts (« une image chargée au départ
// du cheval… »); here, with a fake target, that the start time is pinned and nothing else changes.

type FakeAnimation = { timeline: { currentTime: number | null } | null; startTime: number | null };

function target(timeline: FakeAnimation["timeline"]) {
  const calls: unknown[][] = [];
  const animation: FakeAnimation = { timeline, startTime: null };
  const element = {
    animate(...args: unknown[]) {
      calls.push(args);
      return animation;
    },
  } as unknown as Element;
  return { element, animation, calls };
}

describe("animateNow", () => {
  it("starts the animation at the current time of its timeline, not when the compositor picks it up", () => {
    const { element, animation, calls } = target({ currentTime: 1234.5 });
    const keyframes = [{ opacity: 0 }, { opacity: 1 }];
    const options = { duration: 180, delay: 60, fill: "forwards" as const };
    const started = animateNow(element, keyframes, options);
    expect(started).toBe(animation);
    expect(animation.startTime).toBe(1234.5);
    // The delay (the lead shared with the audio) and the rest are passed on as they are.
    expect(calls).toEqual([[keyframes, options]]);
  });

  it("leaves the animation pending when its timeline has no time (inactive or missing)", () => {
    for (const timeline of [{ currentTime: null }, null]) {
      const { element, animation } = target(timeline);
      animateNow(element, [{ opacity: 1 }], { duration: 150 });
      expect(animation.startTime).toBeNull();
    }
  });
});
