const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MS = 25_000;

export const OPENAI_ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL ?? 'gpt-5.6-luna';

export async function createOpenAIResponse(payload, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('openai_not_configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    if (options.requestId) headers['X-Client-Request-Id'] = options.requestId;
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        model: OPENAI_ASSISTANT_MODEL,
        store: false,
      }),
      signal: controller.signal,
    });
    const requestId = response.headers.get('x-request-id');
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(`openai_http_${response.status}`);
      error.code = body?.error?.code ?? `http_${response.status}`;
      error.requestId = requestId;
      throw error;
    }
    return { body, requestId };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('openai_timeout');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function getResponseText(responseBody) {
  return (responseBody.output ?? [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === 'output_text')
    .map((item) => item.text)
    .join('');
}
