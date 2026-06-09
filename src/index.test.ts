import { describe, expect, it } from 'vitest';
import pkg from '../package.json';
import {
  APIConnectionError,
  APIError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  CursorPage,
  NotFoundError,
  PermissionDeniedError,
  PlanRequiredError,
  RateLimitError,
  Slothbox,
  SlothboxClient,
  SlothboxError,
  VERSION,
} from './index.js';

describe('VERSION', () => {
  it('matches package.json', () => {
    expect(VERSION).toBe(pkg.version);
  });
});

describe('public surface', () => {
  it('exports the Slothbox client', () => {
    expect(typeof Slothbox).toBe('function');
  });

  it('keeps the scaffold-era SlothboxClient name as a deprecated alias', () => {
    expect(SlothboxClient).toBe(Slothbox);
  });

  it('exports the full error hierarchy', () => {
    for (const cls of [
      SlothboxError,
      APIConnectionError,
      APIError,
      BadRequestError,
      AuthenticationError,
      PlanRequiredError,
      PermissionDeniedError,
      NotFoundError,
      ConflictError,
      RateLimitError,
    ]) {
      expect(typeof cls).toBe('function');
    }
  });

  it('exports CursorPage', () => {
    expect(typeof CursorPage).toBe('function');
  });
});
