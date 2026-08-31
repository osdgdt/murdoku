export function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Atteso ${JSON.stringify(expected)}, ricevuto ${JSON.stringify(actual)}`);
  }
}
