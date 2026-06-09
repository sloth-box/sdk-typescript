import type { APIRequester, ArgsOf, PageOf, RequestOptions } from '../core.js';

/**
 * Audit log — org-wide, caller-scoped, and per-API-key event streams. All
 * three lists are cursor-paginated: they return a `CursorPage`, so `for
 * await` iterates events across pages automatically.
 */
export class Audit {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listOrgAuditEvents` — GET /organizations/{orgId}/audit (cursor-paginated) */
  listOrgEvents(args: ArgsOf<'listOrgAuditEvents'>, options?: RequestOptions): Promise<PageOf<'listOrgAuditEvents', 'events'>> {
    return this.#client.page('listOrgAuditEvents', 'events', args, options);
  }

  /** `listMyAuditEvents` — GET /me/audit (cursor-paginated) */
  listMyEvents(args?: ArgsOf<'listMyAuditEvents'>, options?: RequestOptions): Promise<PageOf<'listMyAuditEvents', 'events'>> {
    return this.#client.page('listMyAuditEvents', 'events', args, options);
  }

  /** `listApiKeyAuditEvents` — GET /me/api-keys/{keyId}/audit (cursor-paginated) */
  listApiKeyEvents(args: ArgsOf<'listApiKeyAuditEvents'>, options?: RequestOptions): Promise<PageOf<'listApiKeyAuditEvents', 'events'>> {
    return this.#client.page('listApiKeyAuditEvents', 'events', args, options);
  }
}
