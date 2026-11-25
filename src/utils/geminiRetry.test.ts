import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GEMINI_429_FRIENDLY_MESSAGE,
  GEMINI_503_FRIENDLY_MESSAGE,
  GEMINI_NETWORK_FRIENDLY_MESSAGE,
  computeExponentialBackoffMs,
  isNonRetryableGeminiError,
  withGeminiRetry,
} from './geminiRetry.ts';

describe('Gemini Exponential Backoff Retry Engine', () => {
  it('computes 2s -> 4s -> 8s exponential backoff plus small random jitter', () => {
    assert.equal(computeExponentialBackoffMs(0, () => 0), 2000);
    assert.equal(computeExponentialBackoffMs(1, () => 0), 4000);
    assert.equal(computeExponentialBackoffMs(2, () => 0), 8000);

    assert.equal(computeExponentialBackoffMs(0, () => 0.5), 2250);
    assert.equal(computeExponentialBackoffMs(1, () => 0.5), 4250);
    assert.equal(computeExponentialBackoffMs(2, () => 0.5), 8250);
  });

  it('retries 503 UNAVAILABLE up to 4 total attempts with 2s->4s->8s backoff and returns friendly Korean message', async () => {
    let attempts = 0;
    const delays: number[] = [];

    await assert.rejects(
      () =>
        withGeminiRetry(
          async () => {
            attempts += 1;
            throw new Error(
              '{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'
            );
          },
          {
            randomFn: () => 0.2, // +100ms jitter
            sleep: async (ms) => {
              delays.push(ms);
            },
          }
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, GEMINI_503_FRIENDLY_MESSAGE);
        return true;
      }
    );

    assert.equal(attempts, 4);
    assert.deepEqual(delays, [2100, 4100, 8100]);
  });

  it('retries 429 and network errors to completion and recovers when a later attempt succeeds', async () => {
    let attempts = 0;
    const delays: number[] = [];

    const result = await withGeminiRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('429 RESOURCE_EXHAUSTED: quota temporarily exceeded');
        }
        if (attempts === 2) {
          const netErr = new Error('fetch failed') as Error & { code?: string };
          netErr.code = 'ECONNRESET';
          throw netErr;
        }
        return { ok: true };
      },
      {
        randomFn: () => 0,
        sleep: async (ms) => {
          delays.push(ms);
        },
      }
    );

    assert.deepEqual(result, { ok: true });
    assert.equal(attempts, 3);
    assert.deepEqual(delays, [2000, 4000]);
  });

  it('returns friendly Korean messages when 429 or network errors persist through all 4 attempts', async () => {
    await assert.rejects(
      () =>
        withGeminiRetry(
          async () => {
            const err = new Error('Too Many Requests') as Error & { status?: number };
            err.status = 429;
            throw err;
          },
          { sleep: async () => {} }
        ),
      (err: unknown) => err instanceof Error && err.message === GEMINI_429_FRIENDLY_MESSAGE
    );

    await assert.rejects(
      () =>
        withGeminiRetry(
          async () => {
            throw new Error('TypeError: fetch failed (ETIMEDOUT)');
          },
          { sleep: async () => {} }
        ),
      (err: unknown) => err instanceof Error && err.message === GEMINI_NETWORK_FRIENDLY_MESSAGE
    );
  });

  it('passes lastError to subsequent attempts so callers can fall back to another model on persistent 503', async () => {
    const modelsTried: string[] = [];

    const result = await withGeminiRetry(
      async (attempt, lastError) => {
        const model =
          attempt === 3 && lastError instanceof Error && lastError.message.includes('503')
            ? 'gemini-3.1-flash-lite'
            : 'gemini-4-hydrogen';
        modelsTried.push(model);
        if (model === 'gemini-4-hydrogen') {
          throw new Error('503 UNAVAILABLE: high demand');
        }
        return { model };
      },
      { sleep: async () => {} }
    );

    assert.deepEqual(result, { model: 'gemini-3.1-flash-lite' });
    assert.deepEqual(modelsTried, [
      'gemini-4-hydrogen',
      'gemini-4-hydrogen',
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
    ]);
  });

  it('aborts immediately without retrying on 400, 403, 404, and API_KEY errors', async () => {
    const fatalErrors = [
      new Error('400 INVALID_ARGUMENT: bad schema'),
      new Error('403 PERMISSION_DENIED'),
      new Error('404 NOT_FOUND: model not found'),
      new Error('API_KEY_INVALID: check key'),
    ];

    for (const fatalErr of fatalErrors) {
      assert.equal(isNonRetryableGeminiError(fatalErr), true);
      let attempts = 0;
      const delays: number[] = [];

      await assert.rejects(
        () =>
          withGeminiRetry(
            async () => {
              attempts += 1;
              throw fatalErr;
            },
            {
              sleep: async (ms) => {
                delays.push(ms);
              },
            }
          ),
        (err: unknown) => err instanceof Error && err.message === fatalErr.message
      );

      assert.equal(attempts, 1);
      assert.deepEqual(delays, []);
    }
  });
});
