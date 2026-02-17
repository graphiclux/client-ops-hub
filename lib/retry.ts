export async function withRetry<T>(
  action: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number; shouldRetry?: (error: unknown) => boolean } = {}
) {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;

  for (let attempt = 0; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      const retryable = options.shouldRetry ? options.shouldRetry(error) : true;
      if (attempt >= retries || !retryable) {
        throw error;
      }

      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function shouldRetryHttpStatus(status: number) {
  return status === 429 || status >= 500;
}
