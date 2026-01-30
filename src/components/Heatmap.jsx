import { useEffect, useRef, useState } from 'react'

export const HEATMAP_ROWS = 7
export const HEATMAP_CELL_PX = 16
export const HEATMAP_GAP_PX = 4
export const HEATMAP_COL_WIDTH_PX = HEATMAP_CELL_PX + HEATMAP_GAP_PX

const rootPaddingPx = 12
const heatmapPaddingPx = 8
const tooltipOffsetPx = 6
const tooltipHeightPx = 36

export default function Heatmap({
  model,
  monthMarkers,
  scrollRef,
  selectedCell,
  onSelectCell,
  header,
  levelClasses,
  rootClassName = '',
  cardClassName = '',
}) {
  const [tooltipLeft, setTooltipLeft] = useState(rootPaddingPx)
  const [tooltipTop, setTooltipTop] = useState(heatmapPaddingPx)
  const rootRef = useRef(null)

  useEffect(() => {
    const container = scrollRef.current
    const root = rootRef.current
    if (!container || !root || !selectedCell?.date) {
      return
    }
    const cellEl = root.querySelector(`[data-date="${selectedCell.date}"]`)
    const rootRect = root.getBoundingClientRect()
    const cellRect = cellEl?.getBoundingClientRect()

    const minLeft = rootPaddingPx
    const maxLeft = Math.max(minLeft, root.clientWidth - 180 - rootPaddingPx)

    if (cellRect) {
      const cellCenterLeft = cellRect.left - rootRect.left + HEATMAP_CELL_PX / 2
      const rawLeft = cellCenterLeft - 90
      const nextLeft = Math.min(maxLeft, Math.max(minLeft, rawLeft))
      setTooltipLeft(nextLeft)

      const rawTop = cellRect.top - rootRect.top + HEATMAP_CELL_PX + tooltipOffsetPx
      const maxTop = Math.max(heatmapPaddingPx, root.clientHeight - tooltipHeightPx - rootPaddingPx)
      setTooltipTop(Math.min(maxTop, Math.max(heatmapPaddingPx, rawTop)))
      return
    }

    const fallbackLeft = selectedCell.colIdx * HEATMAP_COL_WIDTH_PX - container.scrollLeft
    const nextLeft = Math.min(maxLeft, Math.max(minLeft, rootPaddingPx + fallbackLeft))
    setTooltipLeft(nextLeft)

    const rowTop = selectedCell.rowIdx * (HEATMAP_CELL_PX + HEATMAP_GAP_PX)
    const nextTop = heatmapPaddingPx + rowTop + HEATMAP_CELL_PX + tooltipOffsetPx
    const maxTop = Math.max(heatmapPaddingPx, root.clientHeight - tooltipHeightPx - rootPaddingPx)
    setTooltipTop(Math.min(maxTop, nextTop))
  }, [scrollRef, selectedCell])

  useEffect(() => {
    if (!selectedCell?.date) {
      return
    }
    const container = scrollRef.current
    const root = rootRef.current
    if (!container || !root) {
      return
    }
    const handleScroll = () => onSelectCell(null)
    const handlePointerDown = (event) => {
      if (!root.contains(event.target)) {
        onSelectCell(null)
      }
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onSelectCell, scrollRef, selectedCell])

  return (
    <div ref={rootRef} className={`relative ${rootClassName}`.trim()}>
      {header ? <div className="flex items-center">{header}</div> : null}

      <div
        className={`rounded-2xl border border-black/15 bg-white p-3 shadow-[0_12px_24px_rgba(15,23,42,0.06)] ${cardClassName}`.trim()}
      >
        <div ref={scrollRef} className="heatmap-scroll overflow-x-scroll pb-1 pr-2">
          <div className="relative" style={{ minWidth: `${model.minWidthPx}px` }}>
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${model.weeks}, ${HEATMAP_CELL_PX}px)`,
              }}
            >
              {Array.from({ length: model.weeks }).map((_, colIdx) => (
                <div key={colIdx} className="grid grid-rows-7 gap-1">
                  {Array.from({ length: HEATMAP_ROWS }).map((_, rowIdx) => {
                    const index = colIdx * HEATMAP_ROWS + rowIdx
                    const cell = model.cells[index]
                    return (
                      <div
                        key={`${colIdx}-${rowIdx}`}
                        className={`h-4 w-4 rounded-[2px] ${
                          cell.date ? levelClasses[cell.level] : 'bg-transparent'
                        } ${cell.date && selectedCell?.date === cell.date ? 'ring-2 ring-black/70' : ''}`}
                        data-date={cell.date ?? undefined}
                        role={cell.date ? 'button' : undefined}
                        tabIndex={cell.date ? 0 : undefined}
                        onClick={() => {
                          if (!cell.date) {
                            return
                          }
                          if (selectedCell?.date === cell.date) {
                            onSelectCell(null)
                            return
                          }
                          onSelectCell({ ...cell, colIdx, rowIdx })
                        }}
                        onKeyDown={(event) => {
                          if (cell.date && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault()
                            onSelectCell({ ...cell, colIdx, rowIdx })
                          }
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-2 h-6" style={{ minWidth: `${model.minWidthPx}px` }}>
            {monthMarkers.map((marker, index) => (
              <div
                key={marker.key}
                className="absolute top-0 text-[10px] font-semibold text-muted-foreground"
                style={{ left: `${marker.leftPx}px` }}
              >
                <div className="h-2 border-l border-black/20" />
                <div className={`mt-1 ${index === 0 ? '' : '-translate-x-1'}`.trim()}>
                  {marker.label}
                </div>
              </div>
            ))}
          </div>
        </div>
        {selectedCell?.date ? (
          <div
            className="pointer-events-none absolute z-20 rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white shadow-lg"
            style={{ left: `${tooltipLeft}px`, top: `${tooltipTop}px` }}
          >
            {selectedCell.date} : {selectedCell.solveCount}문제 해결
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-semibold text-muted-foreground">
          <div className="flex items-center gap-3">
            {levelClasses.map((cls, index) => (
              <span key={cls} className="flex items-center gap-0.5">
                <span className={`h-2.5 w-2.5 rounded-[2px] ${cls}`} />
                <span>{index}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
