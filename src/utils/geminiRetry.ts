export const GEMINI_MAX_ATTEMPTS = 4;
export const GEMINI_BASE_BACKOFF_MS = 2000;
export const GEMINI_MAX_JITTER_MS = 500;

export const GEMINI_503_FRIENDLY_MESSAGE =
  '현재 제미나이 서버에 일시적으로 요청이 몰려 응답이 지연되고 있습니다. 10~20초 후 다시 시도해 주세요. (503)';

export const GEMINI_429_FRIENDLY_MESSAGE =
  '현재 제미나이 API 요청 한도가 일시적으로 초과되었습니다. 잠시 후 다시 시도해 주세요. (429)';

export const GEMINI_NETWORK_FRIENDLY_MESSAGE =
  '제미나이 서버와의 네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.';

function getErrorText(err: unknown): string {
  if (err instanceof Error) {
    const causeMsg =
      err.cause && typeof err.cause === 'object' && 'message' in err.cause
        ? ` ${String((err.cause as { message?: unknown }).message ?? '')}`
        : '';
    return `${err.message}${causeMsg}`;
  }
  if (err && typeof err === 'object') {
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err ?? '');
}

export function extractErrorStatus(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const obj = err as {
      status?: unknown;
      statusCode?: unknown;
      code?: unknown;
      error?: { code?: unknown; status?: unknown };
    };
    const candidates = [obj.status, obj.statusCode, obj.code, obj.error?.code];
    for (const c of candidates) {
      if (typeof c === 'number' && c >= 100 && c < 600) {
        return c;
      }
      if (typeof c === 'string' && /^\d{3}$/.test(c)) {
        return Number(c);
      }
    }
  }

  const msg = getErrorText(err);
  const jsonCodeMatch = msg.match(/"code"\s*:\s*(\d{3})/);
  if (jsonCodeMatch) {
    return Number(jsonCodeMatch[1]);
  }
  const httpCodeMatch = msg.match(/\b(400|403|404|429|500|502|503|504)\b/);
  if (httpCodeMatch) {
    return Number(httpCodeMatch[1]);
  }
  return null;
}

export function is503UnavailableError(err: unknown): boolean {
  const status = extractErrorStatus(err);
  if (status === 503) return true;
  const msg = getErrorText(err);
  return /\b503\b|UNAVAILABLE|high demand|overloaded|service unavailable/i.test(msg);
}

export function is429RateLimitError(err: unknown): boolean {
  const status = extractErrorStatus(err);
  if (status === 429) return true;
  const msg = getErrorText(err);
  return /\b429\b|RESOURCE_EXHAUSTED|too many requests|rate[\s_-]?limit/i.test(msg);
}

export function isNetworkError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const obj = err as { code?: unknown; cause?: { code?: unknown } };
    const code = String(obj.code ?? obj.cause?.code ?? '');
    if (
      /^(ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|EPIPE|UND_ERR_)/i.test(code)
    ) {
      return true;
    }
  }
  const msg = getErrorText(err);
  return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|network\s?error|timeout|UND_ERR_/i.test(
    msg
  );
}

/**
 * Returns true for client/configuration errors (400, 403, 404, API_KEY) that
 * should abort immediately without retrying.
 */
export function isNonRetryableGeminiError(err: unknown): boolean {
  if (is503UnavailableError(err) || is429RateLimitError(err) || isNetworkError(err)) {
    return false;
  }
  const status = extractErrorStatus(err);
  if (status === 400 || status === 403 || status === 404) {
    return true;
  }
  const msg = getErrorText(err);
  return /\b(400|403|404)\b|API_KEY|API key|INVALID_ARGUMENT|PERMISSION_DENIED|NOT_FOUND/i.test(
    msg
  );
}

/**
 * Exponential backoff schedule: 2s -> 4s -> 8s plus small random jitter (0~499ms).
 */
export function computeExponentialBackoffMs(
  attempt: number,
  randomFn: () => number = Math.random
): number {
  const safeAttempt = Math.max(0, Math.floor(attempt));
  const baseDelay = GEMINI_BASE_BACKOFF_MS * Math.pow(2, safeAttempt);
  const clampedRand = Math.min(0.999999, Math.max(0, randomFn()));
  const jitter = Math.floor(clampedRand * GEMINI_MAX_JITTER_MS);
  return baseDelay + jitter;
}

export function formatGeminiErrorMessage(err: unknown): string {
  if (is503UnavailableError(err)) {
    return GEMINI_503_FRIENDLY_MESSAGE;
  }
  if (is429RateLimitError(err)) {
    return GEMINI_429_FRIENDLY_MESSAGE;
  }
  if (isNetworkError(err)) {
    return GEMINI_NETWORK_FRIENDLY_MESSAGE;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return 'Gemini API 호출 중 오류가 발생했습니다.';
}

export interface GeminiRetryOptions {
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
  randomFn?: () => number;
  onRetry?: (info: {
    attempt: number;
    nextAttempt: number;
    delayMs: number;
    error: unknown;
  }) => void;
}

export async function withGeminiRetry<T>(
  operation: (attempt: number, lastError: unknown) => Promise<T>,
  options: GeminiRetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? GEMINI_MAX_ATTEMPTS;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const randomFn = options.randomFn ?? Math.random;

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await operation(attempt, lastError);
    } catch (err) {
      lastError = err;
      if (isNonRetryableGeminiError(err)) {
        break;
      }
      if (attempt < maxAttempts - 1) {
        const delayMs = computeExponentialBackoffMs(attempt, randomFn);
        options.onRetry?.({
          attempt,
          nextAttempt: attempt + 1,
          delayMs,
          error: err,
        });
        await sleep(delayMs);
      }
    }
  }

  throw new Error(formatGeminiErrorMessage(lastError));
}
