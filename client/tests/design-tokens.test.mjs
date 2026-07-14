import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import {
  DEFAULT_OUTPUT_FILE,
  DEFAULT_TOKEN_FILE,
  findDuplicateJsonKeys,
  flattenTokens,
  generateCss,
  parseTokenSource,
  resolveTokenValues,
} from '../../scripts/generate-design-tokens.mjs'

const repoRoot = join(import.meta.dirname, '..', '..')
const tokenSource = readFileSync(DEFAULT_TOKEN_FILE, 'utf8')
const tokens = parseTokenSource(tokenSource)
const flattenedTokens = flattenTokens(tokens)
const resolvedTokens = resolveTokenValues(flattenedTokens)
const generatedCss = generateCss(tokens)
const committedGeneratedCss = readFileSync(DEFAULT_OUTPUT_FILE, 'utf8')

const requiredTokenPaths = [
  'primitive.color.constructionYellow.500',
  'primitive.color.sky.500',
  'primitive.color.danger.500',
  'primitive.color.terrainGreen.500',
  'primitive.color.earthBrown.500',
  'primitive.color.neutral.950',
  'primitive.color.checker.lightA',
  'primitive.color.checker.lightB',
  'primitive.color.grid.major',
  'primitive.color.grid.minor',
  'semantic.color.launcher.background.top',
  'semantic.color.launcher.titleSurface',
  'semantic.color.studio.canvas.checkerA',
  'semantic.color.studio.canvas.gridMajor',
  'semantic.color.game.hudSurface',
  'component.color.button.primary.background',
  'component.color.button.primary.text',
  'component.color.badge.failed',
  'spacing.4',
  'radius.md',
  'typography.font.ui',
  'typography.font.display',
  'typography.font.timer',
  'opacity.overlay.subtle',
  'effects.shadow.panel',
  'z-index.modal',
  'motion.duration.fast',
  'motion.easing.standard',
]

for (const tokenPath of requiredTokenPaths) {
  assert.equal(flattenedTokens.has(tokenPath), true, `missing token ${tokenPath}`)
}

const requiredCssVariables = [
  '--font-ui',
  '--font-display',
  '--font-timer',
  '--primitive-color-construction-yellow-500',
  '--primitive-color-sky-500',
  '--primitive-color-danger-500',
  '--primitive-color-terrain-green-500',
  '--primitive-color-earth-brown-500',
  '--primitive-color-neutral-950',
  '--semantic-color-launcher-background-top',
  '--semantic-color-launcher-title-surface',
  '--semantic-color-studio-canvas-checker-a',
  '--semantic-color-studio-canvas-grid-major',
  '--semantic-color-game-hud-surface',
  '--component-color-button-primary-background',
  '--component-color-button-primary-text',
  '--spacing-4',
  '--radius-md',
  '--opacity-overlay-subtle',
  '--effects-shadow-panel',
  '--z-index-modal',
  '--motion-duration-fast',
]

for (const variableName of requiredCssVariables) {
  assert.match(generatedCss, new RegExp(`${escapeRegExp(variableName)}:`), `missing ${variableName}`)
}

assert.equal(resolvedTokens.get('primitive.color.constructionYellow.500'), '#F6BE00')
assert.equal(resolvedTokens.get('primitive.color.sky.500'), '#4A9DE0')
assert.equal(resolvedTokens.get('primitive.color.danger.500'), '#E52521')
assert.equal(resolvedTokens.get('primitive.color.terrainGreen.500'), '#43A047')
assert.equal(resolvedTokens.get('primitive.color.earthBrown.500'), '#8B5A2B')
assert.equal(resolvedTokens.get('primitive.color.neutral.950'), '#111827')
assert.equal(resolvedTokens.get('component.color.button.primary.background'), '#F6BE00')
assert.equal(resolvedTokens.get('component.color.button.primary.text'), '#111827')

assert.equal(findDuplicateJsonKeys(tokenSource).length, 0)
assert.equal(findDuplicateJsonKeys('{"a":1,"b":{"c":2,"c":3},"a":4}').length, 2)

const aliasReferences = collectAliasReferences(flattenedTokens)

assert.ok(aliasReferences.length > 0, 'expected semantic/component aliases')
for (const alias of aliasReferences) {
  assert.equal(
    flattenedTokens.has(alias.targetPath),
    true,
    `${alias.sourcePath} references missing alias ${alias.targetPath}`,
  )
}

assert.equal(generateCss(tokens), generatedCss, 'CSS generation must be deterministic')
assert.equal(committedGeneratedCss, generatedCss, 'tokens.generated.css must match design/tokens.json')
assert.match(committedGeneratedCss, /AUTO-GENERATED FILE\. DO NOT EDIT\./)

const rawHexViolations = findRawHexInV2UiPaths()

assert.deepEqual(rawHexViolations, [], `raw hex found in V2 UI paths:\n${rawHexViolations.join('\n')}`)

console.log('design token contract self-test passed')

function collectAliasReferences(tokensByPath) {
  const references = []
  const aliasPattern = /^\{([^{}]+)\}$/

  for (const [sourcePath, token] of tokensByPath.entries()) {
    if (typeof token.value !== 'string') {
      continue
    }

    const aliasMatch = aliasPattern.exec(token.value)

    if (aliasMatch) {
      references.push({
        sourcePath,
        targetPath: aliasMatch[1],
      })
    }
  }

  return references
}

function findRawHexInV2UiPaths() {
  const candidateRoots = [
    'client/src/app',
    'client/src/pages',
    'client/src/features',
    'client/src/design-system',
    'client/src/fixtures',
    'client/src/styles',
  ]
  const ignoredFiles = new Set(['client/src/styles/tokens.generated.css'])
  const checkedExtensions = new Set(['.css', '.ts', '.tsx', '.js', '.jsx', '.html'])
  const rawHexPattern = /(^|[^A-Za-z0-9])#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})(?![A-Za-z0-9])/g
  const violations = []

  for (const root of candidateRoots) {
    const absoluteRoot = join(repoRoot, root)

    if (!existsSync(absoluteRoot)) {
      continue
    }

    for (const filePath of walkFiles(absoluteRoot)) {
      const relativePath = relative(repoRoot, filePath)

      if (ignoredFiles.has(relativePath) || !checkedExtensions.has(getExtension(filePath))) {
        continue
      }

      const source = readFileSync(filePath, 'utf8')
      const lines = source.split('\n')

      lines.forEach((line, lineIndex) => {
        if (rawHexPattern.test(line)) {
          violations.push(`${relativePath}:${lineIndex + 1}`)
        }

        rawHexPattern.lastIndex = 0
      })
    }
  }

  return violations
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

function getExtension(filePath) {
  const fileName = filePath.split('/').at(-1) ?? filePath
  const dotIndex = fileName.lastIndexOf('.')

  return dotIndex === -1 ? '' : fileName.slice(dotIndex)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
