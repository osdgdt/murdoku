// Real touch events for the browser tests. Playwright's own touchscreen only taps; presses, holds and drags go
// through the Chrome DevTools protocol (Input.dispatchTouchEvent), which is what a finger does: touchstart,
// touchmove…, touchend, with no mouse events in between unless the page asks for the emulated click.
export async function touchOn(page) {
  const client = await page.context().newCDPSession(page);
  const send = (type, points) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
  const point = (x, y) => ({ x: Math.round(x), y: Math.round(y), id: 1 });
  const centre = async (locator) => {
    // to the middle of the screen, clear of the phone toolbar fixed at the bottom (instantly: the page scrolls smoothly otherwise)
    await locator.evaluate((n) => n.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
    const box = await locator.boundingBox();
    if (!box) throw new Error("touch: the element has no box (hidden?)");
    return point(box.x + box.width / 2, box.y + box.height / 2);
  };
  return {
    // a quick tap on an element
    async tap(locator) {
      const p = await centre(locator);
      await send("touchStart", [p]);
      await send("touchEnd", []);
      await page.waitForTimeout(40);
    },
    // a finger held still on an element for `ms`
    async hold(locator, ms = 1300) {
      const p = await centre(locator);
      await send("touchStart", [p]);
      await page.waitForTimeout(ms);
      await send("touchEnd", []);
    },
    // a finger dragged by (dx, dy) from the middle of an element, in steps
    async drag(locator, dx, dy, steps = 8) {
      const p = await centre(locator);
      await send("touchStart", [p]);
      for (let i = 1; i <= steps; i++) {
        await send("touchMove", [point(p.x + (dx * i) / steps, p.y + (dy * i) / steps)]);
        await page.waitForTimeout(16);
      }
      await send("touchEnd", []);
      await page.waitForTimeout(500); // let the scroll "fling" settle: a tap during it only stops the scrolling
    },
    // a tap at page coordinates
    async tapAt(x, y) {
      await send("touchStart", [point(x, y)]);
      await send("touchEnd", []);
      await page.waitForTimeout(40);
    },
  };
}
