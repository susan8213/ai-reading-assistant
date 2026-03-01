import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    permissions: ['sidePanel'],
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
  modules: ['@wxt-dev/module-react'],
});
