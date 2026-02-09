import React, { useRef, useState } from 'react'
import { Box } from '@mui/material'

const HANDLE_HEIGHT = 5
const MIN_PANE_SIZE = 80

interface ResizableSplitterProps {
    totalHeight: number
    defaultFraction?: number
    minTopHeight?: number
    minBottomHeight?: number
    topContent: (height: number) => React.ReactNode
    bottomContent: (height: number) => React.ReactNode
}

export const SPLITTER_HEIGHT = HANDLE_HEIGHT

export default function ResizableSplitter({
    totalHeight,
    defaultFraction = 0.45,
    minTopHeight = MIN_PANE_SIZE,
    minBottomHeight = MIN_PANE_SIZE,
    topContent,
    bottomContent,
}: ResizableSplitterProps) {
    const [topHeight, setTopHeight] = useState<number | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    const effectiveTopHeight = topHeight !== null ? topHeight : Math.floor(totalHeight * defaultFraction)
    const clampedTopHeight = Math.max(
        minTopHeight,
        Math.min(effectiveTopHeight, totalHeight - HANDLE_HEIGHT - minBottomHeight)
    )
    const bottomHeight = totalHeight - HANDLE_HEIGHT - clampedTopHeight

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        setIsDragging(true)

        const container = containerRef.current
        if (!container) return
        const containerTop = container.getBoundingClientRect().top

        const onPointerMove = (ev: PointerEvent) => {
            const newTop = ev.clientY - containerTop
            const clamped = Math.max(minTopHeight, Math.min(newTop, totalHeight - HANDLE_HEIGHT - minBottomHeight))
            setTopHeight(clamped)
        }

        const onPointerUp = () => {
            setIsDragging(false)
            document.removeEventListener('pointermove', onPointerMove)
            document.removeEventListener('pointerup', onPointerUp)
        }

        document.addEventListener('pointermove', onPointerMove)
        document.addEventListener('pointerup', onPointerUp)
    }

    const handleDoubleClick = () => {
        setTopHeight(null)
    }

    return (
        <Box ref={containerRef} sx={{ height: totalHeight, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ height: clampedTopHeight, overflow: 'hidden' }}>{topContent(clampedTopHeight)}</Box>
            <Box
                onPointerDown={handlePointerDown}
                onDoubleClick={handleDoubleClick}
                sx={{
                    height: HANDLE_HEIGHT,
                    cursor: 'row-resize',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: isDragging ? 'primary.main' : 'transparent',
                    borderTop: 1,
                    borderBottom: 1,
                    borderColor: isDragging ? 'primary.main' : 'divider',
                    transition: isDragging ? 'none' : 'background-color 0.15s',
                    userSelect: 'none',
                    flexShrink: 0,
                    '&:hover': {
                        bgcolor: 'primary.main',
                        borderColor: 'primary.main',
                        opacity: 0.7,
                    },
                }}
            />
            <Box sx={{ height: bottomHeight, overflow: 'hidden' }}>{bottomContent(bottomHeight)}</Box>
        </Box>
    )
}
