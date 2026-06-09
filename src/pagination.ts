/**
 * Cursor pagination for the Slothbox API.
 *
 * Cursor-based list operations (`limit`/`cursor` query params, a `cursor`
 * field on the response body) resolve to a {@link CursorPage}: the typed page
 * body plus `for await` auto-iteration over items across pages.
 *
 * ```ts
 * const page = await client.audit.listOrgEvents({ orgId });
 * page.items;                       // this page's events
 * page.data;                        // the full typed body ({ events, cursor? })
 * if (page.hasNextPage()) await page.getNextPage();
 *
 * for await (const event of page) { … } // auto-fetches subsequent pages
 * ```
 */

import { SlothboxError } from './errors.js';

/** A single page of a cursor-paginated list. */
export class CursorPage<TData extends { cursor?: string }, TItem> implements AsyncIterable<TItem> {
  /** The full typed response body for this page. */
  readonly data: TData;
  /** The items on this page. */
  readonly items: readonly TItem[];

  readonly #fetchNext: (cursor: string) => Promise<CursorPage<TData, TItem>>;

  constructor(
    data: TData,
    items: readonly TItem[],
    fetchNext: (cursor: string) => Promise<CursorPage<TData, TItem>>,
  ) {
    this.data = data;
    this.items = items;
    this.#fetchNext = fetchNext;
  }

  /**
   * Opaque cursor for the next page, or `undefined` on the last page.
   * (DynamoDB-backed lists can return a cursor alongside an empty page when a
   * filter matched nothing in the scanned range — keep paging until the
   * cursor disappears.)
   */
  get cursor(): string | undefined {
    return this.data.cursor;
  }

  hasNextPage(): boolean {
    return typeof this.data.cursor === 'string' && this.data.cursor.length > 0;
  }

  /** Fetch the next page. Throws when {@link hasNextPage} is false. */
  async getNextPage(): Promise<CursorPage<TData, TItem>> {
    const cursor = this.data.cursor;
    if (cursor === undefined || cursor === '') {
      throw new SlothboxError('No next page available — check hasNextPage() before calling getNextPage()');
    }
    return this.#fetchNext(cursor);
  }

  /**
   * Iterate the items on this page, then transparently fetch and iterate
   * every subsequent page until the cursor runs out.
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<TItem, void, undefined> {
    let page: CursorPage<TData, TItem> = this;
    let previousCursor: string | undefined;
    for (;;) {
      for (const item of page.items) yield item;
      if (!page.hasNextPage()) return;
      // Defensive: a server bug that echoes the same cursor forever would
      // otherwise spin this loop indefinitely.
      if (page.cursor === previousCursor) return;
      previousCursor = page.cursor;
      page = await page.getNextPage();
    }
  }
}
