/**
 * Starts a Web Animation on the frame clock: its start time is the current time of its timeline, the
 * time of the frame in which it is asked for.
 *
 * Left pending, an animation of transform or opacity is run by the compositor, which takes as its
 * start time the frame in which it picks the animation up: the next one when the main thread is still
 * busy with this frame (a card taken off, the felt drawn, a knight raised). The delay, which is the
 * lead shared with the sounds on the audio clock, would then end one frame late, and a knight would
 * set off a frame later than its lead behind the card it follows. Every motion the Director starts
 * goes through here, so all the animations of a step start in the frame the Director asked for.
 */
export function animateNow(
  target: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation {
  const animation = target.animate(keyframes, options);
  const now = animation.timeline?.currentTime ?? null;
  if (now !== null) animation.startTime = now;
  return animation;
}
