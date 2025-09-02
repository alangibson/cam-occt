/**
 * Timeout wrapper to prevent hanging operations
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Wrap a synchronous function with timeout protection
 */
export function withTimeoutSync<T>(
  fn: () => T,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return withTimeout(
    new Promise<T>((resolve) => {
      const result: T = fn();
      resolve(result);
    }),
    timeoutMs,
    errorMessage
  );
}