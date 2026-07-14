import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const isWindows = process.platform === 'win32'
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const backendRoot = join(repoRoot, 'backend')
const clientRoot = join(repoRoot, 'client')
const backendTsx = binPath(backendRoot, 'tsx')
const vite = binPath(repoRoot, 'vite')
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000'
const clientPort = process.env.VITE_CLIENT_PORT ?? '5174'
const backendPort = new URL(apiProxyTarget).port || '3000'
const dataMode = process.env.VITE_DATA_MODE ?? 'remote'
const realtimeMode = process.env.VITE_REALTIME_MODE ?? 'remote'
const children = new Set()
let shuttingDown = false

console.log('Starting Frontend V2 dev services')
console.log(`- backend: ${apiProxyTarget}`)
console.log(`- client:  http://localhost:${clientPort}/ui-v2.html#/login`)
console.log(`- modes:   VITE_DATA_MODE=${dataMode}, VITE_REALTIME_MODE=${realtimeMode}`)
console.log('')

startService(
  'backend',
  backendTsx,
  ['src/index.ts'],
  {
    PORT: backendPort,
    CORS_ORIGIN: `http://localhost:${clientPort}`,
  },
  backendRoot,
)

startService(
  'client',
  vite,
  [],
  {
    VITE_API_PROXY_TARGET: apiProxyTarget,
    VITE_DATA_MODE: dataMode,
    VITE_REALTIME_MODE: realtimeMode,
  },
  clientRoot,
)

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit', () => {
  for (const child of children) {
    terminateChild(child, 'SIGTERM')
  }
})

function startService(label, command, args, extraEnv, cwd = repoRoot) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })

  children.add(child)

  child.on('exit', (code, signal) => {
    children.delete(child)

    if (shuttingDown) {
      return
    }

    const exitCode = typeof code === 'number' ? code : 1
    console.error(`${label} exited${signal ? ` from ${signal}` : ` with code ${exitCode}`}`)
    shutdown(exitCode)
  })

  child.on('error', (error) => {
    console.error(`${label} failed to start: ${error.message}`)
    shutdown(1)
  })
}

function shutdown(exitCode) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  const runningChildren = Array.from(children)

  if (runningChildren.length === 0) {
    process.exit(exitCode)
  }

  for (const child of runningChildren) {
    terminateChild(child, 'SIGTERM')
  }

  const forceExit = setTimeout(() => {
    for (const child of runningChildren) {
      terminateChild(child, 'SIGKILL')
    }
    process.exit(exitCode)
  }, 1_000)

  Promise.allSettled(
    runningChildren.map((child) =>
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise((resolve) => child.once('exit', resolve)),
    ),
  ).then(() => {
    clearTimeout(forceExit)
    process.exit(exitCode)
  })
}

function terminateChild(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }

  try {
    child.kill(signal)
  } catch (error) {
    if (error.code !== 'ESRCH') {
      console.error(`failed to send ${signal} to child ${child.pid}: ${error.message}`)
    }
  }
}

function binPath(packageRoot, command) {
  return join(packageRoot, 'node_modules', '.bin', isWindows ? `${command}.cmd` : command)
}
