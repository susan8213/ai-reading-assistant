import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    action: {},
    permissions: ['sidePanel', 'tabs', 'activeTab'],
    host_permissions: [
      'http://127.0.0.1:8000/*',
      'http://localhost:8000/*',
      'http://127.0.0.1:3000/*',
      'http://localhost:3000/*',
    ],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src http://127.0.0.1:8000 http://localhost:8000 http://127.0.0.1:3000 http://localhost:3000 ws://127.0.0.1:3000 ws://localhost:3000",
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  },
  modules: ['@wxt-dev/module-react'],
});
