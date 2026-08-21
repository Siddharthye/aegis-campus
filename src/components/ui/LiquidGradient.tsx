'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

/**
 * The landing page's atmosphere: a slow liquid gradient in the site palette,
 * rendered once, fixed behind everything, never in front of anything.
 *
 * Restraint is the design constraint here. The shader runs at DPR ≤ 2, pauses
 * whenever it is offscreen or the tab is hidden, and is not mounted at all
 * under prefers-reduced-motion — that case gets a static CSS gradient, because
 * the point of the backdrop is depth, not spectacle.
 */

interface LiquidGradientProps {
  className?: string
}

interface TrailPoint {
  x: number
  y: number
  age: number
  force: number
  vx: number
  vy: number
}

/** Cursor trail rendered to a small canvas the shader samples for ripples. */
class TouchTexture {
  private readonly size = 64
  private readonly maxAge = 64
  private readonly radius = 0.1
  private readonly speed = 1 / 64
  private trail: TrailPoint[] = []
  private last: { x: number; y: number } | null = null
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  readonly texture: THREE.Texture

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.size
    this.canvas.height = this.size
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.fillStyle = 'black'
    this.ctx.fillRect(0, 0, this.size, this.size)
    this.texture = new THREE.Texture(this.canvas)
  }

  update() {
    this.ctx.fillStyle = 'black'
    this.ctx.fillRect(0, 0, this.size, this.size)
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const point = this.trail[i]
      const push = point.force * this.speed * (1 - point.age / this.maxAge)
      point.x += point.vx * push
      point.y += point.vy * push
      point.age++
      if (point.age > this.maxAge) this.trail.splice(i, 1)
      else this.drawPoint(point)
    }
    this.texture.needsUpdate = true
  }

  addTouch(point: { x: number; y: number }) {
    let force = 0
    let vx = 0
    let vy = 0
    if (this.last) {
      const dx = point.x - this.last.x
      const dy = point.y - this.last.y
      if (dx === 0 && dy === 0) return
      const distance = Math.sqrt(dx * dx + dy * dy)
      vx = dx / distance
      vy = dy / distance
      force = Math.min((dx * dx + dy * dy) * 20000, 2)
    }
    this.last = { x: point.x, y: point.y }
    this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy })
  }

  private drawPoint(point: TrailPoint) {
    const pos = { x: point.x * this.size, y: (1 - point.y) * this.size }
    const ease =
      point.age < this.maxAge * 0.3
        ? Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2))
        : (() => {
            const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7)
            return -(t * (t - 2))
          })()
    const intensity = ease * point.force
    const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`
    const radius = this.radius * this.size

    this.ctx.shadowOffsetX = this.size * 5
    this.ctx.shadowOffsetY = this.size * 5
    this.ctx.shadowBlur = radius
    this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`
    this.ctx.beginPath()
    this.ctx.fillStyle = 'rgba(255,0,0,1)'
    this.ctx.arc(pos.x - this.size * 5, pos.y - this.size * 5, radius, 0, Math.PI * 2)
    this.ctx.fill()
  }
}

/* The site palette, as the shader sees it. Violet aurora over graphite —
   the same #a78bfa / #8b5cf6 / #08070c the CSS tokens carry. */
const AURORA_VIOLET = new THREE.Vector3(0.655, 0.545, 0.98)
const AURORA_DEEP_VIOLET = new THREE.Vector3(0.545, 0.361, 0.965)
const GRAPHITE = new THREE.Vector3(0.031, 0.027, 0.047)

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vUv = uv;
}`

const FRAGMENT_SHADER = `
uniform float uTime, uSpeed, uIntensity, uGrainIntensity, uGradientSize, uColor1Weight, uColor2Weight;
uniform vec2 uResolution;
uniform vec3 uColor1, uColor2, uColor3, uColor4, uColor5, uColor6, uBase;
uniform sampler2D uTouchTexture;
varying vec2 vUv;

float grain(vec2 uv, float t) {
  return fract(sin(dot(uv * uResolution * 0.5 + t, vec2(12.9898, 78.233))) * 43758.5453) * 2.0 - 1.0;
}

vec3 getGradientColor(vec2 uv, float time) {
  vec2 c1 = vec2(0.5 + sin(time * uSpeed * 0.4) * 0.4, 0.5 + cos(time * uSpeed * 0.5) * 0.4);
  vec2 c2 = vec2(0.5 + cos(time * uSpeed * 0.6) * 0.5, 0.5 + sin(time * uSpeed * 0.45) * 0.5);
  vec2 c3 = vec2(0.5 + sin(time * uSpeed * 0.35) * 0.45, 0.5 + cos(time * uSpeed * 0.55) * 0.45);
  vec2 c4 = vec2(0.5 + cos(time * uSpeed * 0.5) * 0.4, 0.5 + sin(time * uSpeed * 0.4) * 0.4);
  vec2 c5 = vec2(0.5 + sin(time * uSpeed * 0.7) * 0.35, 0.5 + cos(time * uSpeed * 0.6) * 0.35);
  vec2 c6 = vec2(0.5 + cos(time * uSpeed * 0.45) * 0.5, 0.5 + sin(time * uSpeed * 0.65) * 0.5);

  float i1 = 1.0 - smoothstep(0.0, uGradientSize, length(uv - c1));
  float i2 = 1.0 - smoothstep(0.0, uGradientSize, length(uv - c2));
  float i3 = 1.0 - smoothstep(0.0, uGradientSize, length(uv - c3));
  float i4 = 1.0 - smoothstep(0.0, uGradientSize, length(uv - c4));
  float i5 = 1.0 - smoothstep(0.0, uGradientSize, length(uv - c5));
  float i6 = 1.0 - smoothstep(0.0, uGradientSize, length(uv - c6));

  vec3 color = vec3(0.0);
  color += uColor1 * i1 * (0.55 + 0.45 * sin(time * uSpeed)) * uColor1Weight;
  color += uColor2 * i2 * (0.55 + 0.45 * cos(time * uSpeed * 1.2)) * uColor2Weight;
  color += uColor3 * i3 * (0.55 + 0.45 * sin(time * uSpeed * 0.8)) * uColor1Weight;
  color += uColor4 * i4 * (0.55 + 0.45 * cos(time * uSpeed * 1.3)) * uColor2Weight;
  color += uColor5 * i5 * (0.55 + 0.45 * sin(time * uSpeed * 1.1)) * uColor1Weight;
  color += uColor6 * i6 * (0.55 + 0.45 * cos(time * uSpeed * 0.9)) * uColor2Weight;

  color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, 1.35);
  color = pow(color, vec3(0.92));
  float brightness = length(color);
  color = mix(uBase, color, max(brightness * 1.2, 0.15));
  return color;
}

void main() {
  vec2 uv = vUv;
  vec4 touchTex = texture2D(uTouchTexture, uv);
  uv.x -= (touchTex.r * 2.0 - 1.0) * 0.8 * touchTex.b;
  uv.y -= (touchTex.g * 2.0 - 1.0) * 0.8 * touchTex.b;
  float dist = length(uv - vec2(0.5));
  float ripple = sin(dist * 20.0 - uTime * 3.0) * 0.04 * touchTex.b;
  uv += vec2(ripple);
  vec3 color = getGradientColor(uv, uTime);
  color += grain(uv, uTime) * uGrainIntensity;
  color = clamp(color, vec3(0.0), vec3(1.0));
  gl_FragColor = vec4(color, 1.0);
}`

/** Owns the renderer and everything that must be released on unmount. */
class GradientApp {
  private readonly renderer: THREE.WebGLRenderer
  private readonly camera: THREE.PerspectiveCamera
  private readonly scene: THREE.Scene
  private readonly clock: THREE.Clock
  private readonly touchTexture: TouchTexture
  private readonly uniforms: Record<string, THREE.IUniform>
  private mesh: THREE.Mesh | null = null
  private animationId: number | null = null
  private paused = false
  private readonly disposers: Array<() => void> = []

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      10000,
    )
    this.camera.position.z = 50
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x08070c)
    this.clock = new THREE.Clock()
    this.touchTexture = new TouchTexture()

    /* Low intensity and a heavy graphite weight on purpose: the hero's text
       sits directly on this and must never fight it for contrast. */
    this.uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
      uColor1: { value: AURORA_VIOLET.clone() },
      uColor2: { value: GRAPHITE.clone() },
      uColor3: { value: AURORA_DEEP_VIOLET.clone() },
      uColor4: { value: GRAPHITE.clone() },
      uColor5: { value: AURORA_VIOLET.clone() },
      uColor6: { value: GRAPHITE.clone() },
      uSpeed: { value: 0.65 },
      uIntensity: { value: 0.8 },
      uTouchTexture: { value: this.touchTexture.texture },
      uGrainIntensity: { value: 0.05 },
      uBase: { value: GRAPHITE.clone() },
      uGradientSize: { value: 0.5 },
      uColor1Weight: { value: 0.5 },
      uColor2Weight: { value: 1.6 },
    }

    this.buildMesh()
    this.listen()
    this.tick()
  }

  setPaused(paused: boolean) {
    this.paused = paused
  }

  private viewSize() {
    const fov = (this.camera.fov * Math.PI) / 180
    const height = Math.abs(this.camera.position.z * Math.tan(fov / 2) * 2)
    return { width: height * this.camera.aspect, height }
  }

  private buildMesh() {
    const view = this.viewSize()
    const geometry = new THREE.PlaneGeometry(view.width, view.height, 1, 1)
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    })
    this.mesh = new THREE.Mesh(geometry, material)
    this.scene.add(this.mesh)
  }

  /** Every listener registers its own removal, so cleanup cannot drift. */
  private listen() {
    const container = this.container

    // The backdrop is pointer-events-none, so the cursor is read from the
    // window and projected into the fixed full-viewport container.
    const onPointerMove = (event: PointerEvent) => {
      if (this.paused) return
      this.touchTexture.addTouch({
        x: event.clientX / container.clientWidth,
        y: 1 - event.clientY / container.clientHeight,
      })
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    this.disposers.push(() => window.removeEventListener('pointermove', onPointerMove))

    const onResize = () => {
      this.camera.aspect = container.clientWidth / container.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(container.clientWidth, container.clientHeight)
      const view = this.viewSize()
      if (this.mesh) {
        this.mesh.geometry.dispose()
        this.mesh.geometry = new THREE.PlaneGeometry(view.width, view.height, 1, 1)
      }
      const resolution = this.uniforms.uResolution.value as THREE.Vector2
      resolution.set(container.clientWidth, container.clientHeight)
    }
    window.addEventListener('resize', onResize)
    this.disposers.push(() => window.removeEventListener('resize', onResize))

    // A hidden tab must cost nothing.
    const onVisibility = () => this.setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    this.disposers.push(() => document.removeEventListener('visibilitychange', onVisibility))

    // As must a backdrop scrolled out of view.
    const observer = new IntersectionObserver(([entry]) => {
      if (!document.hidden) this.setPaused(!entry.isIntersecting)
    })
    observer.observe(container)
    this.disposers.push(() => observer.disconnect())
  }

  private tick = () => {
    if (!this.paused) {
      const delta = Math.min(this.clock.getDelta(), 0.1)
      this.uniforms.uTime.value += delta
      this.touchTexture.update()
      this.renderer.render(this.scene, this.camera)
    } else {
      // Keep the clock draining so an unpause does not jump.
      this.clock.getDelta()
    }
    this.animationId = requestAnimationFrame(this.tick)
  }

  cleanup() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    for (const dispose of this.disposers) dispose()
    if (this.mesh) {
      this.mesh.geometry.dispose()
      ;(this.mesh.material as THREE.Material).dispose()
    }
    this.touchTexture.texture.dispose()
    this.renderer.dispose()
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}

export function LiquidGradient({ className = '' }: LiquidGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null)

  useEffect(() => {
    setReduceMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || reduceMotion !== false) return
    const app = new GradientApp(container)
    return () => app.cleanup()
  }, [reduceMotion])

  // Reduced motion (and the pre-mount frame) get the same colours, still.
  if (reduceMotion !== false) {
    return (
      <div
        aria-hidden
        className={className}
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 30% 25%, rgb(167 139 250 / 0.14), transparent 65%),' +
            'radial-gradient(ellipse 60% 50% at 75% 70%, rgb(139 92 246 / 0.1), transparent 65%),' +
            '#08070c',
        }}
      />
    )
  }

  return <div ref={containerRef} aria-hidden className={className} />
}

export default LiquidGradient
