import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

execFileSync('git', ['-C', repoRoot, 'diff', '--check'], {
  stdio: 'inherit',
})
