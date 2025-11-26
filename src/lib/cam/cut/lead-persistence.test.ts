import { Shape } from '$lib/cam/shape/classes';
import { Chain } from '$lib/cam/chain/classes';
/**
 * Tests for lead persistence utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    calculateLeadPoints,
    getCachedLeadGeometry,
    hasValidCachedLeads,
} from './lead-persistence';
import type { CutData } from '$lib/cam/cut/interfaces';
import { Cut } from './classes.svelte';
import { calculateCutLeads } from '$lib/cam/pipeline/leads/lead-orchestration';
import type { ChainData } from '$lib/cam/chain/interfaces';
import { CutDirection, NormalSide } from './enums';
import { LeadType } from '$lib/cam/lead/enums';
import { KerfCompensation, OperationAction } from '$lib/cam/operation/enums';
import { GeometryType } from '$lib/geometry/enums';
import { OffsetDirection } from '$lib/cam/offset/types';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import type { OperationData } from '$lib/cam/operation/interface';
import type { LeadResult } from '$lib/cam/lead/interfaces';

// Mock the stores
vi.mock('$lib/stores/cuts/store', () => ({
    cutStore: {
        updateCutLeadGeometry: vi.fn(),
        subscribe: vi.fn(() => vi.fn()),
    },
}));

vi.mock('$lib/stores/chains/store', () => ({
    chainStore: {
        subscribe: vi.fn(() => vi.fn()),
    },
}));

vi.mock('$lib/stores/parts/store', () => ({
    partStore: {
        subscribe: vi.fn(() => vi.fn()),
    },
}));

// Mock the lead calculation algorithm
vi.mock('$lib/cam/lead/lead-calculation', () => ({
    calculateLeads: vi.fn(() => ({
        leadIn: {
            geometry: {
                center: { x: 2.5, y: 2.5 },
                radius: 3.54,
                startAngle: Math.PI / 4,
                endAngle: (5 * Math.PI) / 4,
                clockwise: false,
            },
            type: LeadType.ARC,
        },
        leadOut: {
            geometry: {
                center: { x: 12.5, y: 12.5 },
                radius: 3.536,
                startAngle: 225,
                endAngle: 45,
                clockwise: false,
            },
            type: LeadType.ARC,
        },
        warnings: ['Test warning'],
    })),
}));

// Mock svelte/store get function with partial mock to preserve writable
vi.mock('svelte/store', async (importOriginal) => {
    const actual: object = await importOriginal();
    return {
        ...actual,
        get: vi.fn(() => ({
            chains: [],
            parts: [],
            cuts: [],
        })),
    };
});

describe('Lead Persistence Utils', () => {
    const mockCut: CutData = {
        id: 'cut-1',
        name: 'Test Cut',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        action: OperationAction.CUT,
        cutDirection: CutDirection.CLOCKWISE,
        normal: { x: 1, y: 0 },
        normalConnectionPoint: { x: 0, y: 0 },
        normalSide: NormalSide.LEFT,
        leadInConfig: {
            type: LeadType.ARC,
            length: 5,
            flipSide: false,
            angle: 45,
            fit: true,
        },
        leadOutConfig: {
            type: LeadType.ARC,
            length: 3,
            flipSide: false,
            angle: 90,
            fit: true,
        },
    };

    const mockOperation: OperationData = {
        id: 'op-1',
        name: 'Test Operation',
        action: OperationAction.CUT,
        toolId: 'tool-1',
        targetType: 'chains',
        targetIds: ['chain-1'],
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
        leadInConfig: {
            type: LeadType.ARC,
            length: 5,
            flipSide: false,
            angle: 45,
            fit: false,
        },
        leadOutConfig: {
            type: LeadType.ARC,
            length: 3,
            flipSide: false,
            angle: 90,
            fit: false,
        },
        kerfCompensation: KerfCompensation.NONE,
    };

    const mockChain: ChainData = {
        id: 'chain-1',
        shapes: [
            {
                id: 'shape-1',
                type: GeometryType.LINE as GeometryType,
                geometry: { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset the mock implementation
        vi.mocked(calculateLeads).mockReturnValue({
            leadIn: {
                geometry: {
                    center: { x: 0, y: 0 },
                    radius: 5,
                    startAngle: 0,
                    endAngle: Math.PI,
                    clockwise: false,
                },
                type: LeadType.ARC,
            },
            leadOut: {
                geometry: {
                    center: { x: 12.5, y: 12.5 },
                    radius: 3.54,
                    startAngle: 0,
                    endAngle: Math.PI / 2,
                    clockwise: false,
                },
                type: LeadType.ARC,
            },
            warnings: ['Test warning'],
        });
    });

    describe('hasValidCachedLeads', () => {
        it('should return false for cut without cached leads', () => {
            const cutWithoutCache = {
                ...mockCut,
                calculatedLeadIn: undefined,
                calculatedLeadOut: undefined,
            };
            const result = hasValidCachedLeads(new Cut(cutWithoutCache));
            expect(result).toBe(false);
        });

        it('should return true for cut with valid cached leads', () => {
            const cutWithCache: CutData = {
                ...mockCut,
                leadIn: {
                    geometry: {
                        center: { x: 2.5, y: 2.5 },
                        radius: 3.54,
                        startAngle: Math.PI / 4,
                        endAngle: (5 * Math.PI) / 4,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
                leadOut: {
                    geometry: {
                        center: { x: 12.5, y: 12.5 },
                        radius: 3.54,
                        startAngle: 0,
                        endAngle: Math.PI / 2,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = hasValidCachedLeads(new Cut(cutWithCache));
            expect(result).toBe(true);
        });

        it('should return false for cut with mismatched lead types', () => {
            const cutWithMismatch: CutData = {
                ...mockCut,
                leadInConfig: {
                    ...mockCut.leadInConfig!,
                    type: LeadType.ARC, // Different from cached type
                },
                leadIn: {
                    geometry: {
                        center: { x: 2.5, y: 2.5 },
                        radius: 3.54,
                        startAngle: Math.PI / 4,
                        endAngle: (5 * Math.PI) / 4,
                        clockwise: false,
                    },
                    type: LeadType.ARC, // Cached as ARC but cut expects LINE
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = hasValidCachedLeads(new Cut(cutWithMismatch));
            expect(result).toBe(false);
        });

        it('should return false for cut with outdated version', () => {
            const cutWithOldVersion: CutData = {
                ...mockCut,
                leadIn: {
                    geometry: {
                        center: { x: 2.5, y: 2.5 },
                        radius: 3.54,
                        startAngle: Math.PI / 4,
                        endAngle: (5 * Math.PI) / 4,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '0.9.0', // Old version
                },
            };

            const result = hasValidCachedLeads(new Cut(cutWithOldVersion));
            expect(result).toBe(false);
        });

        it('should handle cuts with lead type "none"', () => {
            const cutWithNoLeads: CutData = {
                ...mockCut,
                leadInConfig: {
                    type: LeadType.NONE,
                    length: 0,
                    fit: true,
                },
                leadOutConfig: {
                    type: LeadType.NONE,
                    length: 0,
                    fit: true,
                },
            };

            const result = hasValidCachedLeads(new Cut(cutWithNoLeads));
            expect(result).toBe(true); // No leads needed, so cache is "valid"
        });
    });

    describe('getCachedLeadGeometry', () => {
        it('should return cached lead geometry', () => {
            const cutWithCache: CutData = {
                ...mockCut,
                leadIn: {
                    geometry: {
                        center: { x: 2.5, y: 2.5 },
                        radius: 3.54,
                        startAngle: Math.PI / 4,
                        endAngle: (5 * Math.PI) / 4,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
                leadOut: {
                    geometry: {
                        center: { x: 12.5, y: 12.5 },
                        radius: 3.536,
                        startAngle: 225,
                        endAngle: 45,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result: LeadResult = getCachedLeadGeometry(
                new Cut(cutWithCache)
            );

            expect(result.leadIn).toEqual({
                geometry: {
                    center: { x: 2.5, y: 2.5 },
                    radius: 3.54,
                    startAngle: Math.PI / 4,
                    endAngle: (5 * Math.PI) / 4,
                    clockwise: false,
                },
                type: LeadType.ARC,
                generatedAt: '2023-01-01T12:00:00.000Z',
                version: '1.0.0',
            });
            expect(result.leadOut).toEqual({
                geometry: {
                    center: { x: 12.5, y: 12.5 },
                    radius: 3.536,
                    startAngle: 225,
                    endAngle: 45,
                    clockwise: false,
                },
                type: LeadType.ARC,
                generatedAt: '2023-01-01T12:00:00.000Z',
                version: '1.0.0',
            });
        });

        it('should return undefined for missing cached leads', () => {
            const result = getCachedLeadGeometry(new Cut(mockCut));

            expect(result.leadIn).toBeUndefined();
            expect(result.leadOut).toBeUndefined();
        });
    });

    describe('calculateCutLeads', () => {
        it('should calculate and return lead geometry', async () => {
            // Setup mock to return the expected values for this test
            vi.mocked(calculateLeads).mockReturnValueOnce({
                leadIn: {
                    geometry: {
                        center: { x: 2.5, y: 2.5 },
                        radius: 3.54,
                        startAngle: Math.PI / 4,
                        endAngle: (5 * Math.PI) / 4,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                leadOut: {
                    geometry: {
                        center: { x: 12.5, y: 12.5 },
                        radius: 3.536,
                        startAngle: 225,
                        endAngle: 45,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                warnings: ['Test warning'],
            });

            const result = await calculateCutLeads(
                new Cut(mockCut),
                mockOperation,
                new Chain(mockChain),
                []
            );

            expect(result).toEqual(
                expect.objectContaining({
                    leadIn: {
                        geometry: {
                            center: { x: 2.5, y: 2.5 },
                            radius: 3.54,
                            startAngle: Math.PI / 4,
                            endAngle: (5 * Math.PI) / 4,
                            clockwise: false,
                        },
                        type: LeadType.ARC,
                    },
                    leadOut: {
                        geometry: {
                            center: { x: 12.5, y: 12.5 },
                            radius: 3.536,
                            startAngle: 225,
                            endAngle: 45,
                            clockwise: false,
                        },
                        type: LeadType.ARC,
                    },
                    validation: {
                        isValid: true,
                        warnings: ['Test warning'],
                        errors: [],
                        severity: 'warning',
                    },
                })
            );
        });

        it('should use offset geometry when calculatedOffset is present', async () => {
            const cutWithOffset: CutData = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        new Shape({
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: -2 },
                                end: { x: 10, y: -2 },
                            },
                            layer: '0',
                        }),
                    ],
                    originalShapes: [
                        new Shape({
                            id: 'shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                            layer: '0',
                        }),
                    ],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 4,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = await calculateCutLeads(
                new Cut(cutWithOffset),
                mockOperation,
                new Chain(mockChain),
                []
            );

            // Verify that calculateLeads was called with offset chain geometry
            expect(calculateLeads).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'chain-1_offset_temp',
                    shapes: cutWithOffset.offset!.offsetShapes,
                }),
                expect.any(Object), // leadInConfig
                expect.any(Object), // leadOutConfig
                CutDirection.CLOCKWISE,
                undefined,
                expect.any(Object) // cutNormal
            );

            // Verify result was returned
            expect(result).toBeDefined();
            expect(result.leadIn).toBeDefined();
            expect(result.leadOut).toBeDefined();
        });

        it('should use original geometry when calculatedOffset has empty shapes', async () => {
            const cutWithEmptyOffset: CutData = {
                ...mockCut,
                offset: {
                    offsetShapes: [], // Empty offset shapes
                    originalShapes: [
                        new Shape({
                            id: 'shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                            layer: '0',
                        }),
                    ],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 4,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = await calculateCutLeads(
                new Cut(cutWithEmptyOffset),
                mockOperation,
                new Chain(mockChain),
                []
            );

            // Verify that calculateLeads was called with original chain (not offset)
            expect(calculateLeads).toHaveBeenCalledWith(
                expect.any(Chain), // Should use original chain (as Chain instance)
                expect.any(Object), // leadInConfig
                expect.any(Object), // leadOutConfig
                CutDirection.CLOCKWISE,
                undefined,
                expect.any(Object) // cutNormal
            );

            // Verify result was returned
            expect(result).toBeDefined();
        });

        it('should skip calculation when both leads are disabled', async () => {
            const cutNoLeads: CutData = {
                ...mockCut,
                leadInConfig: {
                    type: LeadType.NONE,
                    length: 0,
                    fit: true,
                },
                leadOutConfig: {
                    type: LeadType.NONE,
                    length: 0,
                    fit: true,
                },
            };

            const result = await calculateCutLeads(
                new Cut(cutNoLeads),
                mockOperation,
                new Chain(mockChain),
                []
            );

            expect(result).toEqual({});
            expect(calculateLeads).not.toHaveBeenCalled();
        });

        it('should handle calculation errors gracefully', async () => {
            // Mock calculation to throw error
            vi.mocked(calculateLeads).mockImplementationOnce(() => {
                throw new Error('Calculation failed');
            });

            const result = await calculateCutLeads(
                new Cut(mockCut),
                mockOperation,
                new Chain(mockChain),
                []
            );

            expect(result).toEqual(
                expect.objectContaining({
                    validation: {
                        isValid: false,
                        warnings: [],
                        errors: ['Calculation failed'],
                        severity: 'error',
                    },
                })
            );
        });
    });

    describe('calculateLeadPoints', () => {
        const mockChainMap = new Map<string, ChainData>();
        const mockPartMap = new Map();

        beforeEach(() => {
            mockChainMap.clear();
            mockPartMap.clear();
            mockChainMap.set('chain-1', mockChain);
            mockPartMap.set('chain-1', { id: 'part-1', shells: [], holes: [] });
        });

        it('should return undefined when chainMap is undefined', async () => {
            const result = await calculateLeadPoints(
                new Cut(mockCut),
                undefined,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should return undefined when partMap is undefined', async () => {
            const result = await calculateLeadPoints(
                new Cut(mockCut),
                mockChainMap,
                undefined,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should return undefined when chain is not found', async () => {
            const cutWithUnknownChain = {
                ...mockCut,
                chainId: 'unknown-chain',
            };
            const result = await calculateLeadPoints(
                new Cut(cutWithUnknownChain),
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should calculate and return leadIn points', async () => {
            const result = await calculateLeadPoints(
                new Cut(mockCut),
                mockChainMap,
                mockPartMap,
                'leadIn'
            );

            // Since we're mocking an arc, we expect the conversion to return multiple points
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(calculateLeads).toHaveBeenCalled();
        });

        it('should calculate and return leadOut points', async () => {
            const result = await calculateLeadPoints(
                new Cut(mockCut),
                mockChainMap,
                mockPartMap,
                'leadOut'
            );

            // Since we're mocking an arc, we expect the conversion to return multiple points
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(calculateLeads).toHaveBeenCalled();
        });

        it('should return undefined when lead has no points', async () => {
            vi.mocked(calculateLeads).mockReturnValueOnce({
                leadIn: {
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 0,
                        startAngle: 0,
                        endAngle: 0,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                leadOut: {
                    geometry: {
                        center: { x: 0, y: 0 },
                        radius: 2.5,
                        startAngle: 0,
                        endAngle: 90,
                        clockwise: false,
                    },
                    type: LeadType.ARC,
                },
                warnings: [],
            });

            const result = await calculateLeadPoints(
                new Cut(mockCut),
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should return undefined when lead is null', async () => {
            vi.mocked(calculateLeads).mockReturnValueOnce({
                leadIn: undefined,
                leadOut: undefined,
                warnings: [],
            });

            const result = await calculateLeadPoints(
                new Cut(mockCut),
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should use offset shapes when available', async () => {
            const cutWithOffset: CutData = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        new Shape({
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: -2 },
                                end: { x: 10, y: -2 },
                            },
                        }),
                    ],
                    originalShapes: [new Shape(mockChain.shapes[0])],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 4,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = await calculateLeadPoints(
                new Cut(cutWithOffset),
                mockChainMap,
                mockPartMap,
                'leadIn'
            );

            expect(calculateLeads).toHaveBeenCalledWith(
                expect.objectContaining({
                    shapes: cutWithOffset.offset!.offsetShapes,
                }),
                expect.any(Object),
                expect.any(Object),
                CutDirection.CLOCKWISE,
                expect.any(Object),
                expect.any(Object) // cutNormal
            );
            expect(result).toBeDefined();
        });

        it('should handle calculation errors and return undefined', async () => {
            vi.mocked(calculateLeads).mockImplementationOnce(() => {
                throw new Error('Test calculation error');
            });

            const result = await calculateLeadPoints(
                new Cut(mockCut),
                mockChainMap,
                mockPartMap,
                'leadIn'
            );

            expect(result).toBeUndefined();
        });

        it('should handle calculation errors for leadOut', async () => {
            vi.mocked(calculateLeads).mockImplementationOnce(() => {
                throw new Error('Test calculation error');
            });

            const result = await calculateLeadPoints(
                new Cut(mockCut),
                mockChainMap,
                mockPartMap,
                'leadOut'
            );

            expect(result).toBeUndefined();
        });
    });
});
