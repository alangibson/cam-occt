# Browser Testing Strategy

## Automated Browser Testing Implementation

This document outlines the automated browser testing strategy for the CAM OCCT application, specifically for testing DXF file loading and OpenCascade.js integration.

## Test Architecture

### 1. Unit Tests (Fast, Mocked)
- **Location**: `src/test/*.test.ts`
- **Purpose**: Test individual components with mocked OpenCascade API
- **Status**: ✅ Implemented with clean stderr output

### 2. Integration Tests (Medium, Simulated)
- **Location**: `src/test/browser-integration.test.ts`
- **Purpose**: Test real API calls without full browser environment
- **Status**: ⚠️ Limited by WASM loading in Node.js

### 3. Application Startup Tests (Fast, Build Verification)
- **Location**: `src/test/application-startup.test.ts`
- **Purpose**: Verify build process and OpenCascade.js bundling
- **Status**: ✅ Implemented and passing

### 4. Browser E2E Tests (Slow, Real Browser)
- **Location**: `tests/e2e/*.spec.ts`
- **Purpose**: Test real browser functionality with actual DXF files
- **Status**: 🔄 Configured but requires browser installation

## Test Execution Strategy

### Immediate Verification (Without Full Browser Setup)
```bash
# 1. Run unit tests with clean stderr
npm test

# 2. Verify application builds correctly
npm run build

# 3. Check OpenCascade.js is bundled
find .svelte-kit/output -name "*opencascade*"

# 4. Start preview server for manual verification
npm run preview
```

### Full Browser Testing (When Browsers Available)
```bash
# Install browsers (slow - network dependent)
npx playwright install chromium

# Run E2E tests
npm run test:e2e
```

## Critical Test Cases for DXF Loading

### Primary Tests (Must Pass)
1. **DXF File Upload**: File input accepts .dxf files
2. **OpenCascade Initialization**: No WASM loading errors
3. **API Constructor Calls**: 
   - `wireBuilder.Add_1()` works (not `Add`)
   - `gp_Dir_1(0,0,1)` works (not `gp_Dir_4`)
   - `gp_Ax2_3()` works (not `gp_Ax2_1`)

### Secondary Tests (Should Pass)
1. **Entity Type Support**: LINE, POLYLINE, ARC, CIRCLE, SPLINE
2. **Error Handling**: Graceful failure for malformed DXF
3. **Console Output**: No constructor errors in browser console

## Browser Error Detection

### Console Error Patterns to Watch For
```javascript
// Fatal constructor errors (these MUST be fixed)
"gp_Dir_4 is not a constructor"
"wireBuilder.Add is not a function"
"gp_Ax2_1 is not a constructor"

// Binding errors (API misuse)
"BindingError: Expected null or instance of TopoDS_Vertex"
"is not a constructor"
"is not a function"

// WASM loading errors
"Failed to instantiate"
"WebAssembly"
"WASM"
```

## Manual Testing Checklist (Until E2E Automated)

When manually testing in browser:

1. **Navigate to**: `http://localhost:4173/modify`
2. **Open DevTools**: Console tab
3. **Upload each test file**:
   - `test/dxf/1.dxf` (LINE + ARC + CIRCLE entities)
   - `test/dxf/2.dxf` 
   - `test/dxf/3.dxf`
4. **Check console for**:
   - ❌ Any constructor errors
   - ❌ Any "not a function" errors
   - ❌ Any OpenCascade binding errors
   - ✅ Successful entity parsing messages

## Test Files Status

- ✅ `test/dxf/1.dxf` - 9 entities (6 LINE, 2 ARC, 1 CIRCLE)
- ✅ `test/dxf/2.dxf` - 7 entities 
- ✅ `test/dxf/3.dxf` - 13 entities

## Known Fixed Issues

### ✅ Resolved Browser Errors
- `wireBuilder.Add is not a function` → Fixed with `wireBuilder.Add_1()`
- `gp_Dir_4 is not a constructor` → Fixed with `gp_Dir_1(0,0,1)`
- `gp_Ax2_1 is not a constructor` → Fixed with `gp_Ax2_3()`

## Next Steps

1. **Complete Playwright Installation**: When network allows
2. **Run Full E2E Test Suite**: Automated browser testing
3. **Add Performance Tests**: Measure DXF loading times
4. **Add Visual Regression Tests**: Verify rendered geometry

## Verification Commands

```bash
# Quick verification (no browser needed)
npm test && npm run build

# Full verification (requires browsers)
npm run test:e2e

# Manual verification
npm run preview
# Then open http://localhost:4173/modify and test file upload
```