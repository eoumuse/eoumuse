import { useRef, useCallback, useEffect, useState } from 'react'

interface KnobProps {
  value: number
  min: number
  max: number
  label: string
  color: string
  onChange: (v: number) => void
  defaultValue: number
  formatValue?: (v: number) => string
}

const SIZE = 56
const STROKE = 5
const RADIUS = (SIZE - STROKE) / 2 - 2
const CENTER = SIZE / 2
const START_ANGLE = 135  // degrees
const TOTAL_ARC = 270   // degrees

function polarToXY(angleDeg: number, r: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return {
    x: CENTER + r * Math.cos(rad),
    y: CENTER + r * Math.sin(rad),
  }
}

function describeArc(startDeg: number, endDeg: number, r: number) {
  const s = polarToXY(startDeg, r)
  const e = polarToXY(endDeg, r)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

export function Knob({ value, min, max, label, color, onChange, defaultValue, formatValue }: KnobProps) {
  const dragRef = useRef<{ startY: number; startValue: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const norm = (value - min) / (max - min)
  const fillEndDeg = START_ANGLE + norm * TOTAL_ARC

  const trackStart = START_ANGLE
  const trackEnd = START_ANGLE + TOTAL_ARC
  const trackPath = describeArc(trackStart, trackEnd, RADIUS)
  const fillPath = norm > 0 ? describeArc(trackStart, fillEndDeg, RADIUS) : ''

  // Indicator dot
  const indicatorPos = polarToXY(fillEndDeg, RADIUS)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startY: e.clientY, startValue: value }
    setIsDragging(true)
  }, [value])

  const handleDoubleClick = useCallback(() => {
    onChange(defaultValue)
  }, [onChange, defaultValue])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      const dy = dragRef.current.startY - e.clientY
      const range = max - min
      const delta = (dy / 150) * range
      const newVal = Math.min(max, Math.max(min, dragRef.current.startValue + delta))
      onChange(newVal)
    }

    const handleMouseUp = () => {
      dragRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, min, max, onChange])

  const displayValue = formatValue ? formatValue(value) : value.toFixed(1)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        userSelect: 'none',
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: 'ns-resize',
          filter: isDragging ? `drop-shadow(0 0 8px ${color})` : `drop-shadow(0 0 4px ${color}66)`,
          transition: 'filter 0.1s',
        }}
      >
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Fill */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 3px ${color})`,
            }}
          />
        )}

        {/* Center circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS * 0.45}
          fill="rgba(10,0,20,0.8)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />

        {/* Indicator dot */}
        <circle
          cx={indicatorPos.x}
          cy={indicatorPos.y}
          r={3}
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>

      <div style={{
        fontSize: '9px',
        fontWeight: '700',
        letterSpacing: '0.12em',
        color,
        textShadow: `0 0 8px ${color}`,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>

      <div style={{
        fontSize: '10px',
        color: 'rgba(255, 240, 255, 0.7)',
        fontVariantNumeric: 'tabular-nums',
        minWidth: '36px',
        textAlign: 'center',
      }}>
        {displayValue}
      </div>
    </div>
  )
}
