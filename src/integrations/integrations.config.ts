import type { Integration } from './registry'

/**
 * Configured integrations. **This is the file you edit during the integration
 * sprint** — adding an acquired module is one entry here, plus its origin in
 * `AEGIS_EXT_ALLOWLIST` if it is not running on localhost.
 *
 * Our own three modules are listed first. They are integrations in exactly the
 * same sense an acquired module is: AEGIS reaches SIREN, ATLAS and FUSION only
 * over their public HTTP APIs, through the same proxy, with no shared imports.
 * If that were not true they would not really be standalone, and a buyer would
 * discover it before we did.
 */
export const INTEGRATIONS: readonly Integration[] = [
  {
    id: 'siren',
    name: 'SIREN — geofenced alerts',
    kind: 'alert-channel',
    mount: 'rest',
    src: process.env.NEXT_PUBLIC_SIREN_URL ?? 'http://localhost:4101',
    widgetPath: '/widget',
    vendor: 'AEGIS (in-house)',
    enabled: true,
  },
  {
    id: 'atlas',
    name: 'ATLAS — live incident map',
    kind: 'map-layer',
    mount: 'iframe',
    src: process.env.NEXT_PUBLIC_ATLAS_URL ?? 'http://localhost:4102',
    widgetPath: '/widget',
    vendor: 'AEGIS (in-house)',
    enabled: true,
  },
  {
    id: 'fusion',
    name: 'FUSION — report fusion',
    kind: 'custom',
    mount: 'iframe',
    src: process.env.NEXT_PUBLIC_FUSION_URL ?? 'http://localhost:4104',
    widgetPath: '/widget',
    vendor: 'AEGIS (in-house)',
    enabled: true,
  },

  // ── Acquired modules go below this line ────────────────────────────────
  // Set `enabled: true` once the seller has run it in front of us, and add a
  // non-localhost origin to AEGIS_EXT_ALLOWLIST. Each stub below matches a gap
  // published on /wanted, so the sprint is a one-line edit under time
  // pressure rather than a blank-page problem.
  //
  // {
  //   id: 'sms-intake',
  //   name: 'SMS / WhatsApp / IVR emergency intake',
  //   kind: 'intake-channel',
  //   mount: 'iframe',
  //   src: 'https://their-module.example',
  //   widgetPath: '/widget',
  //   vendor: 'Team HA-0XX-XXXX',
  //   enabled: false,
  // },
  // {
  //   id: 'loudspeaker',
  //   name: 'Campus loudspeaker / PA broadcast',
  //   kind: 'alert-channel',
  //   mount: 'rest',
  //   src: 'https://their-module.example',
  //   vendor: 'Team HA-0XX-XXXX',
  //   enabled: false,
  // },
  // {
  //   id: 'cctv-hazard',
  //   name: 'CCTV hazard / crowd-density detection',
  //   kind: 'sensor-feed',
  //   mount: 'iframe',
  //   src: 'https://their-module.example',
  //   widgetPath: '/widget',
  //   vendor: 'Team HA-0XX-XXXX',
  //   enabled: false,
  // },
]
