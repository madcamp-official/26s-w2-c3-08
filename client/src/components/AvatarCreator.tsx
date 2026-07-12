import { useRef, useState, type CSSProperties } from 'react'
import {
  ReactSketchCanvas,
  type ReactSketchCanvasRef,
} from 'react-sketch-canvas'

type BrushSize = 2 | 4 | 8

interface BrushColorOption {
  label: string
  value: string
}

interface GenerateAvatarRequest {
  image: string
  prompt: string
}

interface GenerateAvatarResponse {
  ok?: boolean
  [key: string]: unknown
}

const CANVAS_SIZE = 400
const EXPORT_RENDER_DELAY_MS = 100
const TRANSPARENT_CANVAS = 'transparent'
const EXPORT_CANVAS_COLOR = '#FFFFFF'
const THEME = {
  buildYellow: '#F6BE00',
  buildYellowSoft: '#FFF3B0',
  sky: '#4A9DE0',
  skyDeep: '#2F7FC4',
  marioRed: '#E52521',
  groundGreen: '#43A047',
  dirtBrown: '#8B5A2B',
  ink: '#172033',
  muted: '#64748B',
  panelLine: 'rgba(23, 32, 51, 0.13)',
  panelShadow: '0 16px 35px rgba(47, 127, 196, 0.14)',
}

const brushSizes: BrushSize[] = [2, 4, 8]

const brushColors: BrushColorOption[] = [
  { label: '검정', value: '#111827' },
  { label: '빨강', value: '#ef4444' },
  { label: '파랑', value: '#2563eb' },
  { label: '초록', value: '#16a34a' },
]

const styles: Record<string, CSSProperties> = {
  container: {
    width: 'min-content',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: 20,
    border: `1px solid ${THEME.panelLine}`,
    borderRadius: 8,
    background:
      'linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px),' +
      'linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(232, 246, 255, 0.9))',
    backgroundSize: '28px 28px, 28px 28px, auto',
    boxShadow: THEME.panelShadow,
    color: THEME.ink,
    fontFamily:
      'Pretendard, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  canvasShell: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    border: `1px solid rgba(23, 32, 51, 0.28)`,
    borderRadius: 8,
    overflow: 'hidden',
    background:
      'linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(232, 246, 255, 0.86))',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.14)',
  },
  toolbar: {
    width: CANVAS_SIZE,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  toolbarRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    minWidth: 44,
    fontSize: 13,
    fontWeight: 700,
    color: THEME.muted,
  },
  button: {
    height: 34,
    padding: '0 12px',
    border: `1px solid rgba(47, 127, 196, 0.22)`,
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.98)',
    color: THEME.ink,
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  activeButton: {
    borderColor: THEME.buildYellow,
    background: THEME.buildYellowSoft,
    color: THEME.ink,
  },
  colorButton: {
    width: 32,
    height: 32,
    padding: 0,
    borderRadius: 16,
    border: '2px solid rgba(23, 32, 51, 0.16)',
    cursor: 'pointer',
  },
  activeColorButton: {
    borderColor: THEME.ink,
    boxShadow: `0 0 0 3px rgba(246, 190, 0, 0.45)`,
  },
  input: {
    width: CANVAS_SIZE,
    height: 42,
    boxSizing: 'border-box',
    border: `1px solid rgba(47, 127, 196, 0.22)`,
    borderRadius: 6,
    padding: '0 12px',
    color: THEME.ink,
    background: '#ffffff',
    fontSize: 14,
    outline: 'none',
  },
  generateButton: {
    width: CANVAS_SIZE,
    height: 44,
    border: `1px solid rgba(139, 90, 43, 0.45)`,
    borderRadius: 6,
    background:
      'linear-gradient(rgba(255, 255, 255, 0.09) 1px, transparent 1px),' +
      'linear-gradient(90deg, rgba(255, 255, 255, 0.09) 1px, transparent 1px),' +
      `linear-gradient(180deg, #FFE071, ${THEME.buildYellow})`,
    backgroundSize: '24px 24px, 24px 24px, auto',
    color: THEME.ink,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  disabledButton: {
    borderColor: 'rgba(47, 127, 196, 0.22)',
    background:
      'linear-gradient(180deg, rgba(232, 246, 255, 0.92), rgba(255, 255, 255, 0.82))',
    color: THEME.muted,
    cursor: 'not-allowed',
  },
}

function waitForCanvasRender() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, EXPORT_RENDER_DELAY_MS)
  })
}

function AvatarCreator() {
  const canvasRef = useRef<ReactSketchCanvasRef>(null)
  const [brushSize, setBrushSize] = useState<BrushSize>(4)
  const [brushColor, setBrushColor] = useState(brushColors[0].value)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [canvasBackgroundColor, setCanvasBackgroundColor] =
    useState(TRANSPARENT_CANVAS)

  const handleUndo = () => {
    canvasRef.current?.undo()
  }

  const handleRedo = () => {
    canvasRef.current?.redo()
  }

  const handleClear = () => {
    canvasRef.current?.clearCanvas()
  }

  const handleGenerateAvatar = async () => {
    if (isGenerating || canvasRef.current === null) {
      return
    }

    setIsGenerating(true)
    setCanvasBackgroundColor(EXPORT_CANVAS_COLOR)

    try {
      await waitForCanvasRender()

      const base64String = await canvasRef.current.exportImage('png', {
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
      })

      const requestBody: GenerateAvatarRequest = {
        image: base64String,
        prompt,
      }

      const response = await fetch('/api/assets/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const responseBody = (await response
        .json()
        .catch(() => ({}))) as GenerateAvatarResponse

      if (!response.ok || responseBody.ok === false) {
        throw new Error('Avatar generation request failed')
      }

      console.info('Avatar generation request succeeded:', responseBody)
    } catch (error) {
      console.error(error)
      alert('아바타 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setCanvasBackgroundColor(TRANSPARENT_CANVAS)
      setIsGenerating(false)
    }
  }

  return (
    <section style={styles.container} aria-label="아바타 생성기">
      <div style={styles.canvasShell}>
        <ReactSketchCanvas
          ref={canvasRef}
          width={`${CANVAS_SIZE}px`}
          height={`${CANVAS_SIZE}px`}
          strokeWidth={brushSize}
          strokeColor={brushColor}
          canvasColor={canvasBackgroundColor}
          exportWithBackgroundImage={false}
          style={{
            border: 'none',
            borderRadius: 0,
            backgroundImage: "url('/guide-silhouette.png')",
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'contain',
          }}
        />
      </div>

      <div style={styles.toolbar} aria-label="그리기 도구">
        <div style={styles.toolbarRow}>
          <span style={styles.label}>굵기</span>
          <div style={styles.controlGroup}>
            {brushSizes.map((size) => (
              <button
                key={size}
                type="button"
                style={{
                  ...styles.button,
                  ...(brushSize === size ? styles.activeButton : {}),
                }}
                onClick={() => setBrushSize(size)}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        <div style={styles.toolbarRow}>
          <span style={styles.label}>색상</span>
          <div style={styles.controlGroup}>
            {brushColors.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-label={`${color.label} 브러시`}
                title={color.label}
                style={{
                  ...styles.colorButton,
                  ...(brushColor === color.value
                    ? styles.activeColorButton
                    : {}),
                  background: color.value,
                }}
                onClick={() => setBrushColor(color.value)}
              />
            ))}
          </div>
        </div>

        <div style={styles.toolbarRow}>
          <span style={styles.label}>제어</span>
          <div style={styles.controlGroup}>
            <button type="button" style={styles.button} onClick={handleUndo}>
              Undo
            </button>
            <button type="button" style={styles.button} onClick={handleRedo}>
              Redo
            </button>
            <button type="button" style={styles.button} onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <input
        type="text"
        value={prompt}
        style={styles.input}
        placeholder="어떤 아바타를 원하시나요? (ex. 불타는 검을 든 픽셀 슬라임)"
        onChange={(event) => setPrompt(event.target.value)}
      />

      <button
        type="button"
        disabled={isGenerating}
        style={{
          ...styles.generateButton,
          ...(isGenerating ? styles.disabledButton : {}),
        }}
        onClick={handleGenerateAvatar}
      >
        {isGenerating ? '생성 중...' : '아바타 생성하기'}
      </button>
    </section>
  )
}

export default AvatarCreator
