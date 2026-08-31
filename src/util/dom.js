export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
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
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// Requires a press-and-hold (not a plain click) before firing `onConfirm` —
// friction against accidental taps on destructive actions. Adds a `holding`
// class for the duration so CSS can animate a fill/progress cue.
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
  for (const ev of ["mouseup", "mouseleave", "touchend", "touchcancel"]) {
    button.addEventListener(ev, cancel);
  }
}
