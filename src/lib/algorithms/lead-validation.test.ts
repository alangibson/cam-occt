import { describe, it, expect } from 'vitest';
import { validateLeadConfiguration } from './lead-validation';
import { LeadType, CutDirection } from '../types/direction';
import type { Chain } from './chain-detection/chain-detection';
import type { DetectedPart } from './part-detection';
import type { Shape } from '../../lib/types/geometry';

describe('Lead Validation Pipeline', () => {
    // Helper to create a simple line chain
    function createLineChain(
        start: { x: number; y: number },
        end: { x: number; y: number },
        chainId = 'chain1'
    ): Chain {
        const shape: Shape = {
            id: 'line1',
            type: 'line',
            geometry: { start, end },
            layer: 'layer1',
        };

        return {
            id: chainId,
            shapes: [shape],
        };
    }

    // Helper to create a circle chain
    function createCircleChain(
        center: { x: number; y: number },
        radius: number,
        chainId = 'chain1'
    ): Chain {
        const shape: Shape = {
            id: 'circle1',
            type: 'circle',
            geometry: { center, radius },
            layer: 'layer1',
        };

        return {
            id: chainId,
            shapes: [shape],
        };
    }

    describe('basic configuration validation', () => {
        it('should validate correct configuration', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.ARC, length: 5 },
                leadOut: { type: LeadType.LINE, length: 3 },
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, chain);

            expect(result.isValid).toBe(true);
            expect(result.severity).toBe('info');
        });

        it('should reject negative lead lengths', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.ARC, length: -5 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, chain);

            expect(result.isValid).toBe(false);
            expect(result.severity).toBe('error');
            expect(result.warnings).toContain(
                'Lead-in length cannot be negative'
            );
            expect(result.suggestions).toContain(
                'Set lead-in length to 0 or a positive value'
            );
        });

        it('should warn about type/length mismatch', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.NONE, length: 5 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, chain);

            expect(result.isValid).toBe(true); // Not an error, just warning
            expect(result.severity).toBe('warning');
            expect(result.warnings).toContain(
                'Lead-in type is "none" but length is greater than 0'
            );
        });

        it('should reject invalid angles', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.ARC, length: 5, angle: 400 }, // Invalid angle
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, chain);

            expect(result.isValid).toBe(false);
            expect(result.severity).toBe('error');
            expect(result.warnings).toContain(
                'Lead-in angle must be between 0 and 359 degrees'
            );
        });
    });

    describe('chain geometry validation', () => {
        it('should reject empty chains', () => {
            const emptyChain: Chain = { id: 'empty', shapes: [] };
            const config = {
                leadIn: { type: LeadType.ARC, length: 5 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, emptyChain);

            expect(result.isValid).toBe(false);
            expect(result.severity).toBe('error');
            expect(result.warnings).toContain(
                'Cannot generate leads for empty chain'
            );
        });

        it('should warn about very long leads on small chains', () => {
            const smallChain = createCircleChain({ x: 0, y: 0 }, 2); // Small 2-unit radius circle
            const config = {
                leadIn: { type: LeadType.ARC, length: 20 }, // Very long lead
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.CLOCKWISE,
            };

            const result = validateLeadConfiguration(config, smallChain);

            expect(result.isValid).toBe(true);
            expect(result.severity).toBe('warning');
            expect(
                result.warnings.some((w) =>
                    w.includes(
                        'Lead-in length is very large compared to chain size'
                    )
                )
            ).toBe(true);
        });

        it('should warn about long leads on very small geometry', () => {
            const tinyChain = createLineChain({ x: 0, y: 0 }, { x: 1, y: 0 }); // 1-unit line (very small)
            const config = {
                leadIn: { type: LeadType.ARC, length: 15 },
                leadOut: { type: LeadType.ARC, length: 15 },
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, tinyChain);

            expect(
                result.warnings.some((w) =>
                    w.includes('Chain is very small but leads are long')
                )
            ).toBe(true);
        });
    });

    describe('part context validation', () => {
        it('should provide info for hole chains', () => {
            const holeChain = createCircleChain(
                { x: 5, y: 5 },
                2,
                'hole-chain'
            );
            const shellChain = createCircleChain(
                { x: 5, y: 5 },
                10,
                'shell-chain'
            );

            const part: DetectedPart = {
                id: 'part1',
                shell: {
                    id: 'shell1',
                    chain: shellChain,
                    type: 'shell',
                    boundingBox: { minX: -5, maxX: 15, minY: -5, maxY: 15 },
                    holes: [],
                },
                holes: [
                    {
                        id: 'hole1',
                        chain: holeChain,
                        type: 'hole',
                        boundingBox: { minX: 3, maxX: 7, minY: 3, maxY: 7 },
                        holes: [],
                    },
                ],
            };

            const config = {
                leadIn: { type: LeadType.ARC, length: 3 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.CLOCKWISE,
            };

            const result = validateLeadConfiguration(config, holeChain, part);

            expect(
                result.warnings.some((w) =>
                    w.includes('Generating leads for hole')
                )
            ).toBe(true);
        });

        it('should warn about chain not belonging to part', () => {
            const orphanChain = createCircleChain(
                { x: 100, y: 100 },
                5,
                'orphan-chain'
            ); // Different chain ID
            const shellChain = createCircleChain(
                { x: 5, y: 5 },
                10,
                'shell-chain'
            );

            const part: DetectedPart = {
                id: 'part1',
                shell: {
                    id: 'shell1',
                    chain: shellChain,
                    type: 'shell',
                    boundingBox: { minX: -5, maxX: 15, minY: -5, maxY: 15 },
                    holes: [],
                },
                holes: [],
            };

            const config = {
                leadIn: { type: LeadType.ARC, length: 3 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.CLOCKWISE,
            };

            const result = validateLeadConfiguration(config, orphanChain, part);

            expect(result.warnings).toContain(
                'Chain is not recognized as part of the specified part'
            );
        });
    });

    describe('lead length validation', () => {
        it('should warn about very long leads', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.ARC, length: 100 }, // Very long
                leadOut: { type: LeadType.ARC, length: 75 }, // Very long
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, chain);

            expect(
                result.warnings.some((w) =>
                    w.includes('Lead-in length (100) is very long')
                )
            ).toBe(true);
            expect(
                result.warnings.some((w) =>
                    w.includes('Lead-out length (75) is very long')
                )
            ).toBe(true);
        });

        it('should provide info about very short leads', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.ARC, length: 0.1 }, // Very short
                leadOut: { type: LeadType.LINE, length: 0.2 }, // Very short
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, chain);

            expect(
                result.warnings.some((w) =>
                    w.includes('Lead-in length (0.1) is very short')
                )
            ).toBe(true);
            expect(
                result.warnings.some((w) =>
                    w.includes('Lead-out length (0.2) is very short')
                )
            ).toBe(true);
        });
    });

    describe('cut direction compatibility', () => {
        it('should suggest cut direction for closed chains', () => {
            const closedChain = createCircleChain({ x: 0, y: 0 }, 5);
            const config = {
                leadIn: { type: LeadType.ARC, length: 5 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.NONE, // Not specified for closed chain
            };

            const result = validateLeadConfiguration(config, closedChain);

            expect(
                result.warnings.some((w) =>
                    w.includes(
                        'Closed chain detected but cut direction is "none"'
                    )
                )
            ).toBe(true);
            expect(
                result.suggestions?.some((s) =>
                    s.includes(
                        'Consider specifying "clockwise" or "counterclockwise"'
                    )
                )
            ).toBe(true);
        });

        it('should note unnecessary cut direction for open chains', () => {
            const openChain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.ARC, length: 5 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.CLOCKWISE, // Not needed for open chain
            };

            const result = validateLeadConfiguration(config, openChain);

            expect(
                result.warnings.some((w) =>
                    w.includes(
                        'Cut direction specified for open chain (not necessary)'
                    )
                )
            ).toBe(true);
        });

        it('should warn about manual angles overriding cut direction', () => {
            const closedChain = createCircleChain({ x: 0, y: 0 }, 5);
            const config = {
                leadIn: { type: LeadType.ARC, length: 5, angle: 45 }, // Manual angle
                leadOut: { type: LeadType.ARC, length: 5, angle: 135 }, // Manual angle
                cutDirection: CutDirection.CLOCKWISE,
            };

            const result = validateLeadConfiguration(config, closedChain);

            expect(
                result.warnings.some((w) =>
                    w.includes(
                        'Manual lead-in angle specified with cut direction'
                    )
                )
            ).toBe(true);
            expect(
                result.warnings.some((w) =>
                    w.includes(
                        'Manual lead-out angle specified with cut direction'
                    )
                )
            ).toBe(true);
        });
    });

    describe('validation result structure', () => {
        it('should provide complete validation result structure', () => {
            const chain = createLineChain({ x: 0, y: 0 }, { x: 10, y: 0 });
            const config = {
                leadIn: { type: LeadType.ARC, length: 5 },
                leadOut: { type: LeadType.NONE, length: 0 },
                cutDirection: CutDirection.NONE,
            };

            const result = validateLeadConfiguration(config, chain);

            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('warnings');
            expect(result).toHaveProperty('severity');
            expect(typeof result.isValid).toBe('boolean');
            expect(Array.isArray(result.warnings)).toBe(true);
            expect(['info', 'warning', 'error']).toContain(result.severity);

            // suggestions is optional
            if (result.suggestions) {
                expect(Array.isArray(result.suggestions)).toBe(true);
            }
        });
    });
});
