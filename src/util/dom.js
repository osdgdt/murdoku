export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (key === "class") {
      node.className = value;
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }
  // A form control that only has a title/placeholder gets that as its
  // accessible name too (a title alone isn't a reliable label for assistive tech).
  if (
    (tag === "select" || tag === "input" || tag === "textarea") &&
    !node.hasAttribute("aria-label") &&
    node.type !== "checkbox" &&
    node.type !== "hidden"
  ) {
    const name = node.getAttribute("title") || node.getAttribute("placeholder");
    if (name) node.setAttribute("aria-label", name);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Enter/Space equivalent of a click, for custom (non-<button>) interactive
// elements — e.g. a `<div role="button" tabindex="0">` chip/swatch. Wire as
// `onKeydown: onActivateKey(fn)` alongside `onClick: fn`.
export function onActivateKey(onActivate) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onActivate();
    }
  };
}

// Requires a press-and-hold (not a plain click) before firing `onConfirm` —
// friction against accidental taps on destructive actions. Adds a `holding`
// class for the duration so CSS can animate a fill/progress cue.
//
// Also works from the keyboard (hold Enter or Space down for the same time), so it is not a
// mouse-and-touch-only control.
export function attachHoldToConfirm(button, durationMs, onConfirm) {
  let timer = null;
  const start = (e) => {
    e.preventDefault();
    button.classList.add("holding");
    timer = setTimeout(() => {
      button.classList.remove("holding");
      timer = null;
      onConfirm();
    }, durationMs);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    button.classList.remove("holding");
  };
  button.addEventListener("mousedown", start);
  button.addEventListener("touchstart", start, { passive: false });
  for (const ev of ["mouseup", "mouseleave", "touchend", "touchcancel", "blur"]) {
    button.addEventListener(ev, cancel);
  }
  button.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat && !timer) start(e);
    else if (e.key === "Enter" || e.key === " ") e.preventDefault();
  });
  button.addEventListener("keyup", (e) => {
    if (e.key === "Enter" || e.key === " ") cancel();
  });
}

// Runs `render()` (which rebuilds the content of `container`) and puts the keyboard focus back on the
// element that had it: the same position among `selector` matches. Without this, pressing Enter on a
// chip or a clue line that triggers a re-render leaves the focus on the page body, and a keyboard or
// screen-reader user has to find their place again after every action.
export function keepFocus(container, selector, render) {
  const active = typeof document !== "undefined" ? document.activeElement : null;
  const index = active && container.contains(active) ? [...container.querySelectorAll(selector)].indexOf(active) : -1;
  render();
  if (index >= 0) {
    const again = container.querySelectorAll(selector)[index];
    if (again) again.focus({ preventScroll: true });
  }
}
