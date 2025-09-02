import { describe, it, expect, beforeEach, vi } from 'vitest';
import { migrateLegacyData, hasLegacyData } from './migration.js';

describe('migration utilities', () => {
  const mockLocalStorage = {
    data: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockLocalStorage.data[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      mockLocalStorage.data[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage.data[key];
    }),
    clear: vi.fn(() => {
      mockLocalStorage.data = {};
    })
  };

  beforeEach(() => {
    // Clear mock data and reset mocks
    mockLocalStorage.data = {};
    vi.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('hasLegacyData', () => {
    it('should return false when no legacy data exists', () => {
      const result = hasLegacyData();
      expect(result).toBe(false);
    });

    it('should return true when cam-occt-operations exists', () => {
      mockLocalStorage.data['cam-occt-operations'] = '[]';
      
      const result = hasLegacyData();
      expect(result).toBe(true);
    });

    it('should return true when cam-occt-paths exists', () => {
      mockLocalStorage.data['cam-occt-paths'] = '[]';
      
      const result = hasLegacyData();
      expect(result).toBe(true);
    });

    it('should return true when cam-occt-tools exists', () => {
      mockLocalStorage.data['cam-occt-tools'] = '[]';
      
      const result = hasLegacyData();
      expect(result).toBe(true);
    });

    it('should return true when column width data exists', () => {
      mockLocalStorage.data['cam-occt-prepare-left-column-width'] = '200';
      
      const result = hasLegacyData();
      expect(result).toBe(true);
    });

    it('should return true when any legacy key exists', () => {
      mockLocalStorage.data['cam-occt-prepare-right-column-width'] = '300';
      
      const result = hasLegacyData();
      expect(result).toBe(true);
    });

    it('should return false when only non-legacy keys exist', () => {
      mockLocalStorage.data['some-other-key'] = 'value';
      
      const result = hasLegacyData();
      expect(result).toBe(false);
    });
  });

  describe('migrateLegacyData', () => {
    it('should do nothing when no legacy data exists', () => {
      migrateLegacyData();
      
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith('No legacy data found, migration not needed');
    });

    it('should migrate and remove operations data', () => {
      const operationsData = '[{"id": "op1", "type": "cut"}]';
      mockLocalStorage.data['cam-occt-operations'] = operationsData;
      
      migrateLegacyData();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-operations');
      expect(console.log).toHaveBeenCalledWith('Found legacy data for cam-occt-operations');
      expect(console.log).toHaveBeenCalledWith('Cleared legacy key: cam-occt-operations');
    });

    it('should migrate and remove paths data', () => {
      const pathsData = '[{"id": "path1", "points": []}]';
      mockLocalStorage.data['cam-occt-paths'] = pathsData;
      
      migrateLegacyData();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-paths');
      expect(console.log).toHaveBeenCalledWith('Found legacy data for cam-occt-paths');
      expect(console.log).toHaveBeenCalledWith('Cleared legacy key: cam-occt-paths');
    });

    it('should migrate and remove tools data', () => {
      const toolsData = '[{"id": "tool1", "name": "Plasma"}]';
      mockLocalStorage.data['cam-occt-tools'] = toolsData;
      
      migrateLegacyData();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-tools');
      expect(console.log).toHaveBeenCalledWith('Found legacy data for cam-occt-tools');
      expect(console.log).toHaveBeenCalledWith('Cleared legacy key: cam-occt-tools');
    });

    it('should migrate column width data', () => {
      mockLocalStorage.data['cam-occt-prepare-left-column-width'] = '250';
      mockLocalStorage.data['cam-occt-prepare-right-column-width'] = '350';
      
      migrateLegacyData();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-prepare-left-column-width');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-prepare-right-column-width');
      expect(console.log).toHaveBeenCalledWith('Found legacy data for cam-occt-prepare-left-column-width');
      expect(console.log).toHaveBeenCalledWith('Found legacy data for cam-occt-prepare-right-column-width');
    });

    it('should handle all legacy keys at once', () => {
      mockLocalStorage.data['cam-occt-operations'] = '[]';
      mockLocalStorage.data['cam-occt-paths'] = '[]';
      mockLocalStorage.data['cam-occt-tools'] = '[]';
      mockLocalStorage.data['cam-occt-prepare-left-column-width'] = '200';
      mockLocalStorage.data['cam-occt-prepare-right-column-width'] = '300';
      
      migrateLegacyData();
      
      // All keys should be removed
      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(5);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-operations');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-paths');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-tools');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-prepare-left-column-width');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-prepare-right-column-width');
      
      expect(console.log).toHaveBeenCalledWith('Legacy data migration completed');
    });

    it('should handle invalid JSON data gracefully', () => {
      mockLocalStorage.data['cam-occt-operations'] = 'invalid-json{';
      
      migrateLegacyData();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-operations');
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to parse legacy data for cam-occt-operations:',
        expect.any(SyntaxError)
      );
    });

    it('should parse column width as integer', () => {
      mockLocalStorage.data['cam-occt-prepare-left-column-width'] = '250';
      
      migrateLegacyData();
      
      expect(console.log).toHaveBeenCalledWith('Found legacy data for cam-occt-prepare-left-column-width');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-prepare-left-column-width');
    });

    it('should handle invalid column width data', () => {
      mockLocalStorage.data['cam-occt-prepare-left-column-width'] = 'not-a-number';
      
      migrateLegacyData();
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('cam-occt-prepare-left-column-width');
      expect(console.log).toHaveBeenCalledWith('Found legacy data for cam-occt-prepare-left-column-width');
    });
  });
});