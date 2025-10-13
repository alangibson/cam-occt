import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { cutStore } from './store';
import type { Cut, CutsState } from './interfaces';
import { workflowStore } from '$lib/stores/workflow/store';
import { WorkflowStage } from '$lib/stores/workflow/enums';
import { CutDirection, LeadType } from '$lib/types/direction';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import type { Shape } from '$lib/types';
import { GeometryType } from '$lib/geometry/shape';
import { NormalSide } from '$lib/types/cam';

// Mock workflow store
vi.mock('../workflow');

const mockWorkflowStore = {
    completeStage: vi.fn(),
    invalidateDownstreamStages: vi.fn(),
};
vi.mocked(workflowStore).completeStage = mockWorkflowStore.completeStage;
vi.mocked(workflowStore).invalidateDownstreamStages =
    mockWorkflowStore.invalidateDownstreamStages;

// Mock crypto.randomUUID
const mockUUID = vi.fn(() => 'mock-cut-uuid-123');
Object.defineProperty(global, 'crypto', {
    value: { randomUUID: mockUUID },
});

describe('cutStore', () => {
    beforeEach(() => {
        // Reset the store
        cutStore.reset();

        // Clear all mocks
        vi.clearAllMocks();
        mockUUID.mockReturnValue('mock-cut-uuid-123');
    });

    const createTestCut = (id?: string): Cut => ({
        id: id || '', // Empty string will be replaced by the store
        name: 'Test Cut',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
        leadInConfig: {
            type: LeadType.ARC,
            length: 5,
            flipSide: false,
            angle: 0,
            fit: true,
        },
        leadOutConfig: {
            type: LeadType.ARC,
            length: 5,
            flipSide: false,
            angle: 0,
            fit: true,
        },
        kerfCompensation: OffsetDirection.NONE,
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
    });

    describe('addCut', () => {
        it('should add new cut with generated id', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            const state = get(cutStore);
            expect(state.cuts).toHaveLength(1);
            expect(state.cuts[0]).toEqual({
                ...cut,
                id: 'mock-cut-uuid-123',
            });
        });

        it('should complete program stage when cuts exist', () => {
            vi.useFakeTimers();
            const cut = createTestCut();

            cutStore.addCut(cut);
            vi.runAllTimers();

            expect(mockWorkflowStore.completeStage).toHaveBeenCalledWith(
                WorkflowStage.PROGRAM
            );
            vi.useRealTimers();
        });
    });

    describe('updateCut', () => {
        it('should update cut properties', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            cutStore.updateCut('mock-cut-uuid-123', {
                name: 'Updated Cut',
            });

            const state = get(cutStore);
            expect(state.cuts[0].name).toBe('Updated Cut');
        });

        it('should not update non-existent cut', () => {
            cutStore.updateCut('non-existent', { name: 'Updated' });

            const state = get(cutStore);
            expect(state.cuts).toHaveLength(0);
        });
    });

    describe('deleteCut', () => {
        it('should remove cut by id', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            cutStore.deleteCut('mock-cut-uuid-123');

            const state = get(cutStore);
            expect(state.cuts).toHaveLength(0);
        });

        it('should clear selected cut if deleted', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);
            cutStore.selectCut('mock-cut-uuid-123');

            cutStore.deleteCut('mock-cut-uuid-123');

            const state = get(cutStore);
            expect(state.selectedCutId).toBeNull();
        });

        it('should clear highlighted cut if deleted', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);
            cutStore.highlightCut('mock-cut-uuid-123');

            cutStore.deleteCut('mock-cut-uuid-123');

            const state = get(cutStore);
            expect(state.highlightedCutId).toBeNull();
        });

        it('should invalidate downstream stages when no cuts remain', () => {
            vi.useFakeTimers();
            const cut = createTestCut();
            cutStore.addCut(cut);

            cutStore.deleteCut('mock-cut-uuid-123');
            vi.runAllTimers();

            expect(
                mockWorkflowStore.invalidateDownstreamStages
            ).toHaveBeenCalledWith(WorkflowStage.PREPARE);
            vi.useRealTimers();
        });
    });

    describe('deleteCutsByOperation', () => {
        it('should delete all cuts for operation', () => {
            const cut1 = createTestCut();
            const cut2 = { ...createTestCut(), operationId: 'op-2' };

            cutStore.addCut(cut1);
            mockUUID.mockReturnValue('mock-cut-uuid-456');
            cutStore.addCut(cut2);

            cutStore.deleteCutsByOperation('op-1');

            const state = get(cutStore);
            expect(state.cuts).toHaveLength(1);
            expect(state.cuts[0].operationId).toBe('op-2');
        });

        it('should clear selected cut if it belongs to deleted operation', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);
            cutStore.selectCut('mock-cut-uuid-123');

            cutStore.deleteCutsByOperation('op-1');

            const state = get(cutStore);
            expect(state.selectedCutId).toBeNull();
        });

        it('should clear highlighted cut if it belongs to deleted operation', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);
            cutStore.highlightCut('mock-cut-uuid-123');

            cutStore.deleteCutsByOperation('op-1');

            const state = get(cutStore);
            expect(state.highlightedCutId).toBeNull();
        });
    });

    describe('selectCut', () => {
        it('should set selected cut id', () => {
            cutStore.selectCut('cut-123');

            const state = get(cutStore);
            expect(state.selectedCutId).toBe('cut-123');
        });

        it('should clear selection when null passed', () => {
            cutStore.selectCut('cut-123');
            cutStore.selectCut(null);

            const state = get(cutStore);
            expect(state.selectedCutId).toBeNull();
        });
    });

    describe('highlightCut', () => {
        it('should set highlighted cut id', () => {
            cutStore.highlightCut('cut-123');

            const state = get(cutStore);
            expect(state.highlightedCutId).toBe('cut-123');
        });

        it('should clear highlight when null passed', () => {
            cutStore.highlightCut('cut-123');
            cutStore.highlightCut(null);

            const state = get(cutStore);
            expect(state.highlightedCutId).toBeNull();
        });
    });

    describe('clearHighlight', () => {
        it('should clear highlighted cut', () => {
            cutStore.highlightCut('cut-123');
            cutStore.clearHighlight();

            const state = get(cutStore);
            expect(state.highlightedCutId).toBeNull();
        });
    });

    describe('reorderCuts', () => {
        it('should set cuts in new order', () => {
            const cut1 = createTestCut();
            const cut2 = { ...createTestCut(), name: 'Second Cut' };

            cutStore.addCut(cut1);
            mockUUID.mockReturnValue('mock-cut-uuid-456');
            cutStore.addCut(cut2);

            const state = get(cutStore);
            const reordered = [state.cuts[1], state.cuts[0]]; // Reverse order

            cutStore.reorderCuts(reordered);

            const newState = get(cutStore);
            expect(newState.cuts[0].name).toBe('Second Cut');
            expect(newState.cuts[1].name).toBe('Test Cut');
        });
    });

    describe('getCutsByChain', () => {
        it('should return cuts for specific chain', () => {
            const cut1 = createTestCut();
            const cut2 = { ...createTestCut(), chainId: 'chain-2' };

            cutStore.addCut(cut1);
            mockUUID.mockReturnValue('mock-cut-uuid-456');
            cutStore.addCut(cut2);

            const chainCuts = cutStore.getCutsByChain('chain-1');

            expect(chainCuts).toHaveLength(1);
            expect(chainCuts[0].chainId).toBe('chain-1');
        });

        it('should return empty array for non-existent chain', () => {
            const chainCuts = cutStore.getCutsByChain('non-existent');
            expect(chainCuts).toHaveLength(0);
        });
    });

    describe('getChainsWithCuts', () => {
        it('should return unique chain ids with cuts', () => {
            const cut1 = createTestCut();
            const cut2 = { ...createTestCut(), chainId: 'chain-2' };
            const cut3 = { ...createTestCut(), chainId: 'chain-1' }; // Duplicate chain

            cutStore.addCut(cut1);
            mockUUID.mockReturnValue('mock-cut-uuid-456');
            cutStore.addCut(cut2);
            mockUUID.mockReturnValue('mock-cut-uuid-789');
            cutStore.addCut(cut3);

            const chainIds = cutStore.getChainsWithCuts();

            expect(chainIds).toHaveLength(2);
            expect(chainIds).toContain('chain-1');
            expect(chainIds).toContain('chain-2');
        });

        it('should return empty array when no cuts exist', () => {
            const chainIds = cutStore.getChainsWithCuts();
            expect(chainIds).toHaveLength(0);
        });
    });

    describe('updateCutLeadGeometry', () => {
        it('should update lead-in geometry', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            cutStore.updateCutLeadGeometry('mock-cut-uuid-123', {
                leadIn: {
                    geometry: {
                        center: { x: -2.5, y: 0 },
                        radius: 2.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
            });

            const state = get(cutStore);
            expect(state.cuts[0].leadIn?.geometry).toEqual({
                center: { x: -2.5, y: 0 },
                radius: 2.5,
                startAngle: 180,
                endAngle: 0,
                clockwise: false,
            });
            expect(state.cuts[0].leadIn?.type).toBe(LeadType.ARC);
            expect(state.cuts[0].leadIn?.generatedAt).toBeDefined();
            expect(state.cuts[0].leadIn?.version).toBe('1.0.0');
        });

        it('should update lead-out geometry', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            cutStore.updateCutLeadGeometry('mock-cut-uuid-123', {
                leadOut: {
                    geometry: {
                        center: { x: 12.5, y: 0 },
                        radius: 2.5,
                        startAngle: 180,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
            });

            const state = get(cutStore);
            expect(state.cuts[0].leadOut?.geometry).toEqual({
                center: { x: 12.5, y: 0 },
                radius: 2.5,
                startAngle: 180,
                endAngle: 0,
                clockwise: false,
            });
            expect(state.cuts[0].leadOut?.type).toBe(LeadType.ARC);
        });

        it('should update validation results', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            const validation = {
                isValid: false,
                warnings: ['Lead too short'],
                errors: [],
                severity: 'warning' as const,
            };
            cutStore.updateCutLeadGeometry('mock-cut-uuid-123', {
                validation,
            });

            const state = get(cutStore);
            expect(state.cuts[0].leadValidation?.isValid).toBe(false);
            expect(state.cuts[0].leadValidation?.warnings).toEqual([
                'Lead too short',
            ]);
            expect(state.cuts[0].leadValidation?.severity).toBe('warning');
            expect(state.cuts[0].leadValidation?.validatedAt).toBeDefined();
        });
    });

    describe('clearCutLeadGeometry', () => {
        it('should clear calculated lead geometry', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            // First add some lead geometry
            cutStore.updateCutLeadGeometry('mock-cut-uuid-123', {
                leadIn: {
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 2.5,
                        startAngle: 0,
                        endAngle: 90,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                validation: {
                    isValid: true,
                    warnings: [],
                    errors: [],
                    severity: 'info',
                },
            });

            // Then clear it
            cutStore.clearCutLeadGeometry('mock-cut-uuid-123');

            const state = get(cutStore);
            expect(state.cuts[0].leadIn).toBeUndefined();
            expect(state.cuts[0].leadOut).toBeUndefined();
            expect(state.cuts[0].leadValidation).toBeUndefined();
        });
    });

    describe('updateCutOffsetGeometry', () => {
        it('should update offset geometry', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            const originalShapes: Shape[] = [
                {
                    id: 'line-1',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
                },
            ];
            const offsetShapes: Shape[] = [
                {
                    id: 'line-1-offset',
                    type: GeometryType.LINE,
                    geometry: { start: { x: 0, y: 1 }, end: { x: 10, y: 1 } },
                },
            ];

            cutStore.updateCutOffsetGeometry('mock-cut-uuid-123', {
                offsetShapes,
                originalShapes,
                direction: OffsetDirection.OUTSET,
                kerfWidth: 2,
            });

            const state = get(cutStore);
            expect(state.cuts[0].offset?.offsetShapes).toEqual(offsetShapes);
            expect(state.cuts[0].offset?.originalShapes).toEqual(
                originalShapes
            );
            expect(state.cuts[0].offset?.direction).toBe(
                OffsetDirection.OUTSET
            );
            expect(state.cuts[0].offset?.kerfWidth).toBe(2);
            expect(state.cuts[0].offset?.generatedAt).toBeDefined();
            expect(state.cuts[0].offset?.version).toBe('1.0.0');
        });
    });

    describe('clearCutOffsetGeometry', () => {
        it('should clear calculated offset geometry', () => {
            const cut = createTestCut();
            cutStore.addCut(cut);

            // First add offset geometry
            cutStore.updateCutOffsetGeometry('mock-cut-uuid-123', {
                offsetShapes: [],
                originalShapes: [],
                direction: OffsetDirection.OUTSET,
                kerfWidth: 2,
            });

            // Then clear it
            cutStore.clearCutOffsetGeometry('mock-cut-uuid-123');

            const state = get(cutStore);
            expect(state.cuts[0].offset).toBeUndefined();
        });
    });

    describe('reset', () => {
        it('should clear all cuts and selection state', () => {
            vi.useFakeTimers();
            const cut = createTestCut();
            cutStore.addCut(cut);
            cutStore.selectCut('mock-cut-uuid-123');
            cutStore.highlightCut('mock-cut-uuid-123');

            cutStore.reset();
            vi.runAllTimers();

            const state = get(cutStore);
            expect(state.cuts).toHaveLength(0);
            expect(state.selectedCutId).toBeNull();
            expect(state.highlightedCutId).toBeNull();
            expect(
                mockWorkflowStore.invalidateDownstreamStages
            ).toHaveBeenCalledWith(WorkflowStage.PREPARE);
            vi.useRealTimers();
        });
    });

    describe('restore', () => {
        it('should restore cuts state and check workflow completion', () => {
            vi.useFakeTimers();
            const cutsState: CutsState = {
                cuts: [
                    {
                        id: 'restored-cut',
                        name: 'Restored Cut',
                        operationId: 'op-1',
                        chainId: 'chain-1',
                        toolId: 'tool-1',
                        enabled: true,
                        order: 1,
                        cutDirection: CutDirection.CLOCKWISE,
                        normal: { x: 1, y: 0 },
                        normalConnectionPoint: { x: 0, y: 0 },
                        normalSide: NormalSide.LEFT,
                    },
                ],
                selectedCutId: 'restored-cut',
                highlightedCutId: null,
                showCutNormals: false,
                showCutter: false,
                showCutDirections: false,
                showCutPaths: false,
                showCutStartPoints: false,
                showCutEndPoints: false,
            };

            cutStore.restore(cutsState);
            vi.runAllTimers();

            const state = get(cutStore);
            expect(state).toEqual(cutsState);
            expect(mockWorkflowStore.completeStage).toHaveBeenCalledWith(
                WorkflowStage.PROGRAM
            );
            vi.useRealTimers();
        });
    });
});

describe('helper functions', () => {
    beforeEach(() => {
        cutStore.reset();
    });

    describe('selectCut', () => {
        it('should select cut using store method', () => {
            cutStore.selectCut('helper-test-cut');

            const state = get(cutStore);
            expect(state.selectedCutId).toBe('helper-test-cut');
        });
    });

    describe('highlightCut', () => {
        it('should highlight cut using store method', () => {
            cutStore.highlightCut('helper-highlight-cut');

            const state = get(cutStore);
            expect(state.highlightedCutId).toBe('helper-highlight-cut');
        });
    });

    describe('clearCutHighlight', () => {
        it('should clear highlight using store method', () => {
            cutStore.highlightCut('helper-highlight-cut');
            cutStore.clearHighlight();

            const state = get(cutStore);
            expect(state.highlightedCutId).toBeNull();
        });
    });
});
