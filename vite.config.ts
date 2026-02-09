import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/v4': {
                target: 'http://localhost:8083',
                changeOrigin: true,
                secure: false,
            },
            '/api_versions': {
                target: 'http://localhost:8083',
                changeOrigin: true,
                secure: false,
            },
            '/info': {
                target: 'http://localhost:8083',
                changeOrigin: true,
                secure: false,
            },
        },
    },
})
