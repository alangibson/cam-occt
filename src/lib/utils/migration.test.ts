import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hasLegacyData, migrateLegacyData } from './migration.js';

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
        }),
    };

    beforeEach(() => {
        // Clear mock data and reset mocks
        mockLocalStorage.data = {};
        vi.clearAllMocks();

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: mockLocalStorage,
            writable: true,
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

        it('should return true when metalheadcam-operations exists', () => {
            mockLocalStorage.data['metalheadcam-operations'] = '[]';

            const result = hasLegacyData();
            expect(result).toBe(true);
        });

        it('should return true when metalheadcam-paths exists', () => {
            mockLocalStorage.data['metalheadcam-paths'] = '[]';

            const result = hasLegacyData();
            expect(result).toBe(true);
        });

        it('should return true when metalheadcam-tools exists', () => {
            mockLocalStorage.data['metalheadcam-tools'] = '[]';

            const result = hasLegacyData();
            expect(result).toBe(true);
        });

        it('should return true when column width data exists', () => {
            mockLocalStorage.data['metalheadcam-prepare-left-column-width'] =
                '200';

            const result = hasLegacyData();
            expect(result).toBe(true);
        });

        it('should return true when any legacy key exists', () => {
            mockLocalStorage.data['metalheadcam-prepare-right-column-width'] =
                '300';

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
        });

        it('should migrate and remove operations data', () => {
            const operationsData = '[{"id": "op1", "type": "cut"}]';
            mockLocalStorage.data['metalheadcam-operations'] = operationsData;

            migrateLegacyData();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-operations'
            );
        });

        it('should migrate and remove paths data', () => {
            const pathsData = '[{"id": "path1", "points": []}]';
            mockLocalStorage.data['metalheadcam-paths'] = pathsData;

            migrateLegacyData();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-paths'
            );
        });

        it('should migrate and remove tools data', () => {
            const toolsData = '[{"id": "tool1", "name": "Plasma"}]';
            mockLocalStorage.data['metalheadcam-tools'] = toolsData;

            migrateLegacyData();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-tools'
            );
        });

        it('should migrate column width data', () => {
            mockLocalStorage.data['metalheadcam-prepare-left-column-width'] =
                '250';
            mockLocalStorage.data['metalheadcam-prepare-right-column-width'] =
                '350';

            migrateLegacyData();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-prepare-left-column-width'
            );
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-prepare-right-column-width'
            );
        });

        it('should handle all legacy keys at once', () => {
            mockLocalStorage.data['metalheadcam-operations'] = '[]';
            mockLocalStorage.data['metalheadcam-paths'] = '[]';
            mockLocalStorage.data['metalheadcam-tools'] = '[]';
            mockLocalStorage.data['metalheadcam-prepare-left-column-width'] =
                '200';
            mockLocalStorage.data['metalheadcam-prepare-right-column-width'] =
                '300';

            migrateLegacyData();

            // All keys should be removed
            expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(5);
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-operations'
            );
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-paths'
            );
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-tools'
            );
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-prepare-left-column-width'
            );
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-prepare-right-column-width'
            );

            // Verify all keys were removed
            expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(5);
        });

        it('should handle invalid JSON data gracefully', () => {
            mockLocalStorage.data['metalheadcam-operations'] = 'invalid-json{';

            migrateLegacyData();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-operations'
            );
            // Invalid JSON should still remove the key
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-operations'
            );
        });

        it('should parse column width as integer', () => {
            mockLocalStorage.data['metalheadcam-prepare-left-column-width'] =
                '250';

            migrateLegacyData();

            expect(console.log).toHaveBeenCalledWith(
                'Found legacy data for metalheadcam-prepare-left-column-width'
            );
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-prepare-left-column-width'
            );
        });

        it('should handle invalid column width data', () => {
            mockLocalStorage.data['metalheadcam-prepare-left-column-width'] =
                'not-a-number';

            migrateLegacyData();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
                'metalheadcam-prepare-left-column-width'
            );
        });
    });
});
