import { useEffect, useRef } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { toVaultUrl } from '../nodes/Image'
import { tNow } from '../../lib/i18n'

// Görsel: köşeden sürükleyerek genişlik, altında alt yazı alanı
export function ImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null)
  const stopDragRef = useRef<(() => void) | null>(null)
  const width = node.attrs['width'] as number | null

  useEffect(() => () => stopDragRef.current?.(), [])

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    stopDragRef.current?.()
    const startX = e.clientX
    const startW = imgRef.current?.getBoundingClientRect().width ?? 300
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(80, Math.round(startW + ev.clientX - startX))
      if (imgRef.current) imgRef.current.style.width = `${w}px`
    }
    const stop = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (stopDragRef.current === stop) stopDragRef.current = null
    }
    const onUp = (ev: MouseEvent) => {
      stop()
      updateAttributes({ width: Math.max(80, Math.round(startW + ev.clientX - startX)) })
    }
    stopDragRef.current = stop
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <NodeViewWrapper as="figure" className={`image-block${selected ? ' selected' : ''}`} data-drag-handle>
      <div className="image-frame" style={width ? { width } : undefined}>
        <img ref={imgRef} src={toVaultUrl(String(node.attrs['src'] ?? ''))} alt={String(node.attrs['alt'] ?? '')} style={width ? { width } : undefined} draggable={false} />
        {editor.isEditable && <span className="image-resize" onMouseDown={startResize} title={tNow('image.resize')} />}
      </div>
      <input
        className="image-caption"
        data-testid="image-caption"
        placeholder={tNow('image.caption')}
        value={String(node.attrs['caption'] ?? '')}
        readOnly={!editor.isEditable}
        onChange={(e) => updateAttributes({ caption: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </NodeViewWrapper>
  )
}
