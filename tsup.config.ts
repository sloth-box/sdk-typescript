import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // The SDK must run anywhere a WHATWG `fetch` global exists (Node 18+,
  // Cloudflare Workers, Deno, Bun, browsers). `neutral` makes esbuild treat
  // `node:` builtins as errors instead of externals, so a platform-specific
  // import can't sneak into the runtime bundle.
  platform: 'neutral',
});
