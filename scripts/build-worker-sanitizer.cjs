function sanitizeForWorker(value, seen = new WeakMap()) {
  if (value === null || value === undefined) return value;
  const type = typeof value;
  if (type === "function") return undefined;
  if (type !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const arr = value.map((item) => {
      const sanitized = sanitizeForWorker(item, seen);
      return sanitized === undefined ? null : sanitized;
    });
    seen.set(value, arr);
    return arr;
  }
  if (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    ArrayBuffer.isView(value) ||
    value instanceof ArrayBuffer
  ) {
    return value;
  }
  const out = {};
  seen.set(value, out);
  for (const key of Object.keys(value)) {
    const sanitized = sanitizeForWorker(value[key], seen);
    if (sanitized !== undefined) {
      out[key] = sanitized;
    }
  }
  return out;
}

try {
  const workerThreads = require("node:worker_threads");
  const originalPostMessage = workerThreads.Worker && workerThreads.Worker.prototype && workerThreads.Worker.prototype.postMessage;
  if (originalPostMessage) {
    workerThreads.Worker.prototype.postMessage = function sanitizedWorkerPostMessage(value, transferList) {
      return originalPostMessage.call(this, sanitizeForWorker(value), transferList);
    };
  }
} catch {}
