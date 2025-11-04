# WebWorker Base Classes

Type-safe WebWorker communication using Comlink with minimal boilerplate, automatic result caching, and error handling.

## Features

- **Type Safety**: Full TypeScript type preservation across worker boundary using Comlink
- **Minimal Boilerplate**: Use Comlink's automatic wrapping to avoid manual method implementations
- **Automatic Caching**: Optional last-call result caching
- **Error Handling**: Comprehensive error handling with typed exceptions
- **Vite Integration**: Works seamlessly with vite-plugin-comlink
- **Two Approaches**: Choose between direct Comlink wrapping (simplest) or base classes (with caching)

## Installation

```bash
npm install comlink vite-plugin-comlink
```

Configure Vite (vite.config.js):

```javascript
import { comlink } from 'vite-plugin-comlink';

export default {
  plugins: [comlink()],
  worker: {
    plugins: () => [comlink()]
  }
};
```

## Quick Start

### Approach 1: Direct Comlink Wrapping (Simplest - Recommended)

No base classes needed. Just expose your service and use Comlink directly.

#### 1. Define Service Interface

```typescript
// calculator.service.ts
export interface CalculatorService {
  add(a: number, b: number): Promise<number>;
  multiply(a: number, b: number): Promise<number>;
}
```

#### 2. Implement Worker Service

```typescript
// calculator.worker.ts
import * as Comlink from 'comlink';
import type { CalculatorService } from './calculator.service';

class CalculatorServiceImpl implements CalculatorService {
  async add(a: number, b: number): Promise<number> {
    return a + b;
  }

  async multiply(a: number, b: number): Promise<number> {
    return a * b;
  }
}

// Expose the service
Comlink.expose(new CalculatorServiceImpl());
```

#### 3. Use in Main Thread

**With vite-plugin-comlink:**

```typescript
import type { CalculatorService } from './calculator.service';
import ComlinkWorker from './calculator.worker?worker&comlink';

// Create wrapped worker instance
const calculator = await new ComlinkWorker<CalculatorService>();

// Type-safe async calls
const sum = await calculator.add(2, 3);        // 5
const product = await calculator.multiply(4, 5); // 20

// Cleanup
calculator[Comlink.releaseProxy]();
```

**Without vite-plugin-comlink:**

```typescript
import * as Comlink from 'comlink';
import type { CalculatorService } from './calculator.service';

const worker = new Worker(
  new URL('./calculator.worker.ts', import.meta.url),
  { type: 'module' }
);

const calculator = Comlink.wrap<CalculatorService>(worker);

const sum = await calculator.add(2, 3);

// Cleanup
calculator[Comlink.releaseProxy]();
worker.terminate();
```

### Approach 2: Base Classes (With Caching & Lifecycle Management)

Use when you need automatic result caching or custom lifecycle management.

#### 1. Define Service Interface

```typescript
// calculator.service.ts
export interface CalculatorService {
  add(a: number, b: number): Promise<number>;
  multiply(a: number, b: number): Promise<number>;
}
```

#### 2. Implement Worker Service

```typescript
// calculator.worker.ts
import { WebWorkerService } from '$lib/webworker';
import type { CalculatorService } from './calculator.service';

class CalculatorServiceImpl extends WebWorkerService implements CalculatorService {
  async add(a: number, b: number): Promise<number> {
    this.log('add', a, b);  // Optional logging
    return a + b;
  }

  async multiply(a: number, b: number): Promise<number> {
    return a * b;
  }
}

// Expose using WebWorkerService
WebWorkerService.expose(new CalculatorServiceImpl());
```

#### 3. Implement Client

```typescript
// calculator.client.ts
import { WebWorkerClient } from '$lib/webworker';
import type { CalculatorService } from './calculator.service';

export class CalculatorClient
  extends WebWorkerClient<CalculatorService>
  implements CalculatorService
{
  async add(a: number, b: number): Promise<number> {
    return this.call('add', a, b);
  }

  async multiply(a: number, b: number): Promise<number> {
    return this.call('multiply', a, b);
  }
}
```

#### 4. Use the Client

```typescript
const worker = new Worker(
  new URL('./calculator.worker.ts', import.meta.url),
  { type: 'module' }
);

const calculator = new CalculatorClient(worker);

const result1 = await calculator.add(2, 3);  // Calls worker
const result2 = await calculator.add(2, 3);  // Returns cached result

calculator.dispose();  // Clean up
```

## API Reference

### WebWorkerClient<TService>

Base class for main thread clients with caching support.

#### Constructor

```typescript
constructor(worker: Worker, options?: WebWorkerClientOptions)
```

**Options:**
- `enableCache?: boolean` - Enable/disable caching (default: true)
- `onError?: (error: Error) => void` - Custom error handler

#### Protected Methods

```typescript
// Call a method on the worker service
protected call<K extends keyof TService>(
  method: K,
  ...params: any[]
): Promise<any>

// Clear the result cache
protected clearCache(): void
```

#### Public Methods

```typescript
// Clean up resources and terminate worker
dispose(): void
```

### WebWorkerService

Base class for worker thread services.

#### Static Methods

```typescript
// Expose a service instance using Comlink
static expose<T extends object>(instance: T): void
```

#### Protected Methods

```typescript
// Log messages from worker (debugging)
protected log(...args: any[]): void

// Log errors from worker (debugging)
protected logError(...args: any[]): void
```

## Caching Behavior

The `WebWorkerClient` automatically caches the result of the last method call:

```typescript
const result1 = await client.add(2, 3);  // Sends request to worker
const result2 = await client.add(2, 3);  // Returns cached result (no worker call)
const result3 = await client.add(4, 5);  // Different params - sends new request
const result4 = await client.add(2, 3);  // New request (cache was cleared by result3)
```

### Disable Caching

```typescript
const client = new CalculatorClient(worker, { enableCache: false });
```

### Manual Cache Control

```typescript
class MyClient extends WebWorkerClient<MyService> {
  async someMethod() {
    this.clearCache();  // Clear cache manually
    return this.call('someMethod');
  }
}
```

## Error Handling

All communication errors are thrown as `WebWorkerError`:

```typescript
import { WebWorkerError } from '$lib/webworker';

try {
  await client.someMethod();
} catch (error) {
  if (error instanceof WebWorkerError) {
    console.error('Worker error:', error.message);
    console.error('Additional data:', error.data);
  }
}
```

### Service Error Handling

Throw errors in your service methods - they're automatically propagated to the client:

```typescript
class MyServiceImpl extends WebWorkerService implements MyService {
  async divide(a: number, b: number): Promise<number> {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}
```

## Comparison: Direct Comlink vs Base Classes

### Direct Comlink (Approach 1)

**Pros:**
- Minimal boilerplate
- No client class needed
- Works with vite-plugin-comlink
- Simplest approach

**Cons:**
- No automatic caching
- Manual cleanup required
- Less structure for large projects

**When to use:**
- Simple worker services
- No need for caching
- Minimal code preferred

### Base Classes (Approach 2)

**Pros:**
- Automatic result caching
- Structured lifecycle management
- Consistent patterns for large projects
- Built-in logging helpers

**Cons:**
- More boilerplate (client class)
- Slightly more complex setup

**When to use:**
- Need result caching
- Large projects with many workers
- Want consistent patterns
- Need lifecycle hooks

## Best Practices

### 1. Define Service Interfaces

```typescript
// ✅ Good - Shared interface for type safety
interface MathService {
  add(a: number, b: number): Promise<number>;
}
```

### 2. Clean Up Resources

```typescript
// ✅ Good - Always dispose/cleanup when done
try {
  await client.doWork();
} finally {
  client.dispose();  // or client[Comlink.releaseProxy]()
}
```

### 3. Handle Errors Appropriately

```typescript
// ✅ Good - Catch and handle errors
try {
  const result = await client.riskyOperation();
} catch (error) {
  if (error instanceof WebWorkerError) {
    // Handle worker communication error
  }
}
```

### 4. Use Descriptive Method Names

```typescript
// ✅ Good
interface GeometryService {
  calculateArea(width: number, height: number): Promise<number>;
}

// ❌ Bad
interface Service {
  calc(a: number, b: number): Promise<number>;
}
```

## Examples

See the `examples/` directory for complete working examples:

- **calculator**: Basic math operations with both approaches

## Testing

Run the test suite:

```bash
npm run test
```

Run specific test file:

```bash
npm run test -- WebWorkerClient.test.ts
```

## TypeScript Configuration

Ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

## License

Part of the MetalHead CAM project.
