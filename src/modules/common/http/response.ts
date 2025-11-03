export function ok<T>(data: T) {
  return { success: true, data };
}

export function fail(message: string, meta?: Record<string, unknown>) {
  return { success: false, error: { message, ...meta } };
}
