import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

// Markdown stays in the repository's docs/ folder; src/content/docs is a
// committed symlink to it (vite.resolve.preserveSymlinks keeps the paths
// stable). Repository-only records are excluded here, so they are never
// built, indexed by search, or listed in the sitemap.
export const collections = {
  docs: defineCollection({
    loader: glob({
      base: './src/content/docs',
      pattern: ['**/*.{md,mdx}', '!SDLC.md', '!site-plan.md', '!work/**', '!index.md', '!assets/**'],
    }),
    schema: docsSchema({
      extend: z.object({
        // Page eyebrow, rendered by the PageTitle override as
        // `$ docs / <group> / <eyebrow>`. Both default from the sidebar:
        // group is the page's sidebar group, eyebrow the last URL segment.
        group: z.string().optional(),
        eyebrow: z.string().optional(),
        // Right-hand hint in the eyebrow, with keycap syntax:
        // `opens: "++5++ from a review"` renders "open with [5] from a review".
        opens: z.string().optional(),
        // Optional lead paragraph shown under the h1.
        lead: z.string().optional(),
      }),
    }),
  }),
  // UI string overrides (src/content/i18n/en.json), e.g. "Search docs".
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
