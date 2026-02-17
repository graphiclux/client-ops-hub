export function logInfo(event: string, metadata: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      event,
      timestamp: new Date().toISOString(),
      ...metadata
    })
  );
}

export function logError(event: string, error: unknown, metadata: Record<string, unknown> = {}) {
  const details =
    error instanceof Error
      ? {
          message: error.message,
          stack: error.stack
        }
      : {
          message: String(error)
        };

  console.error(
    JSON.stringify({
      level: "error",
      event,
      timestamp: new Date().toISOString(),
      ...metadata,
      error: details
    })
  );
}
