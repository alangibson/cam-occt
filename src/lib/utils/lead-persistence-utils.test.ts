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
import type { LeadResult } from '$lib/algorithms/leads/interfaces';

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

            const result = hasValidCachedLeads(pathWithCache);
            expect(result).toBe(true);
        });

        it('should return false for path with mismatched lead types', () => {
            const pathWithMismatch: Path = {
                ...mockPath,
                leadInConfig: {
                    ...mockPath.leadInConfig!,
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

            const result = hasValidCachedLeads(pathWithOldVersion);
            expect(result).toBe(false);
        });

        it('should handle paths with lead type "none"', () => {
            const pathWithNoLeads: Path = {
                ...mockPath,
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

            const result = hasValidCachedLeads(pathWithNoLeads);
            expect(result).toBe(true); // No leads needed, so cache is "valid"
        });
    });

    describe('getCachedLeadGeometry', () => {
        it('should return cached lead geometry', () => {
            const pathWithCache: Path = {
                ...mockPath,
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

            const result: LeadResult = getCachedLeadGeometry(pathWithCache);

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
            expect(result.validation).toEqual(pathWithCache.leadValidation);
        });

        it('should return undefined for missing cached leads', () => {
            const result = getCachedLeadGeometry(mockPath);

            expect(result.leadIn).toBeUndefined();
            expect(result.leadOut).toBeUndefined();
            expect(result.validation).toBeUndefined();
        });
    });

    describe('calculatePathLeads', () => {
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

            const result = await calculatePathLeads(
                mockPath,
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
            const pathWithOffset: Path = {
                ...mockPath,
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
                    shapes: pathWithOffset.offset!.offsetShapes,
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

            // Since we're mocking an arc, we expect the conversion to return multiple points
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(calculateLeads).toHaveBeenCalled();
        });

        it('should calculate and return leadOut points', () => {
            const result = calculateLeadPoints(
                mockPath,
                mockChainMap,
                mockPartMap,
                'leadOut'
            );

            // Since we're mocking an arc, we expect the conversion to return multiple points
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(calculateLeads).toHaveBeenCalled();
        });

        it('should return undefined when lead has no points', () => {
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

            const result = calculateLeadPoints(
                pathWithOffset,
                mockChainMap,
                mockPartMap,
                'leadIn'
            );

            expect(calculateLeads).toHaveBeenCalledWith(
                expect.objectContaining({
                    shapes: pathWithOffset.offset!.offsetShapes,
                }),
                expect.any(Object),
                expect.any(Object),
                CutDirection.CLOCKWISE,
                expect.any(Object)
            );
            expect(result).toBeDefined();
        });

        it('should handle calculation errors and return undefined', () => {
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
        });

        it('should handle calculation errors for leadOut', () => {
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
        });
    });
});
