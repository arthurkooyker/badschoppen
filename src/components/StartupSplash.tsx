import { useEffect, useId, useState } from "react"
import type { ThemeSettings } from "../types"

const ICON_SRC = new URL("../../assets/app-icon-adjusted.png", import.meta.url).href

type Props = {
  onFinish: () => void
  themeSettings: ThemeSettings
}

function buildWavePath(progress: number, phase: number) {
  const width = 1024
  const height = 1024
  const baseY = height - progress * height
  const amplitude = 28 + progress * 10
  const points = 12
  const step = width / points

  let path = `M 0 ${height} L 0 ${baseY.toFixed(2)}`

  for (let point = 0; point <= points; point += 1) {
    const x = point * step
    const y = baseY + Math.sin(point * 0.9 + phase) * amplitude

    path += ` L ${x.toFixed(2)} ${Math.max(0, Math.min(height, y)).toFixed(2)}`
  }

  path += ` L ${width} ${height} Z`
  return path
}

function StartupSplash({ onFinish, themeSettings }: Props) {
  const clipPathId = useId().replace(/:/g, "-")
  const [colorImage, setColorImage] = useState("")
  const [grayImage, setGrayImage] = useState("")
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(0)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    let isCancelled = false
    const image = new Image()
    image.src = ICON_SRC

    image.onload = () => {
      if (isCancelled) return

      const canvas = document.createElement("canvas")
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext("2d")

      if (!context) {
        setColorImage(ICON_SRC)
        setGrayImage(ICON_SRC)
        return
      }

      context.drawImage(image, 0, 0)
      const originalImageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const colorData = new Uint8ClampedArray(originalImageData.data)
      const grayData = new Uint8ClampedArray(originalImageData.data)

      for (let index = 0; index < colorData.length; index += 4) {
        const red = colorData[index]
        const green = colorData[index + 1]
        const blue = colorData[index + 2]
        const isNearWhite = red > 245 && green > 245 && blue > 245

        if (isNearWhite) {
          colorData[index + 3] = 0
          grayData[index + 3] = 0
          continue
        }

        const luminance = red * 0.299 + green * 0.587 + blue * 0.114
        const grayValue = Math.round(luminance * 0.72 + 34)

        grayData[index] = grayValue
        grayData[index + 1] = grayValue
        grayData[index + 2] = grayValue
      }

      context.putImageData(new ImageData(colorData, canvas.width, canvas.height), 0, 0)
      const nextColorImage = canvas.toDataURL("image/png")

      context.clearRect(0, 0, canvas.width, canvas.height)
      context.putImageData(new ImageData(grayData, canvas.width, canvas.height), 0, 0)
      const nextGrayImage = canvas.toDataURL("image/png")

      if (!isCancelled) {
        setColorImage(nextColorImage)
        setGrayImage(nextGrayImage)
      }
    }

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    let animationFrame = 0
    let finishTimeout = 0
    const durationMs = 3000
    const start = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - start
      const normalized = Math.min(elapsed / durationMs, 1)
      const eased = 1 - Math.pow(1 - normalized, 3)

      setProgress(eased)
      setPhase(elapsed / 320)

      if (normalized < 1) {
        animationFrame = window.requestAnimationFrame(animate)
        return
      }

      setIsLeaving(true)
      finishTimeout = window.setTimeout(onFinish, 480)
    }

    animationFrame = window.requestAnimationFrame(animate)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(finishTimeout)
    }
  }, [onFinish])

  const wavePath = buildWavePath(progress, phase)
  const rockingRotation = Math.sin(phase * 0.42) * 1.9
  const rockingOffset = Math.sin(phase * 0.42) * 8

  return (
    <div
      className={`startup-splash ${isLeaving ? "startup-splash-leaving" : ""}`}
      style={
        {
          ["--startup-accent" as string]: themeSettings.accent,
          ["--startup-accent-strong" as string]: themeSettings.accentStrong,
          ["--startup-bg" as string]: themeSettings.appBackground,
          ["--startup-bg-accent" as string]: themeSettings.appBackgroundAccent
        }
      }
    >
      <div className="startup-splash-glow" />
      <div className="startup-splash-panel">
        <div
          className="startup-splash-icon-shell"
          style={{
            transform: `translateY(${rockingOffset}px) rotate(${rockingRotation}deg)`
          }}
        >
          {grayImage && colorImage ? (
            <svg
              viewBox="0 0 1024 1024"
              className="startup-splash-icon"
              role="img"
              aria-label="Badschoppen startscherm"
            >
              <defs>
                <clipPath id={clipPathId}>
                  <path d={wavePath} />
                </clipPath>
              </defs>

              <image href={grayImage} width="1024" height="1024" />
              <image href={colorImage} width="1024" height="1024" clipPath={`url(#${clipPathId})`} />
            </svg>
          ) : (
            <div className="startup-splash-placeholder" />
          )}
        </div>

        <div className="startup-splash-copy">
          <strong>Badschoppen</strong>
          <span>Boodschappen en recepten worden klaargezet...</span>
        </div>
      </div>
    </div>
  )
}

export default StartupSplash
