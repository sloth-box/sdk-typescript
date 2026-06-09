import { describe, expect, it } from 'vitest';
import {
  auditPage1,
  auditPage2,
  auditPageEmpty,
  auditPageEmptyWithCursor,
  auditPageLast,
  deliveriesPage1,
  deliveriesPage2,
} from './__fixtures__/fixtures.js';
import { createMockFetch, jsonResponse } from './__fixtures__/mock-fetch.js';
import { Slothbox, SlothboxError } from './index.js';

function clientWith(...responses: Response[]) {
  const mock = createMockFetch(...responses);
  return { client: new Slothbox({ apiKey: 'sk_test', fetch: mock.fetch }), mock };
}

describe('CursorPage', () => {
  it('exposes the typed page body, items, and cursor', async () => {
    const { client } = clientWith(jsonResponse(200, auditPage1));
    const page = await client.audit.listOrgEvents({ orgId: 'org_1' });
    expect(page.items.map((event) => event.eventId)).toEqual(['evt_0001', 'evt_0002']);
    expect(page.data.events).toHaveLength(2);
    expect(page.cursor).toBe('cursor-page-2');
    expect(page.hasNextPage()).toBe(true);
  });

  it('getNextPage() requests the next page with the cursor query param', async () => {
    const { client, mock } = clientWith(
      jsonResponse(200, auditPage1),
      jsonResponse(200, auditPage2),
    );
    const page1 = await client.audit.listOrgEvents({ orgId: 'org_1', query: { limit: 2 } });
    const page2 = await page1.getNextPage();
    expect(page2.items.map((event) => event.eventId)).toEqual(['evt_0003', 'evt_0004']);

    expect(mock.requests).toHaveLength(2);
    const second = mock.requests[1]!.url;
    expect(second.pathname).toBe('/organizations/org_1/audit');
    expect(second.searchParams.get('cursor')).toBe('cursor-page-2');
    // other query params survive across pages
    expect(second.searchParams.get('limit')).toBe('2');
  });

  it('hasNextPage() is false and getNextPage() throws on the last page', async () => {
    const { client } = clientWith(jsonResponse(200, auditPageLast));
    const page = await client.audit.listOrgEvents({ orgId: 'org_1' });
    expect(page.hasNextPage()).toBe(false);
    await expect(page.getNextPage()).rejects.toThrow(SlothboxError);
  });

  it('for await auto-iterates items across every page', async () => {
    const { client, mock } = clientWith(
      jsonResponse(200, auditPage1),
      jsonResponse(200, auditPage2),
      jsonResponse(200, auditPageLast),
    );
    const page = await client.audit.listOrgEvents({ orgId: 'org_1' });
    const seen: string[] = [];
    for await (const event of page) seen.push(event.eventId);
    expect(seen).toEqual(['evt_0001', 'evt_0002', 'evt_0003', 'evt_0004', 'evt_0005']);
    expect(mock.requests).toHaveLength(3);
    expect(mock.requests[2]!.url.searchParams.get('cursor')).toBe('cursor-page-3');
  });

  it('an empty final page yields nothing', async () => {
    const { client } = clientWith(jsonResponse(200, auditPageEmpty));
    const page = await client.audit.listMyEvents();
    expect(page.items).toHaveLength(0);
    expect(page.hasNextPage()).toBe(false);
    const seen: unknown[] = [];
    for await (const event of page) seen.push(event);
    expect(seen).toEqual([]);
  });

  it('keeps paging through empty-but-cursored pages (filtered DynamoDB scans)', async () => {
    const { client, mock } = clientWith(
      jsonResponse(200, auditPageEmptyWithCursor),
      jsonResponse(200, auditPageLast),
    );
    const page = await client.audit.listOrgEvents({
      orgId: 'org_1',
      query: { action: 'terminate' },
    });
    const seen: string[] = [];
    for await (const event of page) seen.push(event.eventId);
    expect(seen).toEqual(['evt_0005']);
    expect(mock.requests).toHaveLength(2);
  });

  it('stops instead of spinning if the server echoes the same cursor forever', async () => {
    const samePage = { events: [], cursor: 'stuck' };
    const { client, mock } = clientWith(
      jsonResponse(200, samePage),
      jsonResponse(200, samePage),
      jsonResponse(200, samePage),
    );
    const page = await client.audit.listOrgEvents({ orgId: 'org_1' });
    const seen: unknown[] = [];
    for await (const event of page) seen.push(event);
    expect(seen).toEqual([]);
    expect(mock.requests.length).toBeLessThanOrEqual(3);
  });

  it('paginates webhook deliveries with the deliveries items key', async () => {
    const { client, mock } = clientWith(
      jsonResponse(200, deliveriesPage1),
      jsonResponse(200, deliveriesPage2),
    );
    const page = await client.webhooks.listDeliveries({ orgId: 'org_1', endpointId: 'whe_1' });
    const seen: string[] = [];
    for await (const delivery of page) seen.push(delivery.deliveryId);
    expect(seen).toEqual(['dlv_0001', 'dlv_0002', 'dlv_0003']);
    expect(mock.requests[1]!.url.pathname).toBe('/organizations/org_1/webhooks/whe_1/deliveries');
    expect(mock.requests[1]!.url.searchParams.get('cursor')).toBe('dlv-cursor-2');
  });

  it('reuses per-request options (auth, headers, signal) for subsequent pages', async () => {
    const { client, mock } = clientWith(
      jsonResponse(200, auditPage1),
      jsonResponse(200, auditPageLast),
    );
    const controller = new AbortController();
    const page = await client.audit.listOrgEvents(
      { orgId: 'org_1' },
      { signal: controller.signal, headers: { 'x-trace': 'abc' } },
    );
    for await (const _event of page) {
      // drain
    }
    expect(mock.requests).toHaveLength(2);
    expect(mock.requests[1]!.signal).toBe(controller.signal);
    expect(mock.requests[1]!.headers.get('x-trace')).toBe('abc');
    expect(mock.requests[1]!.headers.get('authorization')).toBe('sk_test');
  });
});
