/**
 * Tests for lead persistence utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    calculateLeadPoints,
    getCachedLeadGeometry,
    hasValidCachedLeads,
} from './lead-persistence-utils';
import type { Path } from '$lib/stores/paths/interfaces';
import { calculatePathLeads } from '$lib/stores/operations/functions';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import { GeometryType } from '$lib/types/geometry';
import { OffsetDirection } from '$lib/algorithms/offset-calculation/offset/types';
import { calculateLeads } from '$lib/algorithms/leads/lead-calculation';
import type { Operation } from '$lib/stores/operations/interfaces';

// Mock the stores
vi.mock('$lib/stores/paths/store', () => ({
    pathStore: {
        updatePathLeadGeometry: vi.fn(),
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
vi.mock('$lib/algorithms/leads/lead-calculation', () => ({
    calculateLeads: vi.fn(() => ({
        leadIn: {
            points: [
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ],
            type: LeadType.ARC,
        },
        leadOut: {
            points: [
                { x: 10, y: 10 },
                { x: 15, y: 15 },
            ],
            type: LeadType.LINE,
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
            paths: [],
        })),
    };
});

describe('Lead Persistence Utils', () => {
    const mockPath: Path = {
        id: 'path-1',
        name: 'Test Path',
        operationId: 'op-1',
        chainId: 'chain-1',
        toolId: 'tool-1',
        enabled: true,
        order: 1,
        cutDirection: CutDirection.CLOCKWISE,
        leadInType: LeadType.ARC,
        leadInLength: 5,
        leadInFlipSide: false,
        leadInAngle: 45,
        leadOutType: LeadType.LINE,
        leadOutLength: 3,
        leadOutFlipSide: false,
        leadOutAngle: 90,
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
        leadInType: LeadType.ARC,
        leadInLength: 5,
        leadInFlipSide: false,
        leadInFit: false,
        leadInAngle: 45,
        leadOutType: LeadType.LINE,
        leadOutLength: 3,
        leadOutFlipSide: false,
        leadOutFit: false,
        leadOutAngle: 90,
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
                points: [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                ],
                type: LeadType.ARC,
            },
            leadOut: {
                points: [
                    { x: 10, y: 10 },
                    { x: 15, y: 15 },
                ],
                type: LeadType.LINE,
            },
            warnings: ['Test warning'],
        });
    });

    describe('hasValidCachedLeads', () => {
        it('should return false for path without cached leads', () => {
            const pathWithoutCache = {
                ...mockPath,
                calculatedLeadIn: undefined,
                calculatedLeadOut: undefined,
            };
            const result = hasValidCachedLeads(pathWithoutCache);
            expect(result).toBe(false);
        });

        it('should return true for path with valid cached leads', () => {
            const pathWithCache: Path = {
                ...mockPath,
                calculatedLeadIn: {
                    points: [
                        { x: 0, y: 0 },
                        { x: 5, y: 5 },
                    ],
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
                calculatedLeadOut: {
                    points: [
                        { x: 10, y: 10 },
                        { x: 15, y: 15 },
                    ],
                    type: LeadType.LINE,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = hasValidCachedLeads(pathWithCache);
            expect(result).toBe(true);
        });

        it('should return false for path with mismatched lead types', () => {
            const pathWithMismatch: Path = {
                ...mockPath,
                leadInType: LeadType.LINE, // Different from cached type
                calculatedLeadIn: {
                    points: [
                        { x: 0, y: 0 },
                        { x: 5, y: 5 },
                    ],
                    type: LeadType.ARC, // Cached as ARC but path expects LINE
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
            };

            const result = hasValidCachedLeads(pathWithMismatch);
            expect(result).toBe(false);
        });

        it('should return false for path with outdated version', () => {
            const pathWithOldVersion: Path = {
                ...mockPath,
                calculatedLeadIn: {
                    points: [
                        { x: 0, y: 0 },
                        { x: 5, y: 5 },
                    ],
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '0.9.0', // Old version
                },
            };

            const result = hasValidCachedLeads(pathWithOldVersion);
            expect(result).toBe(false);
        });

        it('should handle paths with lead type "none"', () => {
            const pathWithNoLeads: Path = {
                ...mockPath,
                leadInType: LeadType.NONE,
                leadOutType: LeadType.NONE,
            };

            const result = hasValidCachedLeads(pathWithNoLeads);
            expect(result).toBe(true); // No leads needed, so cache is "valid"
        });
    });

    describe('getCachedLeadGeometry', () => {
        it('should return cached lead geometry', () => {
            const pathWithCache: Path = {
                ...mockPath,
                calculatedLeadIn: {
                    points: [
                        { x: 0, y: 0 },
                        { x: 5, y: 5 },
                    ],
                    type: LeadType.ARC,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
                calculatedLeadOut: {
                    points: [
                        { x: 10, y: 10 },
                        { x: 15, y: 15 },
                    ],
                    type: LeadType.LINE,
                    generatedAt: '2023-01-01T12:00:00.000Z',
                    version: '1.0.0',
                },
                leadValidation: {
                    isValid: true,
                    warnings: ['Test warning'],
                    errors: [],
                    severity: 'warning',
                    validatedAt: '2023-01-01T12:00:00.000Z',
                },
            };

            const result = getCachedLeadGeometry(pathWithCache);

            expect(result.leadIn).toEqual({
                points: [
                    { x: 0, y: 0 },
                    { x: 5, y: 5 },
                ],
                type: LeadType.ARC,
            });
            expect(result.leadOut).toEqual({
                points: [
                    { x: 10, y: 10 },
                    { x: 15, y: 15 },
                ],
                type: LeadType.LINE,
            });
            expect(result.validation).toEqual(pathWithCache.leadValidation);
        });

        it('should return null for missing cached leads', () => {
            const result = getCachedLeadGeometry(mockPath);

            expect(result.leadIn).toBeNull();
            expect(result.leadOut).toBeNull();
            expect(result.validation).toBeUndefined();
        });
    });

    describe('calculatePathLeads', () => {
        it('should calculate and return lead geometry', async () => {
            const result = await calculatePathLeads(
                mockPath,
                mockOperation,
                mockChain,
                []
            );

            expect(result).toEqual(
                expect.objectContaining({
                    leadIn: {
                        points: [
                            { x: 0, y: 0 },
                            { x: 5, y: 5 },
                        ],
                        type: LeadType.ARC,
                    },
                    leadOut: {
                        points: [
                            { x: 10, y: 10 },
                            { x: 15, y: 15 },
                        ],
                        type: LeadType.LINE,
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
            const pathWithOffset: Path = {
                ...mockPath,
                calculatedOffset: {
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

            const result = await calculatePathLeads(
                pathWithOffset,
                mockOperation,
                mockChain,
                []
            );

            // Verify that calculateLeads was called with offset chain geometry
            expect(calculateLeads).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'chain-1_offset_temp',
                    shapes: pathWithOffset.calculatedOffset!.offsetShapes,
                }),
                expect.any(Object), // leadInConfig
                expect.any(Object), // leadOutConfig
                CutDirection.CLOCKWISE,
                undefined
            );

            // Verify result was returned
            expect(result).toBeDefined();
            expect(result.leadIn).toBeDefined();
            expect(result.leadOut).toBeDefined();
        });

        it('should use original geometry when calculatedOffset has empty shapes', async () => {
            const pathWithEmptyOffset: Path = {
                ...mockPath,
                calculatedOffset: {
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

            const result = await calculatePathLeads(
                pathWithEmptyOffset,
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
                undefined
            );

            // Verify result was returned
            expect(result).toBeDefined();
        });

        it('should skip calculation when both leads are disabled', async () => {
            const pathNoLeads: Path = {
                ...mockPath,
                leadInType: LeadType.NONE,
                leadOutType: LeadType.NONE,
            };

            const result = await calculatePathLeads(
                pathNoLeads,
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

            const result = await calculatePathLeads(
                mockPath,
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

        it('should return undefined when chainMap is undefined', () => {
            const result = calculateLeadPoints(
                mockPath,
                undefined,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should return undefined when partMap is undefined', () => {
            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                undefined,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should return undefined when chain is not found', () => {
            const pathWithUnknownChain = {
                ...mockPath,
                chainId: 'unknown-chain',
            };
            const result = calculateLeadPoints(
                pathWithUnknownChain,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should calculate and return leadIn points', () => {
            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );

            expect(result).toEqual([
                { x: 0, y: 0 },
                { x: 5, y: 5 },
            ]);
            expect(calculateLeads).toHaveBeenCalled();
        });

        it('should calculate and return leadOut points', () => {
            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                mockPartMap,
                'leadOut'
            );

            expect(result).toEqual([
                { x: 10, y: 10 },
                { x: 15, y: 15 },
            ]);
            expect(calculateLeads).toHaveBeenCalled();
        });

        it('should return undefined when lead has no points', () => {
            vi.mocked(calculateLeads).mockReturnValueOnce({
                leadIn: {
                    points: [],
                    type: LeadType.ARC,
                },
                leadOut: {
                    points: [],
                    type: LeadType.LINE,
                },
                warnings: [],
            });

            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should return undefined when lead is null', () => {
            vi.mocked(calculateLeads).mockReturnValueOnce({
                leadIn: undefined,
                leadOut: undefined,
                warnings: [],
            });

            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );
            expect(result).toBeUndefined();
        });

        it('should use offset shapes when available', () => {
            const pathWithOffset: Path = {
                ...mockPath,
                calculatedOffset: {
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

            const result = calculateLeadPoints(
                pathWithOffset,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );

            expect(calculateLeads).toHaveBeenCalledWith(
                expect.objectContaining({
                    shapes: pathWithOffset.calculatedOffset!.offsetShapes,
                }),
                expect.any(Object),
                expect.any(Object),
                CutDirection.CLOCKWISE,
                expect.any(Object)
            );
            expect(result).toBeDefined();
        });

        it('should handle calculation errors and return undefined', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.mocked(calculateLeads).mockImplementationOnce(() => {
                throw new Error('Test calculation error');
            });

            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );

            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to calculate lead-in for G-code generation:',
                'Test Path',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('should handle calculation errors for leadOut', () => {
            const consoleSpy = vi
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            vi.mocked(calculateLeads).mockImplementationOnce(() => {
                throw new Error('Test calculation error');
            });

            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                mockPartMap,
                'leadOut'
            );

            expect(result).toBeUndefined();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to calculate lead-out for G-code generation:',
                'Test Path',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });
});
