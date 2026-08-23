import { ImageResponse } from 'next/og'

/**
 * The card that renders wherever the link is pasted — WhatsApp, Slack, a
 * submission form, a judge's browser tab preview.
 *
 * Generated rather than a checked-in PNG so it cannot drift from the product
 * it advertises, and drawn with the site's own tokens so the first impression
 * of AEGIS is the same dark console the link opens into. Nothing here is
 * fetched: the whole card is inline, because it is rendered at build time
 * where the app's own APIs are not running.
 */

export const alt = 'AEGIS — Campus Emergency Response OS'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const ACCENT = '#a78bfa'
const TEXT = '#ededf4'
const MUTED = '#9b98ad'
const FAINT = '#6a677e'
const BORDER = '#272437'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#08070c',
          // The aurora the landing page runs in WebGL, flattened to a still.
          backgroundImage:
            'radial-gradient(900px 520px at 78% 18%, rgba(167,139,250,0.20), transparent 70%),' +
            'radial-gradient(680px 420px at 12% 92%, rgba(167,139,250,0.10), transparent 68%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${ACCENT}`,
              color: ACCENT,
              fontSize: 24,
              fontWeight: 700,
            }}
          >
            A
          </div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 700,
              letterSpacing: 9,
              color: TEXT,
            }}
          >
            AEGIS
          </div>
          <div
            style={{
              marginLeft: 12,
              fontSize: 18,
              letterSpacing: 3,
              color: ACCENT,
              border: `1px solid ${BORDER}`,
              borderRadius: 999,
              padding: '8px 18px',
            }}
          >
            CAMPUS EMERGENCY RESPONSE OS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 92, fontWeight: 700, color: TEXT, lineHeight: 1.04 }}>
            Every second,
          </div>
          <div style={{ fontSize: 92, fontWeight: 700, color: ACCENT, lineHeight: 1.04 }}>
            accounted for.
          </div>
          <div style={{ marginTop: 26, fontSize: 27, color: MUTED, maxWidth: 880, lineHeight: 1.45 }}>
            One platform from the first report to the last responder standing down — built for a
            campus, honest about what it knows.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 14,
            borderTop: `1px solid ${BORDER}`,
            paddingTop: 26,
            fontSize: 21,
            color: FAINT,
          }}
        >
          {['Report in three taps', 'Fifty reports, one incident', 'Works with the wifi off'].map(
            (capability, index) => (
              <div key={capability} style={{ display: 'flex', gap: 14 }}>
                {index > 0 && <span style={{ color: ACCENT }}>·</span>}
                <span>{capability}</span>
              </div>
            ),
          )}
        </div>
      </div>
    ),
    size,
  )
}
