import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')
const primitiveRoot = join(repoRoot, 'client', 'src', 'design-system', 'primitives')
const uiLabPath = join(repoRoot, 'client', 'src', 'dev', 'ui-lab', 'UiLab.tsx')

const buttonSource = read('client/src/design-system/primitives/Button/Button.tsx')
const buttonCss = read('client/src/design-system/primitives/Button/Button.module.css')
const iconButtonSource = read('client/src/design-system/primitives/IconButton/IconButton.tsx')
const iconButtonCss = read('client/src/design-system/primitives/IconButton/IconButton.module.css')
const uiLabSource = read('client/src/dev/ui-lab/UiLab.tsx')

assert.match(buttonSource, /export type ButtonVariant = 'primary' \| 'secondary' \| 'danger' \| 'ghost'/)
assert.match(buttonSource, /export type ButtonSize = 'small' \| 'medium' \| 'large'/)
for (const prop of ['loading', 'disabled', 'fullWidth', 'iconStart', 'iconEnd']) {
  assert.match(buttonSource, new RegExp(`${prop}\\??:`), `Button missing ${prop} prop`)
}

assert.match(buttonSource, /<button/)
assert.match(buttonSource, /type=\{type\}/)
assert.match(buttonSource, /disabled=\{isDisabled\}/)
assert.match(buttonSource, /aria-busy=\{loading \|\| undefined\}/)
assert.match(buttonSource, /data-variant=\{variant\}/)
assert.match(buttonSource, /data-size=\{size\}/)
assert.match(buttonSource, /data-state=\{state\}/)
assert.doesNotMatch(buttonSource, /role=['"]button['"]/)
assert.doesNotMatch(buttonSource, /onKeyDown/)

assert.match(iconButtonSource, /<button/)
assert.match(iconButtonSource, /'aria-label': string/)
assert.match(iconButtonSource, /aria-label=\{ariaLabel\}/)
assert.match(iconButtonSource, /aria-pressed=\{pressed \|\| undefined\}/)
assert.match(iconButtonSource, /disabled=\{isDisabled\}/)
assert.match(iconButtonSource, /aria-busy=\{loading \|\| undefined\}/)
assert.match(iconButtonSource, /data-size=\{size\}/)
assert.match(iconButtonSource, /data-state=\{state\}/)
assert.doesNotMatch(iconButtonSource, /role=['"]button['"]/)
assert.doesNotMatch(iconButtonSource, /onKeyDown/)

assert.match(buttonCss, /min-height: var\(--button-min-height\)/)
assert.match(buttonCss, /--button-min-height: var\(--spacing-10\)/)
assert.match(buttonCss, /:focus-visible/)
assert.match(buttonCss, /--button-text: var\(--component-color-button-primary-text\)/)
assert.doesNotMatch(buttonCss, /opacity:/)

assert.match(iconButtonCss, /min-width: var\(--icon-button-size\)/)
assert.match(iconButtonCss, /min-height: var\(--icon-button-size\)/)
assert.match(iconButtonCss, /--icon-button-size: var\(--spacing-10\)/)
assert.match(iconButtonCss, /:focus-visible/)
assert.doesNotMatch(iconButtonCss, /opacity:/)

for (const variant of ['primary', 'secondary', 'danger', 'ghost']) {
  assert.match(uiLabSource, new RegExp(`['"]${variant}['"]`), `UI Lab missing ${variant}`)
}
for (const size of ['small', 'medium', 'large']) {
  assert.match(uiLabSource, new RegExp(`['"]${size}['"]`), `UI Lab missing ${size}`)
}
for (const state of ['loading', 'disabled', 'pressed']) {
  assert.match(uiLabSource, new RegExp(state), `UI Lab missing ${state}`)
}
assert.match(uiLabSource, /aria-label=\{`\$\{size\} icon button`\}/)
assert.match(uiLabSource, /fill="currentColor"/)

const rawHexViolations = []
const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/g

for (const filePath of walkFiles(primitiveRoot)) {
  const source = readFileSync(filePath, 'utf8')
  const relativePath = relative(repoRoot, filePath)

  source.split('\n').forEach((line, index) => {
    if (rawHexPattern.test(line)) {
      rawHexViolations.push(`${relativePath}:${index + 1}`)
    }

    rawHexPattern.lastIndex = 0
  })
}

assert.deepEqual(rawHexViolations, [], `raw hex found in primitives:\n${rawHexViolations.join('\n')}`)

assert.equal(statSync(uiLabPath).isFile(), true)
console.log('primitive component contract self-test passed')

function read(path) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

function walkFiles(root) {
  const files = []

  for (const entry of readdirSync(root)) {
    const entryPath = join(root, entry)
    const stat = statSync(entryPath)

    if (stat.isDirectory()) {
      files.push(...walkFiles(entryPath))
    } else if (stat.isFile()) {
      files.push(entryPath)
    }
  }

  return files
}
