/** Serialize lifecycle IPC across capture hooks, including tab changes. */
export function createCaptureLifecycleQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = tail.then(operation);
    // A failed start/stop must still reject for its caller, while allowing the
    // next lifecycle operation to run. Polling and clear never use this queue.
    tail = result.catch(() => {});
    return result;
  };
}
