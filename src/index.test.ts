import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import { SlothboxClient, VERSION } from './index.js';

describe('VERSION', () => {
  it('matches package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });
});

describe('SlothboxClient (scaffold)', () => {
  it('constructs with an apiKey and applies the default baseUrl', () => {
    const client = new SlothboxClient({ apiKey: 'sk_test' });
    expect(client.baseUrl).toBe('https://api.slothbox.dev');
  });

  it('honours a custom baseUrl', () => {
    const client = new SlothboxClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:3000',
    });
    expect(client.baseUrl).toBe('http://localhost:3000');
  });

  it('throws without an apiKey', () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => new SlothboxClient({})).toThrow(/apiKey/);
  });

  it('request() throws the not-implemented error', () => {
    const client = new SlothboxClient({ apiKey: 'sk_test' });
    expect(() => client.request()).toThrow(/not implemented/);
  });
});
