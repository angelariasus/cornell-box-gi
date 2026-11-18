import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/**
 * Adds the tags that need absolute URLs (link previews ignore relative ones): the canonical
 * link, og:url and og:image. The site address comes from SITE_URL or, when building on Vercel,
 * from the production domain it provides. Without either the tags are left out.
 */
function siteUrlTags() {
  return {
    name: 'site-url-tags',
    transformIndexHtml() {
      const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
      const site = process.env.SITE_URL || (vercel ? `https://${vercel}` : '');
      if (!site) return [];
      const base = site.replace(/\/+$/, '');
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: `${base}/` }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: `${base}/` }, injectTo: 'head' },
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: `${base}/og-image.png` },
          injectTo: 'head',
        },
      ];
    },
  };
}

export default defineConfig({
  plugins: [svelte(), siteUrlTags()],
  worker: {
    // Radiosity and photon workers are ES modules.
    format: 'es',
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
