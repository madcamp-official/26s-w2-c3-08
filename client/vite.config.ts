import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    allowedHosts,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
    allowedHosts,
  },
})
