import type { APIRequester, ArgsOf, PageOf, RequestOptions, ResultOf } from '../core.js';

/**
 * Outbound webhooks — endpoint CRUD, signing secrets, deliveries, and pings.
 * Method names derive from the `operationId`s with the `Webhook` noun
 * dropped (`rollWebhookSecret` → `rollSecret`).
 */
export class Webhooks {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listWebhookEndpoints` — GET /organizations/{orgId}/webhooks */
  listEndpoints(args: ArgsOf<'listWebhookEndpoints'>, options?: RequestOptions): Promise<ResultOf<'listWebhookEndpoints'>> {
    return this.#client.call('listWebhookEndpoints', args, options);
  }

  /** `createWebhookEndpoint` — POST /organizations/{orgId}/webhooks */
  createEndpoint(args: ArgsOf<'createWebhookEndpoint'>, options?: RequestOptions): Promise<ResultOf<'createWebhookEndpoint'>> {
    return this.#client.call('createWebhookEndpoint', args, options);
  }

  /** `getWebhookEndpoint` — GET /organizations/{orgId}/webhooks/{endpointId} */
  getEndpoint(args: ArgsOf<'getWebhookEndpoint'>, options?: RequestOptions): Promise<ResultOf<'getWebhookEndpoint'>> {
    return this.#client.call('getWebhookEndpoint', args, options);
  }

  /** `updateWebhookEndpoint` — PATCH /organizations/{orgId}/webhooks/{endpointId} */
  updateEndpoint(args: ArgsOf<'updateWebhookEndpoint'>, options?: RequestOptions): Promise<ResultOf<'updateWebhookEndpoint'>> {
    return this.#client.call('updateWebhookEndpoint', args, options);
  }

  /** `deleteWebhookEndpoint` — DELETE /organizations/{orgId}/webhooks/{endpointId} */
  deleteEndpoint(args: ArgsOf<'deleteWebhookEndpoint'>, options?: RequestOptions): Promise<ResultOf<'deleteWebhookEndpoint'>> {
    return this.#client.call('deleteWebhookEndpoint', args, options);
  }

  /** `getWebhookSecret` — GET /organizations/{orgId}/webhooks/{endpointId}/secret */
  getSecret(args: ArgsOf<'getWebhookSecret'>, options?: RequestOptions): Promise<ResultOf<'getWebhookSecret'>> {
    return this.#client.call('getWebhookSecret', args, options);
  }

  /** `rollWebhookSecret` — POST /organizations/{orgId}/webhooks/{endpointId}/secret/roll */
  rollSecret(args: ArgsOf<'rollWebhookSecret'>, options?: RequestOptions): Promise<ResultOf<'rollWebhookSecret'>> {
    return this.#client.call('rollWebhookSecret', args, options);
  }

  /**
   * `listWebhookDeliveries` — GET /organizations/{orgId}/webhooks/{endpointId}/deliveries
   *
   * Cursor-paginated: returns a `CursorPage` — use `for await` to iterate
   * deliveries across pages.
   */
  listDeliveries(args: ArgsOf<'listWebhookDeliveries'>, options?: RequestOptions): Promise<PageOf<'listWebhookDeliveries', 'deliveries'>> {
    return this.#client.page('listWebhookDeliveries', 'deliveries', args, options);
  }

  /** `getWebhookDelivery` — GET /organizations/{orgId}/webhooks/{endpointId}/deliveries/{deliveryId} */
  getDelivery(args: ArgsOf<'getWebhookDelivery'>, options?: RequestOptions): Promise<ResultOf<'getWebhookDelivery'>> {
    return this.#client.call('getWebhookDelivery', args, options);
  }

  /** `redeliverWebhook` — POST /organizations/{orgId}/webhooks/{endpointId}/deliveries/{deliveryId}/redeliver */
  redeliver(args: ArgsOf<'redeliverWebhook'>, options?: RequestOptions): Promise<ResultOf<'redeliverWebhook'>> {
    return this.#client.call('redeliverWebhook', args, options);
  }

  /** `pingWebhookEndpoint` — POST /organizations/{orgId}/webhooks/{endpointId}/ping */
  pingEndpoint(args: ArgsOf<'pingWebhookEndpoint'>, options?: RequestOptions): Promise<ResultOf<'pingWebhookEndpoint'>> {
    return this.#client.call('pingWebhookEndpoint', args, options);
  }

  /** `listWebhookEventTypes` — GET /organizations/{orgId}/webhooks/event-types */
  listEventTypes(args: ArgsOf<'listWebhookEventTypes'>, options?: RequestOptions): Promise<ResultOf<'listWebhookEventTypes'>> {
    return this.#client.call('listWebhookEventTypes', args, options);
  }
}
