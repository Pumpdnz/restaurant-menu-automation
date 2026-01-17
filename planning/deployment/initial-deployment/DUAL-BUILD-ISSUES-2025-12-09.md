# Dual Build Issues: Railway + Netlify (2025-12-09)

**Status: RESOLVED** ✅

## Problem Summary

The application needs to run on two platforms with conflicting module system requirements:
- **Railway**: Node.js server requiring CommonJS (`require`/`module.exports`)
- **Netlify**: Vite frontend build requiring ES Modules (`import`/`export`)

## Issue 1: ESM/CommonJS Conflict in platform-detector.js

### Timeline
1. **Commit 511b086**: Removed ESM exports to fix Railway build
2. **Commit 165fbd4**: Added ESM exports back to fix Netlify/Vite build - broke Railway
3. **Commit 8c37a6f**: Reverted to pure CommonJS - broke Netlify (Vite can't import CJS named exports)
4. **Commit 6b883e7**: Created ESM wrapper file - broke Netlify (Rollup can't import CJS default)
5. **Commit 3843d9c**: Made ESM file self-contained - **WORKS ON BOTH** ✅

### The Problem
Node.js parses files BEFORE executing code. ESM `export` syntax in a CommonJS context throws `SyntaxError: Unexpected token 'export'` at parse time. Additionally, Rollup/Vite cannot properly import CommonJS default exports.

### Final Solution: Dual File Strategy
Two completely independent files with identical logic:

| File | Module System | Used By |
|------|--------------|---------|
| `platform-detector.js` | CommonJS (`module.exports`) | Node.js/Railway server |
| `platform-detector.esm.js` | ESM (`export {}`) | Vite/Netlify frontend |

**Trade-off**: Code duplication, but guaranteed to work on both platforms.

**Important**: Keep both files in sync when making changes to platform detection logic.

## Issue 2: Playwright Version Mismatch

### The Problem
- **Dockerfile**: `mcr.microsoft.com/playwright:v1.40.0-jammy`
- **package.json**: `"playwright": "^1.54.2"`

### Solution
Updated Dockerfile to `mcr.microsoft.com/playwright:v1.54.0-jammy`

## Issue 3: Architecture Consideration (Future)

Playwright scripts run as child processes via `child_process.exec`. This works but has concerns:
- Resource constraints in containerized environments
- No X server (headless mode required)
- Ephemeral storage for screenshots

**Future consideration**: Queue-based processing or dedicated worker container.

## Final Build Status

| Platform | Status | Build Date |
|----------|--------|------------|
| Railway  | ✅ Success | 2025-12-09 |
| Netlify  | ✅ Success | 2025-12-09 |

## Key Commits

| Commit | Description |
|--------|-------------|
| `8c37a6f` | Fix dual-platform deployment: Railway + Netlify |
| `6b883e7` | Add ESM wrapper for platform-detector |
| `3843d9c` | Make platform-detector.esm.js self-contained (final fix) |

## Files Changed

- `Dockerfile` - Updated Playwright version to v1.54.0-jammy
- `UberEats-Image-Extractor/src/utils/platform-detector.js` - Pure CommonJS
- `UberEats-Image-Extractor/src/utils/platform-detector.esm.js` - Pure ESM (new file)
- `UberEats-Image-Extractor/src/pages/NewExtraction.jsx` - Updated import path
