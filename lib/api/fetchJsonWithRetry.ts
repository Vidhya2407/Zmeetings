type FetchJsonRetryOptions = {
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
};

export type FetchJsonResult<T> = {
  attempts: number;
  data: T | null;
  error: string | null;
  ok: boolean;
  status: number;
  unauthorized: boolean;
};

const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 350;
const DEFAULT_TIMEOUT_MS = 8000;

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function parseJsonSafely(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchJsonRetryOptions,
): Promise<FetchJsonResult<T>> {
  const retries = options?.retries ?? DEFAULT_RETRIES;
  const retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let attempts = 0;

  while (attempts <= retries) {
    attempts += 1;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      window.clearTimeout(timeoutId);
      const body = await parseJsonSafely(response);
      const data = (body?.data ?? null) as T | null;
      const error = typeof body?.error === 'string' ? body.error : null;

      if (response.ok) {
        return {
          attempts,
          data,
          error: null,
          ok: true,
          status: response.status,
          unauthorized: false,
        };
      }

      const shouldRetry = response.status >= 500 && attempts <= retries;
      if (shouldRetry) {
        await wait(retryDelayMs * attempts);
        continue;
      }

      return {
        attempts,
        data,
        error: error ?? `Request failed with status ${response.status}.`,
        ok: false,
        status: response.status,
        unauthorized: response.status === 401,
      };
    } catch {
      window.clearTimeout(timeoutId);
      if (attempts <= retries) {
        await wait(retryDelayMs * attempts);
        continue;
      }
      return {
        attempts,
        data: null,
        error: 'Network connection lost. Please retry.',
        ok: false,
        status: 0,
        unauthorized: false,
      };
    }
  }

  return {
    attempts,
    data: null,
    error: 'Network connection lost. Please retry.',
    ok: false,
    status: 0,
    unauthorized: false,
  };
}
