import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')
const componentRoot = join(repoRoot, 'client', 'src', 'design-system', 'components')
const uiLabSource = read('client/src/dev/ui-lab/UiLab.tsx')

const requiredComponents = [
  'TextField',
  'TextArea',
  'Tabs',
  'FilterChip',
  'Badge',
  'ProgressBar',
  'Modal',
  'Toast',
  'Tooltip',
  'EmptyState',
  'LoadingState',
  'ErrorState',
  'ConnectionState',
]

for (const componentName of requiredComponents) {
  assert.equal(
    statSync(join(componentRoot, componentName, `${componentName}.tsx`)).isFile(),
    true,
    `${componentName} source is missing`,
  )
  assert.equal(
    statSync(join(componentRoot, componentName, `${componentName}.module.css`)).isFile(),
    true,
    `${componentName} styles are missing`,
  )
}

const textFieldSource = read('client/src/design-system/components/TextField/TextField.tsx')
const textAreaSource = read('client/src/design-system/components/TextArea/TextArea.tsx')
const tabsSource = read('client/src/design-system/components/Tabs/Tabs.tsx')
const badgeSource = read('client/src/design-system/components/Badge/Badge.tsx')
const progressSource = read('client/src/design-system/components/ProgressBar/ProgressBar.tsx')
const modalSource = read('client/src/design-system/components/Modal/Modal.tsx')
const tooltipSource = read('client/src/design-system/components/Tooltip/Tooltip.tsx')
const connectionSource = read('client/src/design-system/components/ConnectionState/ConnectionState.tsx')

for (const fieldSource of [textFieldSource, textAreaSource]) {
  assert.match(fieldSource, /label/)
  assert.match(fieldSource, /helper/)
  assert.match(fieldSource, /error/)
  assert.match(fieldSource, /disabled/)
  assert.match(fieldSource, /required/)
  assert.match(fieldSource, /aria-describedby=\{describedBy\}/)
  assert.match(fieldSource, /aria-invalid=\{Boolean\(error\) \|\| undefined\}/)
  assert.match(fieldSource, /aria-required=\{required \|\| undefined\}/)
}

assert.match(textFieldSource, /onSubmit/)
assert.match(textFieldSource, /event\.key === 'Enter'/)
assert.match(textFieldSource, /aria-busy=\{loading \|\| undefined\}/)
assert.match(textAreaSource, /maxLength/)

for (const keyboardPattern of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
  assert.match(tabsSource, new RegExp(keyboardPattern), `Tabs missing ${keyboardPattern}`)
}
assert.match(tabsSource, /role="tablist"/)
assert.match(tabsSource, /role="tab"/)
assert.match(tabsSource, /aria-selected=\{selected\}/)
assert.match(tabsSource, /aria-controls=\{tab\.panelId\}/)

for (const state of ['queued', 'generating', 'ready', 'failed', 'offline', 'reconnecting']) {
  assert.match(badgeSource, new RegExp(`['"]${state}['"]`), `Badge missing ${state}`)
}
assert.match(badgeSource, /BadgeIcon/)
assert.match(badgeSource, /visibleLabel/)
assert.match(badgeSource, /aria-label=\{ariaLabel \?\? visibleLabel\}/)

assert.match(progressSource, /role="progressbar"/)
assert.match(progressSource, /aria-valuenow=\{indeterminate \? undefined : boundedValue\}/)
assert.match(progressSource, /indeterminate/)

assert.match(modalSource, /createPortal/)
assert.match(modalSource, /role="dialog"/)
assert.match(modalSource, /aria-modal="true"/)
assert.match(modalSource, /aria-labelledby=\{titleId\}/)
assert.match(modalSource, /aria-describedby=\{description \? descriptionId : undefined\}/)
assert.match(modalSource, /event\.key === 'Escape'/)
assert.match(modalSource, /event\.key !== 'Tab'/)
assert.match(modalSource, /document\.activeElement/)
assert.match(modalSource, /document\.body\.style\.overflow/)
assert.match(modalSource, /restoreFocusRef\.current\.focus\(\)/)
assert.match(modalSource, /data-backdrop-policy=\{backdropPolicy\}/)
assert.match(modalSource, /activeModalCount > 0/)
assert.match(modalSource, /Nested Modal is not supported/)

assert.match(tooltipSource, /role="tooltip"/)
assert.match(tooltipSource, /aria-describedby/)
assert.match(tooltipSource, /onFocus/)
assert.match(tooltipSource, /onMouseEnter/)

for (const status of ['online', 'offline', 'reconnecting', 'server_unavailable', 'malformed_response']) {
  assert.match(connectionSource, new RegExp(`['"]${status}['"]`), `ConnectionState missing ${status}`)
}

for (const componentName of requiredComponents) {
  assert.match(uiLabSource, new RegExp(componentName), `UI Lab missing ${componentName}`)
}
for (const state of ['queued', 'generating', 'ready', 'failed', 'offline', 'reconnecting']) {
  assert.match(uiLabSource, new RegExp(`['"]${state}['"]`), `UI Lab missing badge state ${state}`)
}
assert.match(uiLabSource, /longText/)
assert.match(uiLabSource, /previewState === 'loading'/)
assert.match(uiLabSource, /previewState === 'error'/)

const forbiddenImportPattern = /(zustand|appStore|localStorage|realtime|socket|api\/|net\/|phaser)/i
const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/g
const rawColorFunctionPattern = /\brgba?\(/
const violations = []

for (const filePath of walkFiles(componentRoot)) {
  const source = readFileSync(filePath, 'utf8')
  const relativePath = relative(repoRoot, filePath)

  if (forbiddenImportPattern.test(source)) {
    violations.push(`${relativePath}: forbidden runtime import reference`)
  }

  if (rawColorFunctionPattern.test(source)) {
    violations.push(`${relativePath}: raw rgb/rgba usage`)
  }

  source.split('\n').forEach((line, index) => {
    if (rawHexPattern.test(line)) {
      violations.push(`${relativePath}:${index + 1}: raw hex usage`)
    }

    rawHexPattern.lastIndex = 0
  })
}

assert.deepEqual(violations, [], `core component contract violations:\n${violations.join('\n')}`)

console.log('core component contract self-test passed')

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
