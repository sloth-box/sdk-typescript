import type { APIRequester, ArgsOf, RequestOptions, ResultOf } from '../core.js';

/** AWS connections — the org's BYOC links into customer AWS accounts. */
export class AwsConnections {
  readonly #client: APIRequester;

  constructor(client: APIRequester) {
    this.#client = client;
  }

  /** `listAwsConnections` — GET /organizations/{orgId}/aws-connections */
  list(args: ArgsOf<'listAwsConnections'>, options?: RequestOptions): Promise<ResultOf<'listAwsConnections'>> {
    return this.#client.call('listAwsConnections', args, options);
  }

  /** `createAwsConnection` — POST /organizations/{orgId}/aws-connections */
  create(args: ArgsOf<'createAwsConnection'>, options?: RequestOptions): Promise<ResultOf<'createAwsConnection'>> {
    return this.#client.call('createAwsConnection', args, options);
  }

  /** `getAwsConnection` — GET /organizations/{orgId}/aws-connections/{connectionId} */
  get(args: ArgsOf<'getAwsConnection'>, options?: RequestOptions): Promise<ResultOf<'getAwsConnection'>> {
    return this.#client.call('getAwsConnection', args, options);
  }

  /** `deleteAwsConnection` — DELETE /organizations/{orgId}/aws-connections/{connectionId} */
  delete(args: ArgsOf<'deleteAwsConnection'>, options?: RequestOptions): Promise<ResultOf<'deleteAwsConnection'>> {
    return this.#client.call('deleteAwsConnection', args, options);
  }

  /** `verifyAwsConnection` — POST /organizations/{orgId}/aws-connections/{connectionId}/verify */
  verify(args: ArgsOf<'verifyAwsConnection'>, options?: RequestOptions): Promise<ResultOf<'verifyAwsConnection'>> {
    return this.#client.call('verifyAwsConnection', args, options);
  }

  /**
   * `getAwsConnectionTemplate` — GET /aws-connections/template.yaml
   *
   * The one non-JSON operation in the API: returns the public CloudFormation
   * template customers deploy to grant Slothbox its assume-role permissions,
   * as a raw YAML **string** (never JSON-parsed).
   */
  getTemplate(args?: ArgsOf<'getAwsConnectionTemplate'>, options?: RequestOptions): Promise<ResultOf<'getAwsConnectionTemplate'>> {
    return this.#client.call('getAwsConnectionTemplate', args, options);
  }
}
