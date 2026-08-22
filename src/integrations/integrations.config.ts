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

  // ── Acquired modules ───────────────────────────────────────────────────
  {
    id: 'whatsapp-intake',
    name: 'WhatsApp intake — Twilio webhook',
    kind: 'intake-channel',
    // Not iframe or rest: this module is a webhook *receiver*, so it is
    // mounted as the route Twilio posts to rather than a surface we draw.
    // See vendor/whatsapp-intake/ for the contract and the port.
    mount: 'rest',
    src: '/api/intake/whatsapp',
    vendor: 'PingBin (MOD-WHATSAPP-INTAKE-03)',
    enabled: true,
  },

  // ── Further acquisitions go below this line ────────────────────────────
  // Buyer: Team PROMPT & PRAY (HA-040-7800).
  //
  // Sprint procedure, in order:
  //   1. Uncomment the stub matching what was bought.
  //   2. Paste the seller's deployed base URL into `src`.
  //   3. Put the seller's team name and ID in `vendor` — it is printed in the
  //      UI and must match the Deal Register, which is cross-checked live.
  //   4. Set `enabled: true`.
  //   5. Add the origin to AEGIS_EXT_ALLOWLIST (comma-separated) in the
  //      environment, or the proxy will refuse to forward to it.
  //
  // Each stub below is a gap we deliberately did not build, so the sprint is a
  // one-line edit under time pressure rather than a blank-page problem.
  //
  // {
  //   id: 'sms-intake',
  //   name: 'SMS / WhatsApp / IVR emergency intake',
  //   kind: 'intake-channel',
  //   mount: 'iframe',
  //   src: 'https://their-module.example',
  //   widgetPath: '/widget',
  //   vendor: 'SELLER TEAM NAME (HA-0XX-XXXX)',
  //   enabled: false,
  // },
  // {
  //   id: 'loudspeaker',
  //   name: 'Campus loudspeaker / PA broadcast',
  //   kind: 'alert-channel',
  //   mount: 'rest',
  //   src: 'https://their-module.example',
  //   vendor: 'SELLER TEAM NAME (HA-0XX-XXXX)',
  //   enabled: false,
  // },
  // {
  //   id: 'cctv-hazard',
  //   name: 'CCTV hazard / crowd-density detection',
  //   kind: 'sensor-feed',
  //   mount: 'iframe',
  //   src: 'https://their-module.example',
  //   widgetPath: '/widget',
  //   vendor: 'SELLER TEAM NAME (HA-0XX-XXXX)',
  //   enabled: false,
  // },
]
