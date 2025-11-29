import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const version = fs.readFileSync(path.resolve(__dirname, '../VERSION'), 'utf-8').trim()

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        '__APP_VERSION__': JSON.stringify(version)
    },
    plugins: [react()],
    server: {
        host: '0.0.0.0',
        port: 5173,
        watch: {
            usePolling: true,
        },
        proxy: {
            '/api': {
                target: 'http://backend:8000',
                changeOrigin: true,
                secure: false,
            },
            '/auth': {
                target: 'http://backend:8000',
                changeOrigin: true,
                secure: false,
            },
            '/users': {
                target: 'http://backend:8000',
                changeOrigin: true,
                secure: false,
            },
            '/admin': {
                target: 'http://backend:8000',
                changeOrigin: true,
                secure: false,
                bypass: (req, res, options) => {
                    if (req.headers.accept && req.headers.accept.includes('text/html')) {
                        return req.url
                    }
                }
            }
        }
    },
})
