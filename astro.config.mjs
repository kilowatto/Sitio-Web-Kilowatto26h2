// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // Base.css was a separate render-blocking request (~500ms) on every page — small enough
  // (~10KB) that inlining it into the document head outweighs losing cross-page caching.
  build: {
    inlineStylesheets: 'always',
  },
  adapter: cloudflare({
    imageService: 'cloudflare',
    platformProxy: {
      enabled: true,
    },
  }),
});
