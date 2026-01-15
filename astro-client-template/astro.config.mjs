import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Domena klienta (z env lub build args)
const site = process.env.SITE_URL || 'https://example.com';

export default defineConfig({
  site,
  output: 'static',
  integrations: [sitemap()],
  build: {
    assets: '_astro',
  },
});
