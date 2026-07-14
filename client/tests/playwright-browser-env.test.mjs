import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const browserPath = findChromiumHeadlessShell()

if (!browserPath) {
  console.error('Playwright Chromium headless shell is not installed.')
  console.error('Run: npm exec --workspace client playwright -- install chromium')
  console.error(`Searched: ${getPlaywrightCacheRoots().join(', ')}`)
  process.exit(1)
}

const missingLibraries = listMissingLibraries(browserPath)

if (missingLibraries.length > 0) {
  console.error('Playwright Chromium is missing system libraries:')
  for (const library of missingLibraries) {
    console.error(`- ${library}`)
  }
  console.error('')
  console.error('Suggested repair in an environment with sudo/root:')
  console.error('  npm exec --workspace client playwright -- install-deps chromium --dry-run')
  console.error('  sudo npx playwright install-deps chromium')
  process.exit(1)
}

console.log('playwright browser environment check passed')

function findChromiumHeadlessShell() {
  return getPlaywrightCacheRoots()
    .flatMap((cacheRoot) => findChromiumHeadlessShellIn(cacheRoot))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0] ?? null
}

function getPlaywrightCacheRoots() {
  const roots = []

  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0') {
    roots.push(process.env.PLAYWRIGHT_BROWSERS_PATH)
  }

  if (process.env.HOME) {
    roots.push(join(process.env.HOME, '.cache', 'ms-playwright'))
  }

  roots.push('/ms-playwright')

  return [...new Set(roots)]
}

function findChromiumHeadlessShellIn(cacheRoot) {
  if (!existsSync(cacheRoot)) {
    return []
  }

  return readdirSync(cacheRoot)
    .filter((entry) => entry.startsWith('chromium_headless_shell-'))
    .map((entry) =>
      join(cacheRoot, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
    )
    .filter((candidate) => existsSync(candidate))
}

function listMissingLibraries(binaryPath) {
  const output = execFileSync('ldd', [binaryPath], {
    encoding: 'utf8',
  })

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('=> not found'))
    .map((line) => line.split('=>')[0].trim())
    .sort()
}
