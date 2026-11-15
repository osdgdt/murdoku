// The time a player has really spent on a case: it only runs while the page is visible, and it
// survives leaving and coming back (the saved board carries the seconds so far). Pure (the clock
// and the visibility are passed in), so it can be tested without a browser.
//
// `maxGapMs`: a browser may stop timers for a long while (a sleeping laptop, a background tab);
// whatever the gap between two ticks, at most this much is counted.
export function createActiveClock({ initialSeconds = 0, now = Date.now, maxGapMs = 5000 } = {}) {
  let ms = Math.max(0, Number(initialSeconds) || 0) * 1000;
  let last = null;
  return {
    // Call about once a second, and when the page is shown or hidden. Returns the whole seconds so far.
    tick(visible = true) {
      const at = now();
      if (visible && last !== null) ms += Math.min(Math.max(0, at - last), maxGapMs);
      last = at;
      return Math.floor(ms / 1000);
    },
    seconds: () => Math.floor(ms / 1000),
  };
}
