import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const gitEnv = { ...process.env }

delete gitEnv.GIT_DIR
delete gitEnv.GIT_WORK_TREE
delete gitEnv.GIT_INDEX_FILE
delete gitEnv.GIT_OBJECT_DIRECTORY
delete gitEnv.GIT_CEILING_DIRECTORIES
delete gitEnv.GIT_ALTERNATE_OBJECT_DIRECTORIES

execFileSync('git', ['-C', repoRoot, 'diff', '--check'], {
  env: gitEnv,
  stdio: 'inherit',
})
