import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & {
          url?: string
          'loading-anim-type'?: string
          /** `global` = track pointer outside the canvas bounds */
          'events-target'?: 'local' | 'global'
        },
        HTMLElement
      >
    }
  }
}

export {}
