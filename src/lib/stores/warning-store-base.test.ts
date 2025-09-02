import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { 
  createWarningStore, 
  clearWarnings, 
  getWarningsByOperationId, 
  getWarningsByChainId,
  type Warning, 
  type WarningStore 
} from './warning-store-base';

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'mock-warning-uuid-123');
Object.defineProperty(global, 'crypto', {
  value: { randomUUID: mockUUID }
});

// Test warning interface extending the base Warning
interface TestWarning extends Warning {
  severity: 'info' | 'warning' | 'error';
  details?: string;
}

describe('createWarningStore', () => {
  let warningStore: WarningStore<TestWarning>;

  beforeEach(() => {
    warningStore = createWarningStore<TestWarning>();
    vi.clearAllMocks();
    mockUUID.mockReturnValue('mock-warning-uuid-123');
  });

  const createTestWarning = (): Omit<TestWarning, 'id'> => ({
    operationId: 'op-1',
    chainId: 'chain-1',
    message: 'Test warning message',
    type: 'test-warning',
    severity: 'warning'
  });

  describe('addWarning', () => {
    it('should add warning with generated id', () => {
      const warning = createTestWarning();
      warningStore.addWarning(warning);

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(1);
      expect(state.warnings[0]).toEqual({
        ...warning,
        id: 'mock-warning-uuid-123'
      });
    });

    it('should add multiple warnings', () => {
      const warning1 = createTestWarning();
      const warning2 = { ...createTestWarning(), message: 'Second warning' };

      warningStore.addWarning(warning1);
      mockUUID.mockReturnValue('mock-warning-uuid-456');
      warningStore.addWarning(warning2);

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(2);
      expect(state.warnings[0].message).toBe('Test warning message');
      expect(state.warnings[1].message).toBe('Second warning');
    });

    it('should preserve warning properties', () => {
      const warning: Omit<TestWarning, 'id'> = {
        operationId: 'op-2',
        chainId: 'chain-2',
        message: 'Critical error',
        type: 'critical',
        severity: 'error',
        details: 'Additional error details'
      };

      warningStore.addWarning(warning);

      const state = get(warningStore);
      expect(state.warnings[0]).toEqual({
        ...warning,
        id: 'mock-warning-uuid-123'
      });
    });
  });

  describe('clearWarningsForOperation', () => {
    beforeEach(() => {
      const warning1 = createTestWarning();
      const warning2 = { ...createTestWarning(), operationId: 'op-2' };
      const warning3 = { ...createTestWarning(), operationId: 'op-1', message: 'Another op-1 warning' };

      warningStore.addWarning(warning1);
      mockUUID.mockReturnValue('mock-warning-uuid-456');
      warningStore.addWarning(warning2);
      mockUUID.mockReturnValue('mock-warning-uuid-789');
      warningStore.addWarning(warning3);
    });

    it('should clear all warnings for specific operation', () => {
      warningStore.clearWarningsForOperation('op-1');

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(1);
      expect(state.warnings[0].operationId).toBe('op-2');
    });

    it('should not affect warnings for other operations', () => {
      warningStore.clearWarningsForOperation('op-2');

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(2);
      expect(state.warnings.every(w => w.operationId === 'op-1')).toBe(true);
    });

    it('should handle non-existent operation', () => {
      warningStore.clearWarningsForOperation('non-existent');

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(3); // No warnings should be removed
    });
  });

  describe('clearWarningsForChain', () => {
    beforeEach(() => {
      const warning1 = createTestWarning();
      const warning2 = { ...createTestWarning(), chainId: 'chain-2' };
      const warning3 = { ...createTestWarning(), chainId: 'chain-1', message: 'Another chain-1 warning' };

      warningStore.addWarning(warning1);
      mockUUID.mockReturnValue('mock-warning-uuid-456');
      warningStore.addWarning(warning2);
      mockUUID.mockReturnValue('mock-warning-uuid-789');
      warningStore.addWarning(warning3);
    });

    it('should clear all warnings for specific chain', () => {
      warningStore.clearWarningsForChain('chain-1');

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(1);
      expect(state.warnings[0].chainId).toBe('chain-2');
    });

    it('should not affect warnings for other chains', () => {
      warningStore.clearWarningsForChain('chain-2');

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(2);
      expect(state.warnings.every(w => w.chainId === 'chain-1')).toBe(true);
    });

    it('should handle non-existent chain', () => {
      warningStore.clearWarningsForChain('non-existent');

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(3); // No warnings should be removed
    });
  });

  describe('clearAllWarnings', () => {
    beforeEach(() => {
      const warning1 = createTestWarning();
      const warning2 = { ...createTestWarning(), operationId: 'op-2' };

      warningStore.addWarning(warning1);
      warningStore.addWarning(warning2);
    });

    it('should clear all warnings', () => {
      warningStore.clearAllWarnings();

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(0);
    });

    it('should reset to initial state', () => {
      warningStore.clearAllWarnings();

      const state = get(warningStore);
      expect(state).toEqual({ warnings: [] });
    });
  });

  describe('getWarningsForOperation', () => {
    beforeEach(() => {
      const warning1 = createTestWarning();
      const warning2 = { ...createTestWarning(), operationId: 'op-2' };
      const warning3 = { ...createTestWarning(), operationId: 'op-1', message: 'Another op-1 warning' };

      warningStore.addWarning(warning1);
      mockUUID.mockReturnValue('mock-warning-uuid-456');
      warningStore.addWarning(warning2);
      mockUUID.mockReturnValue('mock-warning-uuid-789');
      warningStore.addWarning(warning3);
    });

    it('should return warnings for specific operation', () => {
      const warnings = warningStore.getWarningsForOperation('op-1');

      expect(warnings).toHaveLength(2);
      expect(warnings.every(w => w.operationId === 'op-1')).toBe(true);
    });

    it('should return empty array for operation with no warnings', () => {
      const warnings = warningStore.getWarningsForOperation('non-existent');

      expect(warnings).toHaveLength(0);
    });

    it('should return all warnings for operation', () => {
      const warnings = warningStore.getWarningsForOperation('op-1');

      expect(warnings[0].message).toBe('Test warning message');
      expect(warnings[1].message).toBe('Another op-1 warning');
    });
  });

  describe('initial state', () => {
    it('should start with empty warnings array', () => {
      const freshStore = createWarningStore<TestWarning>();
      const state = get(freshStore);

      expect(state.warnings).toHaveLength(0);
      expect(state.warnings).toEqual([]);
    });
  });
});

describe('helper functions', () => {
  let warningStore: WarningStore<TestWarning>;

  beforeEach(() => {
    warningStore = createWarningStore<TestWarning>();
    vi.clearAllMocks();
    mockUUID.mockReturnValue('mock-warning-uuid-123');
  });

  const createTestWarning = (): Omit<TestWarning, 'id'> => ({
    operationId: 'op-1',
    chainId: 'chain-1',
    message: 'Test warning message',
    type: 'test-warning',
    severity: 'warning'
  });

  describe('clearWarnings', () => {
    it('should clear all warnings using helper function', () => {
      const warning = createTestWarning();
      warningStore.addWarning(warning);

      clearWarnings(warningStore);

      const state = get(warningStore);
      expect(state.warnings).toHaveLength(0);
    });
  });

  describe('getWarningsByOperationId', () => {
    beforeEach(() => {
      const warning1 = createTestWarning();
      const warning2 = { ...createTestWarning(), operationId: 'op-2' };

      warningStore.addWarning(warning1);
      mockUUID.mockReturnValue('mock-warning-uuid-456');
      warningStore.addWarning(warning2);
    });

    it('should get warnings by operation id using helper function', () => {
      const warnings = getWarningsByOperationId(warningStore, 'op-1');

      expect(warnings).toHaveLength(1);
      expect(warnings[0].operationId).toBe('op-1');
    });

    it('should return empty array for non-existent operation', () => {
      const warnings = getWarningsByOperationId(warningStore, 'non-existent');

      expect(warnings).toHaveLength(0);
    });
  });

  describe('getWarningsByChainId', () => {
    beforeEach(() => {
      const warning1 = createTestWarning();
      const warning2 = { ...createTestWarning(), chainId: 'chain-2' };

      warningStore.addWarning(warning1);
      mockUUID.mockReturnValue('mock-warning-uuid-456');
      warningStore.addWarning(warning2);
    });

    it('should get warnings by chain id using helper function', () => {
      const warnings = getWarningsByChainId(warningStore, 'chain-1');

      expect(warnings).toHaveLength(1);
      expect(warnings[0].chainId).toBe('chain-1');
    });

    it('should return empty array for non-existent chain', () => {
      const warnings = getWarningsByChainId(warningStore, 'non-existent');

      expect(warnings).toHaveLength(0);
    });
  });
});