import React, { useLayoutEffect, useRef, useState } from 'react'
import { Box, CssBaseline, useMediaQuery } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { darkTheme, lightTheme } from './theme'
import ErrorBoundary from './controls/ErrorBoundary'
import QueryEditor from './QueryEditor'

export default function App() {
    const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
    const containerRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState(0)

    useLayoutEffect(() => {
        const el = containerRef.current
        if (!el) return

        setHeight(el.getBoundingClientRect().height)

        const ro = new ResizeObserver(([entry]) => {
            setHeight(entry.contentRect.height)
        })
        ro.observe(el)

        return () => ro.disconnect()
    }, [])

    return (
        <ThemeProvider theme={prefersDarkMode ? darkTheme : lightTheme}>
            <CssBaseline />
            <ErrorBoundary>
                <Box
                    sx={{
                        height: '100vh',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box
                        ref={containerRef}
                        sx={{
                            flex: 1,
                            minHeight: 0,
                        }}
                    >
                        {height > 0 && <QueryEditor height={height} />}
                    </Box>
                </Box>
            </ErrorBoundary>
        </ThemeProvider>
    )
}
