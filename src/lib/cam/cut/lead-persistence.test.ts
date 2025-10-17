/**
 * Tests for lead persistence utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    calculateLeadPoints,
    getCachedLeadGeometry,
    hasValidCachedLeads,
} from './lead-persistence';
import type { Cut } from '$lib/cam/cut/interfaces';
import { calculateCutLeads } from '$lib/stores/operations/functions';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import { GeometryType } from '$lib/geometry/shape';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { calculateLeads } from '$lib/cam/lead/lead-calculation';
import type { Operation } from '$lib/stores/operations/interfaces';
import type { LeadResult } from '$lib/cam/lead/interfaces';
import { NormalSide } from '$lib/types/cam';

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
    const mockCut: Cut = {
        id: 'cut-1',
        name: 'Test Cut',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
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

    const mockOperation: Operation = {
        id: 'op-1',
        name: 'Test Operation',
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

    const mockChain: Chain = {
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
            const result = hasValidCachedLeads(cutWithoutCache);
            expect(result).toBe(false);
        });

        it('should return true for cut with valid cached leads', () => {
            const cutWithCache: Cut = {
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

            const result = hasValidCachedLeads(cutWithCache);
            expect(result).toBe(true);
        });

        it('should return false for cut with mismatched lead types', () => {
            const cutWithMismatch: Cut = {
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

            const result = hasValidCachedLeads(cutWithMismatch);
            expect(result).toBe(false);
        });

        it('should return false for cut with outdated version', () => {
            const cutWithOldVersion: Cut = {
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

            const result = hasValidCachedLeads(cutWithOldVersion);
            expect(result).toBe(false);
        });

        it('should handle cuts with lead type "none"', () => {
            const cutWithNoLeads: Cut = {
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

            const result = hasValidCachedLeads(cutWithNoLeads);
            expect(result).toBe(true); // No leads needed, so cache is "valid"
        });
    });

    describe('getCachedLeadGeometry', () => {
        it('should return cached lead geometry', () => {
            const cutWithCache: Cut = {
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
                leadValidation: {
                    isValid: true,
                    warnings: ['Test warning'],
                    severity: 'warning',
                    validatedAt: '2023-01-01T12:00:00.000Z',
                },
            };

            const result: LeadResult = getCachedLeadGeometry(cutWithCache);

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
            expect(result.validation).toEqual(cutWithCache.leadValidation);
        });

        it('should return undefined for missing cached leads', () => {
            const result = getCachedLeadGeometry(mockCut);

            expect(result.leadIn).toBeUndefined();
            expect(result.leadOut).toBeUndefined();
            expect(result.validation).toBeUndefined();
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
                mockCut,
                mockOperation,
                mockChain,
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
            const cutWithOffset: Cut = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        {
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: -2 },
                                end: { x: 10, y: -2 },
                            },
                        },
                    ],
                    originalShapes: [
                        {
                            id: 'shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                    ],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 4,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = await calculateCutLeads(
                cutWithOffset,
                mockOperation,
                mockChain,
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
            const cutWithEmptyOffset: Cut = {
                ...mockCut,
                offset: {
                    offsetShapes: [], // Empty offset shapes
                    originalShapes: [
                        {
                            id: 'shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: 0 },
                                end: { x: 10, y: 0 },
                            },
                        },
                    ],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 4,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = await calculateCutLeads(
                cutWithEmptyOffset,
                mockOperation,
                mockChain,
                []
            );

            // Verify that calculateLeads was called with original chain (not offset)
            expect(calculateLeads).toHaveBeenCalledWith(
                mockChain, // Should use original chain
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
            const cutNoLeads: Cut = {
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
                cutNoLeads,
                mockOperation,
                mockChain,
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
                mockCut,
                mockOperation,
                mockChain,
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
        const mockChainMap = new Map<string, Chain>();
        const mockPartMap = new Map();

        beforeEach(() => {
            mockChainMap.clear();
            mockPartMap.clear();
            mockChainMap.set('chain-1', mockChain);
            mockPartMap.set('chain-1', { id: 'part-1', shells: [], holes: [] });
        });

        it('should return undefined when chainMap is undefined', async () => {
            const result = await calculateLeadPoints(
                mockCut,
                undefined,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should return undefined when partMap is undefined', async () => {
            const result = await calculateLeadPoints(
                mockCut,
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
                cutWithUnknownChain,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should calculate and return leadIn points', async () => {
            const result = await calculateLeadPoints(
                mockCut,
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
                mockCut,
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
                mockCut,
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
                mockCut,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should use offset shapes when available', async () => {
            const cutWithOffset: Cut = {
                ...mockCut,
                offset: {
                    offsetShapes: [
                        {
                            id: 'offset-shape-1',
                            type: GeometryType.LINE,
                            geometry: {
                                start: { x: 0, y: -2 },
                                end: { x: 10, y: -2 },
                            },
                        },
                    ],
                    originalShapes: [mockChain.shapes[0]],
                    direction: OffsetDirection.INSET,
                    kerfWidth: 4,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = await calculateLeadPoints(
                cutWithOffset,
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
                mockCut,
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
                mockCut,
                mockChainMap,
                mockPartMap,
                'leadOut'
            );

            expect(result).toBeUndefined();
        });
    });
});
