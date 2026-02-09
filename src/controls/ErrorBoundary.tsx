import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Alert, AlertTitle, Box, Button } from '@mui/material'

interface ErrorBoundaryProps {
    children: ReactNode
}

interface ErrorBoundaryState {
    error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error }
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack)
    }

    handleReset = () => {
        this.setState({ error: null })
    }

    render() {
        if (this.state.error) {
            return (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100vh',
                        p: 3,
                    }}
                >
                    <Alert
                        severity="error"
                        sx={{ maxWidth: 600 }}
                        action={
                            <Button color="inherit" size="small" onClick={this.handleReset}>
                                Retry
                            </Button>
                        }
                    >
                        <AlertTitle>Something went wrong</AlertTitle>
                        {this.state.error.message}
                    </Alert>
                </Box>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
