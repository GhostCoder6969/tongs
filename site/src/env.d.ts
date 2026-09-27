interface ImportMetaEnv {
  /** True when public/og-image.png exists at build time (see astro.config.mjs). */
  readonly TONGS_HAS_OG: boolean;
  readonly TONGS_HAS_TRAILER: boolean;
}
