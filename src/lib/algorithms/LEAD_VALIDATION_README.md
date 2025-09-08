# Lead Validation Pipeline

The Lead Validation Pipeline provides comprehensive validation for lead configurations before calculation, enabling better error handling and user feedback.

## Overview

The validation system separates validation concerns from calculation logic, providing:

- **Early error detection** - Catch invalid configurations before expensive calculations
- **Actionable feedback** - Provide specific warnings and suggestions to users
- **Layered validation** - Multiple validation levels from basic config to complex geometry
- **Severity levels** - Categorize issues as info, warning, or error

## Architecture

### Core Components

1. **`validateLeadConfiguration()`** - Main validation entry point
2. **`LeadValidationResult`** - Structured validation results with warnings/suggestions
3. **Integrated calculation** - Validation runs automatically in `calculateLeads()`

### Validation Layers

The pipeline performs validation in 5 layers:

1. **Basic Configuration** - Negative lengths, invalid angles, type/length mismatches
2. **Chain Geometry** - Empty chains, size vs lead length ratios
3. **Part Context** - Hole/shell relationships, collision detection
4. **Lead Length** - Practical machining limits, very short/long leads
5. **Cut Direction** - Compatibility with open/closed chains, manual angle conflicts

## Usage

### Automatic Integration

Validation runs automatically when calling `calculateLeads()`:

```typescript
const result = calculateLeads(
  chain,
  leadInConfig,
  leadOutConfig,
  cutDirection,
  part
);

// Access validation results
console.log(result.validation?.isValid); // boolean
console.log(result.validation?.severity); // 'info' | 'warning' | 'error'
console.log(result.validation?.warnings); // string[]
console.log(result.validation?.suggestions); // string[] | undefined
```

### Standalone Validation

You can also run validation separately:

```typescript
import { validateLeadConfiguration } from './lead-validation';

const validation = validateLeadConfiguration(
  { leadIn, leadOut, cutDirection },
  chain,
  part
);

if (!validation.isValid) {
  // Handle validation errors
  console.error('Lead configuration invalid:', validation.warnings);
  return;
}
```

## Validation Rules

### Basic Configuration

- ❌ **Error**: Negative lead lengths
- ❌ **Error**: Invalid angles (< 0 or >= 360)
- ⚠️ **Warning**: Type "none" with length > 0

### Chain Geometry

- ❌ **Error**: Empty chains
- ⚠️ **Warning**: Lead length > 2x chain size
- ⚠️ **Warning**: Long leads on very small geometry

### Part Context

- ⚠️ **Warning**: Chain not belonging to specified part
- ⚠️ **Warning**: Potential hole collisions
- ℹ️ **Info**: Hole lead placement notification

### Lead Length

- ⚠️ **Warning**: Very long leads (> 50 units)
- ℹ️ **Info**: Very short leads (< 0.5 units)

### Cut Direction

- ℹ️ **Info**: Missing cut direction on closed chains
- ℹ️ **Info**: Unnecessary cut direction on open chains
- ℹ️ **Info**: Manual angles overriding automatic tangency

## Severity Levels

### Error (`severity: 'error'`)

- **Behavior**: Calculation is prevented
- **Use case**: Invalid configurations that would crash or produce meaningless results
- **Examples**: Negative lengths, empty chains

### Warning (`severity: 'warning'`)

- **Behavior**: Calculation proceeds with warnings
- **Use case**: Potentially problematic but workable configurations
- **Examples**: Very long leads, type/length mismatches

### Info (`severity: 'info'`)

- **Behavior**: Calculation proceeds normally
- **Use case**: Educational or optimization suggestions
- **Examples**: Missing cut direction, very short leads

## Testing

The validation pipeline includes comprehensive tests:

- **`lead-validation.test.ts`** - Core validation logic tests
- **`lead-calculation-validation.test.ts`** - Integration tests with calculation

Run tests:

```bash
npm run test -- lead-validation.test.ts
npm run test -- lead-calculation-validation.test.ts
```

## API Reference

### Types

```typescript
interface LeadValidationResult {
  isValid: boolean; // Overall validation status
  warnings: string[]; // Human-readable warning messages
  suggestions?: string[]; // Actionable suggestions for fixes
  severity: 'info' | 'warning' | 'error'; // Highest severity level
}

interface LeadConfig {
  leadIn: LeadInConfig;
  leadOut: LeadOutConfig;
  cutDirection: CutDirection;
}
```

### Functions

```typescript
// Main validation function
function validateLeadConfiguration(
  config: LeadConfig,
  chain: ShapeChain,
  part?: DetectedPart
): LeadValidationResult;

// Updated calculation function with validation
function calculateLeads(
  chain: ShapeChain,
  leadInConfig: LeadInConfig,
  leadOutConfig: LeadOutConfig,
  cutDirection: CutDirection = CutDirection.NONE,
  part?: DetectedPart
): LeadResult; // Now includes validation?: LeadValidationResult
```

## Benefits

1. **Better UX** - Users get clear feedback about lead configuration issues
2. **Reduced Errors** - Early detection prevents calculation failures
3. **Actionable Guidance** - Suggestions help users fix problems
4. **Performance** - Fast validation prevents expensive failed calculations
5. **Maintainability** - Separated validation logic is easier to extend

## Future Enhancements

- **Collision detection** - More sophisticated geometry intersection analysis
- **Material constraints** - Validation based on material properties
- **Machine limits** - Validation against specific CNC machine capabilities
- **Interactive suggestions** - UI integration with auto-fix options
