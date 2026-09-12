/** Serialize lifecycle IPC across capture hooks, including tab changes. */
export declare function createCaptureLifecycleQueue(): <T>(operation: () => Promise<T>) => Promise<T>;
