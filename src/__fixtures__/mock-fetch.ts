/**
 * A queue-based `fetch` mock for unit tests. No network, no globals — it is
 * handed straight to `new Slothbox({ fetch })`.
 */

export interface RecordedRequest {
  url: URL;
  method: string;
  headers: Headers;
  body: string | undefined;
  signal: AbortSignal | null | undefined;
}

type Responder = Response | ((request: RecordedRequest) => Response | Promise<Response>);

export interface MockFetch {
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  requests: RecordedRequest[];
}

/**
 * Build a mock fetch that replays `responders` in order (one per request) and
 * records every request it sees. Throws if more requests arrive than
 * responses were queued. Honours pre-aborted signals like real fetch.
 */
export function createMockFetch(...responders: Responder[]): MockFetch {
  const queue = [...responders];
  const requests: RecordedRequest[] = [];
  return {
    requests,
    fetch: async (url, init) => {
      const request: RecordedRequest = {
        url: new URL(url),
        method: init.method ?? 'GET',
        headers: new Headers(init.headers),
        body: typeof init.body === 'string' ? init.body : undefined,
        signal: init.signal,
      };
      requests.push(request);
      if (request.signal?.aborted) {
        throw new DOMException('This operation was aborted', 'AbortError');
      }
      const responder = queue.shift();
      if (!responder) {
        throw new Error(`mock fetch: no response queued for ${request.method} ${url}`);
      }
      return typeof responder === 'function' ? responder(request) : responder;
    },
  };
}

/** A recorded JSON response (defaults to the API's request-id header). */
export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** A recorded non-JSON response (e.g. the CloudFormation template YAML). */
export function textResponse(
  status: number,
  body: string,
  contentType: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers: { 'content-type': contentType, ...headers } });
}
