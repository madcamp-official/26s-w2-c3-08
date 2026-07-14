import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const clientRoot = dirname(fileURLToPath(import.meta.url))
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000'
const defaultAllowedHosts = ['mad-mario.madcamp-kaist.org', '192.168.0.200']
const allowedHosts = [
  ...new Set([
    ...defaultAllowedHosts,
    ...(process.env.VITE_ALLOWED_HOSTS ?? '')
      .split(',')
      .map((host) => host.trim())
      .filter(Boolean),
  ]),
]
const backendProxy = {
  '/api': {
    target: apiProxyTarget,
    changeOrigin: true,
  },
  '/socket.io': {
    target: apiProxyTarget,
    changeOrigin: true,
    ws: true,
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(clientRoot, 'index.html'),
        uiV2: resolve(clientRoot, 'ui-v2.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    allowedHosts,
    proxy: backendProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
    allowedHosts,
    proxy: backendProxy,
  },
})
