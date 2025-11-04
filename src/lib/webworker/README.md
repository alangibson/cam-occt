# WebWorker Base Classes

Type-safe WebWorker communication using JSON-RPC 2.0 protocol with automatic result caching and error handling.

## Features

- **Type Safety**: Full TypeScript type preservation across worker boundary
- **JSON-RPC 2.0**: Standards-compliant message protocol
- **Automatic Caching**: Last call result is cached automatically
- **Error Handling**: Comprehensive error handling with typed exceptions
- **Easy to Use**: Simple base classes for client and service implementation

## Quick Start

### 1. Define Service Interface

```typescript
// calculator.service.ts
export interface CalculatorService {
  add(a: number, b: number): Promise<number>;
  multiply(a: number, b: number): Promise<number>;
}
```

### 2. Implement Worker Service

```typescript
// calculator.worker.ts
import { WebWorkerService } from '$lib/webworker';
import type { CalculatorService } from './calculator.service';

class CalculatorServiceImpl
  extends WebWorkerService<CalculatorService>
  implements CalculatorService
{
  async add(a: number, b: number): Promise<number> {
    return a + b;
  }

  async multiply(a: number, b: number): Promise<number> {
    return a * b;
  }
}

// Initialize the service
new CalculatorServiceImpl();
```

### 3. Implement Client

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

### 4. Use the Client

```typescript
// In your application
const worker = new Worker('./calculator.worker.ts', { type: 'module' });
const calculator = new CalculatorClient(worker);

// Type-safe async calls
const sum = await calculator.add(2, 3);        // 5
const product = await calculator.multiply(4, 5); // 20

// Same call returns cached result (no worker communication)
const cachedSum = await calculator.add(2, 3);  // 5 (from cache)

// Cleanup
calculator.dispose();
```

## Architecture

### Message Flow

```
┌─────────────┐                    ┌──────────────┐
│             │                    │              │
│   Client    │  JSON-RPC Request  │   Worker     │
│  (Main      │ ──────────────────>│  (Service)   │
│   Thread)   │                    │              │
│             │  JSON-RPC Response │              │
│             │ <──────────────────│              │
│             │                    │              │
└─────────────┘                    └──────────────┘
```

### JSON-RPC 2.0 Format

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "add",
  "params": [2, 3],
  "id": 1
}
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "result": 5,
  "id": 1
}
```

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Internal error"
  },
  "id": 1
}
```

## API Reference

### WebWorkerClient<TService>

Base class for main thread clients.

#### Constructor

```typescript
constructor(worker: Worker)
```

#### Protected Methods

```typescript
// Call a method on the worker service
protected call<K extends keyof TService>(
  method: K,
  ...params: any[]
): Promise<any>

// Get number of pending requests
protected getPendingCount(): number

// Clear the result cache
protected clearCache(): void
```

#### Public Methods

```typescript
// Clean up resources and terminate worker
dispose(): void
```

### WebWorkerService<TService>

Base class for worker thread services.

#### Constructor

```typescript
constructor()
```

Automatically sets up message handling on instantiation.

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

### Manual Cache Control

```typescript
class MyClient extends WebWorkerClient<MyService> {
  async someMethod() {
    // Clear cache manually if needed
    this.clearCache();
    return this.call('someMethod');
  }
}
```

## Error Handling

### Error Types

All communication errors are thrown as `WebWorkerError`:

```typescript
import { WebWorkerError, JsonRpcErrorCode } from '$lib/webworker';

try {
  await client.someMethod();
} catch (error) {
  if (error instanceof WebWorkerError) {
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    console.error('Data:', error.data);
  }
}
```

### Error Codes

```typescript
enum JsonRpcErrorCode {
  ParseError = -32700,      // Invalid JSON
  InvalidRequest = -32600,  // Invalid JSON-RPC request
  MethodNotFound = -32601,  // Method doesn't exist
  InvalidParams = -32602,   // Invalid method parameters
  InternalError = -32603    // Internal service error
}
```

### Service Error Handling

Throw errors in your service methods - they're automatically caught and sent to the client:

```typescript
class MyServiceImpl extends WebWorkerService<MyService> {
  async divide(a: number, b: number): Promise<number> {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }
}
```

## Best Practices

### 1. Always Define Service Interface

```typescript
// ✅ Good - Shared interface for type safety
interface MathService {
  add(a: number, b: number): Promise<number>;
}

class MathClient extends WebWorkerClient<MathService> implements MathService { }
class MathServiceImpl extends WebWorkerService<MathService> implements MathService { }
```

### 2. Clean Up Resources

```typescript
// ✅ Good - Always dispose when done
const client = new MyClient(worker);
try {
  await client.doWork();
} finally {
  client.dispose();
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
  } else {
    // Handle other errors
  }
}
```

### 4. Use Descriptive Method Names

```typescript
// ✅ Good - Clear method names
interface GeometryService {
  calculateArea(width: number, height: number): Promise<number>;
  computeDistance(p1: Point, p2: Point): Promise<number>;
}

// ❌ Bad - Vague method names
interface Service {
  calc(a: number, b: number): Promise<number>;
  process(data: any): Promise<any>;
}
```

### 5. Validate Parameters in Service

```typescript
class GeometryServiceImpl extends WebWorkerService<GeometryService> {
  async calculateArea(width: number, height: number): Promise<number> {
    // ✅ Good - Validate inputs
    if (width <= 0 || height <= 0) {
      throw new Error('Width and height must be positive');
    }
    return width * height;
  }
}
```

## Examples

See the `examples/` directory for complete working examples:

- **calculator**: Basic math operations
- Complete with client, worker, and tests

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

## Vite Configuration

For Vite-based projects, workers should be imported correctly:

```typescript
// Use ?worker suffix for Vite
const worker = new Worker(
  new URL('./calculator.worker.ts', import.meta.url),
  { type: 'module' }
);
```

## License

Part of the MetalHead CAM project.
