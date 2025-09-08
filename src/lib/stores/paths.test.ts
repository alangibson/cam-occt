import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
    pathStore,
    selectPath,
    highlightPath,
    clearPathHighlight,
    type Path,
    type PathsState,
} from './paths';
import { workflowStore } from './workflow';
import { CutDirection, LeadType } from '../types/direction';
import type { Point2D, Shape } from '../types';

// Mock workflow store
vi.mock('./workflow');

const mockWorkflowStore = {
    completeStage: vi.fn(),
    invalidateDownstreamStages: vi.fn(),
};
vi.mocked(workflowStore).completeStage = mockWorkflowStore.completeStage;
vi.mocked(workflowStore).invalidateDownstreamStages =
    mockWorkflowStore.invalidateDownstreamStages;

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'mock-path-uuid-123');
Object.defineProperty(global, 'crypto', {
    value: { randomUUID: mockUUID },
});

describe('pathStore', () => {
    beforeEach(() => {
        // Reset the store
        pathStore.reset();

        // Clear all mocks
        vi.clearAllMocks();
        mockUUID.mockReturnValue('mock-path-uuid-123');
    });

    const createTestPath = (): Omit<Path, 'id'> => ({
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
        leadInType: LeadType.LINE,
        leadInLength: 5,
        leadInFlipSide: false,
        leadInAngle: 0,
        leadOutType: LeadType.LINE,
        leadOutLength: 5,
        leadOutFlipSide: false,
        leadOutAngle: 0,
        kerfCompensation: 'none',
    });

    describe('addPath', () => {
        it('should add new path with generated id', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            const state = get(pathStore);
            expect(state.paths).toHaveLength(1);
            expect(state.paths[0]).toEqual({
                ...path,
                id: 'mock-path-uuid-123',
            });
        });

        it('should complete program stage when paths exist', () => {
            vi.useFakeTimers();
            const path = createTestPath();

            pathStore.addPath(path);
            vi.runAllTimers();

            expect(mockWorkflowStore.completeStage).toHaveBeenCalledWith(
                'program'
            );
            vi.useRealTimers();
        });
    });

    describe('updatePath', () => {
        it('should update path properties', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            pathStore.updatePath('mock-path-uuid-123', {
                name: 'Updated Path',
            });

            const state = get(pathStore);
            expect(state.paths[0].name).toBe('Updated Path');
        });

        it('should not update non-existent path', () => {
            pathStore.updatePath('non-existent', { name: 'Updated' });

            const state = get(pathStore);
            expect(state.paths).toHaveLength(0);
        });
    });

    describe('deletePath', () => {
        it('should remove path by id', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            pathStore.deletePath('mock-path-uuid-123');

            const state = get(pathStore);
            expect(state.paths).toHaveLength(0);
        });

        it('should clear selected path if deleted', () => {
            const path = createTestPath();
            pathStore.addPath(path);
            pathStore.selectPath('mock-path-uuid-123');

            pathStore.deletePath('mock-path-uuid-123');

            const state = get(pathStore);
            expect(state.selectedPathId).toBeNull();
        });

        it('should clear highlighted path if deleted', () => {
            const path = createTestPath();
            pathStore.addPath(path);
            pathStore.highlightPath('mock-path-uuid-123');

            pathStore.deletePath('mock-path-uuid-123');

            const state = get(pathStore);
            expect(state.highlightedPathId).toBeNull();
        });

        it('should invalidate downstream stages when no paths remain', () => {
            vi.useFakeTimers();
            const path = createTestPath();
            pathStore.addPath(path);

            pathStore.deletePath('mock-path-uuid-123');
            vi.runAllTimers();

            expect(
                mockWorkflowStore.invalidateDownstreamStages
            ).toHaveBeenCalledWith('prepare');
            vi.useRealTimers();
        });
    });

    describe('deletePathsByOperation', () => {
        it('should delete all paths for operation', () => {
            const path1 = createTestPath();
            const path2 = { ...createTestPath(), operationId: 'op-2' };

            pathStore.addPath(path1);
            mockUUID.mockReturnValue('mock-path-uuid-456');
            pathStore.addPath(path2);

            pathStore.deletePathsByOperation('op-1');

            const state = get(pathStore);
            expect(state.paths).toHaveLength(1);
            expect(state.paths[0].operationId).toBe('op-2');
        });

        it('should clear selected path if it belongs to deleted operation', () => {
            const path = createTestPath();
            pathStore.addPath(path);
            pathStore.selectPath('mock-path-uuid-123');

            pathStore.deletePathsByOperation('op-1');

            const state = get(pathStore);
            expect(state.selectedPathId).toBeNull();
        });

        it('should clear highlighted path if it belongs to deleted operation', () => {
            const path = createTestPath();
            pathStore.addPath(path);
            pathStore.highlightPath('mock-path-uuid-123');

            pathStore.deletePathsByOperation('op-1');

            const state = get(pathStore);
            expect(state.highlightedPathId).toBeNull();
        });
    });

    describe('selectPath', () => {
        it('should set selected path id', () => {
            pathStore.selectPath('path-123');

            const state = get(pathStore);
            expect(state.selectedPathId).toBe('path-123');
        });

        it('should clear selection when null passed', () => {
            pathStore.selectPath('path-123');
            pathStore.selectPath(null);

            const state = get(pathStore);
            expect(state.selectedPathId).toBeNull();
        });
    });

    describe('highlightPath', () => {
        it('should set highlighted path id', () => {
            pathStore.highlightPath('path-123');

            const state = get(pathStore);
            expect(state.highlightedPathId).toBe('path-123');
        });

        it('should clear highlight when null passed', () => {
            pathStore.highlightPath('path-123');
            pathStore.highlightPath(null);

            const state = get(pathStore);
            expect(state.highlightedPathId).toBeNull();
        });
    });

    describe('clearHighlight', () => {
        it('should clear highlighted path', () => {
            pathStore.highlightPath('path-123');
            pathStore.clearHighlight();

            const state = get(pathStore);
            expect(state.highlightedPathId).toBeNull();
        });
    });

    describe('reorderPaths', () => {
        it('should set paths in new order', () => {
            const path1 = createTestPath();
            const path2 = { ...createTestPath(), name: 'Second Path' };

            pathStore.addPath(path1);
            mockUUID.mockReturnValue('mock-path-uuid-456');
            pathStore.addPath(path2);

            const state = get(pathStore);
            const reordered = [state.paths[1], state.paths[0]]; // Reverse order

            pathStore.reorderPaths(reordered);

            const newState = get(pathStore);
            expect(newState.paths[0].name).toBe('Second Path');
            expect(newState.paths[1].name).toBe('Test Path');
        });
    });

    describe('getPathsByChain', () => {
        it('should return paths for specific chain', () => {
            const path1 = createTestPath();
            const path2 = { ...createTestPath(), chainId: 'chain-2' };

            pathStore.addPath(path1);
            mockUUID.mockReturnValue('mock-path-uuid-456');
            pathStore.addPath(path2);

            const chainPaths = pathStore.getPathsByChain('chain-1');

            expect(chainPaths).toHaveLength(1);
            expect(chainPaths[0].chainId).toBe('chain-1');
        });

        it('should return empty array for non-existent chain', () => {
            const chainPaths = pathStore.getPathsByChain('non-existent');
            expect(chainPaths).toHaveLength(0);
        });
    });

    describe('getChainsWithPaths', () => {
        it('should return unique chain ids with paths', () => {
            const path1 = createTestPath();
            const path2 = { ...createTestPath(), chainId: 'chain-2' };
            const path3 = { ...createTestPath(), chainId: 'chain-1' }; // Duplicate chain

            pathStore.addPath(path1);
            mockUUID.mockReturnValue('mock-path-uuid-456');
            pathStore.addPath(path2);
            mockUUID.mockReturnValue('mock-path-uuid-789');
            pathStore.addPath(path3);

            const chainIds = pathStore.getChainsWithPaths();

            expect(chainIds).toHaveLength(2);
            expect(chainIds).toContain('chain-1');
            expect(chainIds).toContain('chain-2');
        });

        it('should return empty array when no paths exist', () => {
            const chainIds = pathStore.getChainsWithPaths();
            expect(chainIds).toHaveLength(0);
        });
    });

    describe('updatePathLeadGeometry', () => {
        it('should update lead-in geometry', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            const leadInPoints: Point2D[] = [
                { x: 0, y: 0 },
                { x: 5, y: 0 },
            ];
            pathStore.updatePathLeadGeometry('mock-path-uuid-123', {
                leadIn: { points: leadInPoints, type: LeadType.LINE },
            });

            const state = get(pathStore);
            expect(state.paths[0].calculatedLeadIn?.points).toEqual(
                leadInPoints
            );
            expect(state.paths[0].calculatedLeadIn?.type).toBe(LeadType.LINE);
            expect(state.paths[0].calculatedLeadIn?.generatedAt).toBeDefined();
            expect(state.paths[0].calculatedLeadIn?.version).toBe('1.0.0');
        });

        it('should update lead-out geometry', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            const leadOutPoints: Point2D[] = [
                { x: 10, y: 0 },
                { x: 15, y: 0 },
            ];
            pathStore.updatePathLeadGeometry('mock-path-uuid-123', {
                leadOut: { points: leadOutPoints, type: LeadType.ARC },
            });

            const state = get(pathStore);
            expect(state.paths[0].calculatedLeadOut?.points).toEqual(
                leadOutPoints
            );
            expect(state.paths[0].calculatedLeadOut?.type).toBe(LeadType.ARC);
        });

        it('should update validation results', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            const validation = {
                isValid: false,
                warnings: ['Lead too short'],
                errors: [],
                severity: 'warning' as const,
            };
            pathStore.updatePathLeadGeometry('mock-path-uuid-123', {
                validation,
            });

            const state = get(pathStore);
            expect(state.paths[0].leadValidation?.isValid).toBe(false);
            expect(state.paths[0].leadValidation?.warnings).toEqual([
                'Lead too short',
            ]);
            expect(state.paths[0].leadValidation?.severity).toBe('warning');
            expect(state.paths[0].leadValidation?.validatedAt).toBeDefined();
        });
    });

    describe('clearPathLeadGeometry', () => {
        it('should clear calculated lead geometry', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            // First add some lead geometry
            pathStore.updatePathLeadGeometry('mock-path-uuid-123', {
                leadIn: { points: [{ x: 0, y: 0 }], type: LeadType.LINE },
                validation: {
                    isValid: true,
                    warnings: [],
                    errors: [],
                    severity: 'info',
                },
            });

            // Then clear it
            pathStore.clearPathLeadGeometry('mock-path-uuid-123');

            const state = get(pathStore);
            expect(state.paths[0].calculatedLeadIn).toBeUndefined();
            expect(state.paths[0].calculatedLeadOut).toBeUndefined();
            expect(state.paths[0].leadValidation).toBeUndefined();
        });
    });

    describe('updatePathOffsetGeometry', () => {
        it('should update offset geometry', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            const originalShapes: Shape[] = [
                {
                    id: 'line-1',
                    type: 'line',
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                },
            ];
            const offsetShapes: Shape[] = [
                {
                    id: 'line-1-offset',
                    type: 'line',
                    geometry: { start: { x: 0, y: 1 }, end: { x: 10, y: 1 } },
                },
            ];

            pathStore.updatePathOffsetGeometry('mock-path-uuid-123', {
                offsetShapes,
                originalShapes,
                direction: 'outset',
                kerfWidth: 2,
            });

            const state = get(pathStore);
            expect(state.paths[0].calculatedOffset?.offsetShapes).toEqual(
                offsetShapes
            );
            expect(state.paths[0].calculatedOffset?.originalShapes).toEqual(
                originalShapes
            );
            expect(state.paths[0].calculatedOffset?.direction).toBe('outset');
            expect(state.paths[0].calculatedOffset?.kerfWidth).toBe(2);
            expect(state.paths[0].calculatedOffset?.generatedAt).toBeDefined();
            expect(state.paths[0].calculatedOffset?.version).toBe('1.0.0');
        });
    });

    describe('clearPathOffsetGeometry', () => {
        it('should clear calculated offset geometry', () => {
            const path = createTestPath();
            pathStore.addPath(path);

            // First add offset geometry
            pathStore.updatePathOffsetGeometry('mock-path-uuid-123', {
                offsetShapes: [],
                originalShapes: [],
                direction: 'outset',
                kerfWidth: 2,
            });

            // Then clear it
            pathStore.clearPathOffsetGeometry('mock-path-uuid-123');

            const state = get(pathStore);
            expect(state.paths[0].calculatedOffset).toBeUndefined();
        });
    });

    describe('reset', () => {
        it('should clear all paths and selection state', () => {
            vi.useFakeTimers();
            const path = createTestPath();
            pathStore.addPath(path);
            pathStore.selectPath('mock-path-uuid-123');
            pathStore.highlightPath('mock-path-uuid-123');

            pathStore.reset();
            vi.runAllTimers();

            const state = get(pathStore);
            expect(state.paths).toHaveLength(0);
            expect(state.selectedPathId).toBeNull();
            expect(state.highlightedPathId).toBeNull();
            expect(
                mockWorkflowStore.invalidateDownstreamStages
            ).toHaveBeenCalledWith('prepare');
            vi.useRealTimers();
        });
    });

    describe('restore', () => {
        it('should restore paths state and check workflow completion', () => {
            vi.useFakeTimers();
            const pathsState: PathsState = {
                paths: [
                    {
                        id: 'restored-path',
                        name: 'Restored Path',
                        operationId: 'op-1',
                        chainId: 'chain-1',
                        toolId: 'tool-1',
                        enabled: true,
                        order: 1,
                        cutDirection: CutDirection.CLOCKWISE,
                    },
                ],
                selectedPathId: 'restored-path',
                highlightedPathId: null,
            };

            pathStore.restore(pathsState);
            vi.runAllTimers();

            const state = get(pathStore);
            expect(state).toEqual(pathsState);
            expect(mockWorkflowStore.completeStage).toHaveBeenCalledWith(
                'program'
            );
            vi.useRealTimers();
        });
    });
});

describe('helper functions', () => {
    beforeEach(() => {
        pathStore.reset();
    });

    describe('selectPath', () => {
        it('should select path using helper function', () => {
            selectPath('helper-test-path');

            const state = get(pathStore);
            expect(state.selectedPathId).toBe('helper-test-path');
        });
    });

    describe('highlightPath', () => {
        it('should highlight path using helper function', () => {
            highlightPath('helper-highlight-path');

            const state = get(pathStore);
            expect(state.highlightedPathId).toBe('helper-highlight-path');
        });
    });

    describe('clearPathHighlight', () => {
        it('should clear highlight using helper function', () => {
            highlightPath('helper-highlight-path');
            clearPathHighlight();

            const state = get(pathStore);
            expect(state.highlightedPathId).toBeNull();
        });
    });
});
