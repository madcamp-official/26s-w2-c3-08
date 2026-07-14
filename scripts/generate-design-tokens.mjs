#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = dirname(dirname(scriptPath))

export const DEFAULT_TOKEN_FILE = join(repoRoot, 'design', 'tokens.json')
export const DEFAULT_OUTPUT_FILE = join(repoRoot, 'client', 'src', 'styles', 'tokens.generated.css')

const ALIAS_PATTERN = /^\{([^{}]+)\}$/
const GENERATED_HEADER = `/*
 * AUTO-GENERATED FILE. DO NOT EDIT.
 * Source: design/tokens.json
 * Generator: scripts/generate-design-tokens.mjs
 */
`

export function findDuplicateJsonKeys(source) {
  const duplicates = []
  const stack = []
  let index = 0

  while (index < source.length) {
    const character = source[index]

    if (character === '"') {
      const { value, endIndex } = readJsonString(source, index)
      index = endIndex
      const nextIndex = skipWhitespace(source, index)
      const currentScope = stack[stack.length - 1]

      if (currentScope?.type === 'object' && source[nextIndex] === ':') {
        if (currentScope.keys.has(value)) {
          duplicates.push({
            key: value,
            offset: index,
          })
        }

        currentScope.keys.add(value)
      }

      continue
    }

    if (character === '{') {
      stack.push({ type: 'object', keys: new Set() })
    } else if (character === '[') {
      stack.push({ type: 'array' })
    } else if (character === '}' || character === ']') {
      stack.pop()
    }

    index += 1
  }

  return duplicates
}

export function parseTokenSource(source, sourceLabel = 'design/tokens.json') {
  const duplicateKeys = findDuplicateJsonKeys(source)

  if (duplicateKeys.length > 0) {
    const keys = duplicateKeys.map((duplicate) => duplicate.key).join(', ')
    throw new Error(`${sourceLabel} has duplicate JSON keys: ${keys}`)
  }

  return JSON.parse(source)
}

export function flattenTokens(tokens) {
  const flattened = new Map()

  collectTokenLeaves(tokens, [], flattened)

  return flattened
}

export function resolveTokenValues(flattenedTokens) {
  const resolved = new Map()

  for (const tokenPath of [...flattenedTokens.keys()].sort()) {
    resolved.set(tokenPath, resolveTokenValue(tokenPath, flattenedTokens, resolved, []))
  }

  return resolved
}

export function generateCss(tokens) {
  const flattenedTokens = flattenTokens(tokens)
  const resolvedTokens = resolveTokenValues(flattenedTokens)
  const declarations = []
  const cssVariableNames = new Set()

  for (const [tokenPath, token] of [...flattenedTokens.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const cssVariableName = getCssVariableName(tokenPath, token)

    if (cssVariableNames.has(cssVariableName)) {
      throw new Error(`Duplicate CSS variable name: ${cssVariableName}`)
    }

    cssVariableNames.add(cssVariableName)
    declarations.push({
      name: cssVariableName,
      value: resolvedTokens.get(tokenPath),
    })
  }

  declarations.sort((left, right) => left.name.localeCompare(right.name))

  const body = declarations
    .map((declaration) => `  ${declaration.name}: ${declaration.value};`)
    .join('\n')

  return `${GENERATED_HEADER}:root {\n${body}\n}\n`
}

export function generateCssFromFile(tokenFilePath = DEFAULT_TOKEN_FILE) {
  const source = readFileSync(tokenFilePath, 'utf8')
  const tokens = parseTokenSource(source, relative(repoRoot, tokenFilePath))

  return generateCss(tokens)
}

export function writeGeneratedCss({
  tokenFilePath = DEFAULT_TOKEN_FILE,
  outputFilePath = DEFAULT_OUTPUT_FILE,
} = {}) {
  const css = generateCssFromFile(tokenFilePath)

  writeFileSync(outputFilePath, css)

  return css
}

export function checkGeneratedCss({
  tokenFilePath = DEFAULT_TOKEN_FILE,
  outputFilePath = DEFAULT_OUTPUT_FILE,
} = {}) {
  const expectedCss = generateCssFromFile(tokenFilePath)

  if (!existsSync(outputFilePath)) {
    return {
      ok: false,
      reason: `${relative(repoRoot, outputFilePath)} does not exist`,
      expectedCss,
    }
  }

  const actualCss = readFileSync(outputFilePath, 'utf8')

  return {
    ok: actualCss === expectedCss,
    reason:
      actualCss === expectedCss
        ? null
        : `${relative(repoRoot, outputFilePath)} is not up to date`,
    expectedCss,
    actualCss,
  }
}

function collectTokenLeaves(node, path, flattened) {
  if (!isRecord(node)) {
    throw new Error(`Token branch ${path.join('.') || '<root>'} must be an object`)
  }

  if (Object.hasOwn(node, 'value')) {
    const tokenPath = path.join('.')

    if (tokenPath.length === 0) {
      throw new Error('Root token cannot be a leaf')
    }

    if (flattened.has(tokenPath)) {
      throw new Error(`Duplicate token path: ${tokenPath}`)
    }

    flattened.set(tokenPath, node)
    return
  }

  for (const key of Object.keys(node).sort()) {
    collectTokenLeaves(node[key], [...path, key], flattened)
  }
}

function resolveTokenValue(tokenPath, flattenedTokens, resolvedTokens, resolutionStack) {
  if (resolvedTokens.has(tokenPath)) {
    return resolvedTokens.get(tokenPath)
  }

  if (resolutionStack.includes(tokenPath)) {
    throw new Error(`Circular token alias: ${[...resolutionStack, tokenPath].join(' -> ')}`)
  }

  const token = flattenedTokens.get(tokenPath)

  if (!token) {
    throw new Error(`Unknown token alias: ${tokenPath}`)
  }

  const rawValue = token.value

  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
    throw new Error(`Token ${tokenPath} value must be a string or number`)
  }

  const stringValue = String(rawValue)
  const aliasMatch = ALIAS_PATTERN.exec(stringValue)

  if (!aliasMatch) {
    resolvedTokens.set(tokenPath, stringValue)
    return stringValue
  }

  const aliasPath = aliasMatch[1]

  if (!flattenedTokens.has(aliasPath)) {
    throw new Error(`Token ${tokenPath} references missing alias ${aliasPath}`)
  }

  const resolvedValue = resolveTokenValue(aliasPath, flattenedTokens, resolvedTokens, [
    ...resolutionStack,
    tokenPath,
  ])

  resolvedTokens.set(tokenPath, resolvedValue)

  return resolvedValue
}

function getCssVariableName(tokenPath, token) {
  if (typeof token.cssVariable === 'string') {
    if (!token.cssVariable.startsWith('--')) {
      throw new Error(`Token ${tokenPath} cssVariable must start with "--"`)
    }

    return token.cssVariable
  }

  return `--${tokenPath
    .split('.')
    .map((segment) => toKebabCase(segment))
    .join('-')}`
}

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function skipWhitespace(source, startIndex) {
  let index = startIndex

  while (/\s/.test(source[index] ?? '')) {
    index += 1
  }

  return index
}

function readJsonString(source, startIndex) {
  let index = startIndex + 1
  let escaped = false

  while (index < source.length) {
    const character = source[index]

    if (escaped) {
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (character === '"') {
      const rawString = source.slice(startIndex, index + 1)

      return {
        value: JSON.parse(rawString),
        endIndex: index + 1,
      }
    }

    index += 1
  }

  throw new Error(`Unterminated JSON string at offset ${startIndex}`)
}

function parseCliArgs(args) {
  const options = {
    check: false,
    tokenFilePath: DEFAULT_TOKEN_FILE,
    outputFilePath: DEFAULT_OUTPUT_FILE,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--check') {
      options.check = true
    } else if (arg === '--tokens') {
      options.tokenFilePath = resolve(process.cwd(), args[index + 1])
      index += 1
    } else if (arg === '--out') {
      options.outputFilePath = resolve(process.cwd(), args[index + 1])
      index += 1
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function runCli() {
  const options = parseCliArgs(process.argv.slice(2))

  if (options.check) {
    const result = checkGeneratedCss(options)

    if (!result.ok) {
      console.error(`Design token check failed: ${result.reason}`)
      console.error('Run npm run tokens:generate --workspace client')
      process.exit(1)
    }

    console.log('Design token CSS is up to date')
    return
  }

  writeGeneratedCss(options)
  console.log(`Generated ${relative(repoRoot, options.outputFilePath)}`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === scriptPath) {
  runCli()
}
