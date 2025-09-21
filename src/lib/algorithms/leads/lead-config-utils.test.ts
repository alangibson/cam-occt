import { describe, expect, it } from 'vitest';
import {
    createLeadConfigs,
    createLeadInConfig,
    createLeadOutConfig,
} from '$lib/algorithms/leads/functions';
import { CutDirection, LeadType } from '$lib/types/direction';
import type { Path } from '$lib/stores/paths/interfaces';

// Helper function to create test path
function createTestPath(overrides: Partial<Path> = {}): Path {
    const defaultPath: Path = {
        id: 'test-path',
        name: 'Test Path',
        chainId: 'test-chain',
        operationId: 'test-operation',
        toolId: null,
        enabled: true,
        order: 1,
        cutDirection: CutDirection.COUNTERCLOCKWISE,
        leadInConfig: {
            type: LeadType.ARC,
            length: 5,
            flipSide: false,
            angle: 90,
            fit: true,
        },
        leadOutConfig: {
            type: LeadType.ARC,
            length: 10,
            flipSide: true,
            angle: 45,
            fit: true,
        },
    };

    return { ...defaultPath, ...overrides };
}

describe('createLeadInConfig', () => {
    it('should create lead-in config with all properties from path', () => {
        const path = createTestPath({
            leadInConfig: {
                type: LeadType.ARC,
                length: 7.5,
                flipSide: true,
                angle: 135,
                fit: true,
            },
        });

        const config = createLeadInConfig(path);

        expect(config.type).toBe(LeadType.ARC);
        expect(config.length).toBe(7.5);
        expect(config.flipSide).toBe(true);
        expect(config.angle).toBe(135);
    });

    it('should handle path with undefined lead-in properties', () => {
        const path = createTestPath({
            leadInConfig: undefined,
        });

        const config = createLeadInConfig(path);

        expect(config.type).toBe(LeadType.NONE);
        expect(config.length).toBe(0);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBeUndefined();
    });

    it('should handle path with mixed defined/undefined lead-in properties', () => {
        const path = createTestPath({
            leadInConfig: {
                type: LeadType.ARC,
                length: 3.14,
                flipSide: undefined,
                angle: 270,
                fit: true,
            },
        });

        const config = createLeadInConfig(path);

        expect(config.type).toBe(LeadType.ARC);
        expect(config.length).toBe(3.14);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBe(270);
    });

    it('should handle different lead types', () => {
        const lineConfig = createLeadInConfig(
            createTestPath({
                leadInConfig: { type: LeadType.ARC, length: 5, fit: true },
            })
        );
        expect(lineConfig.type).toBe(LeadType.ARC);

        const arcConfig = createLeadInConfig(
            createTestPath({
                leadInConfig: { type: LeadType.ARC, length: 5, fit: true },
            })
        );
        expect(arcConfig.type).toBe(LeadType.ARC);

        const noneConfig = createLeadInConfig(
            createTestPath({
                leadInConfig: { type: LeadType.NONE, length: 0, fit: true },
            })
        );
        expect(noneConfig.type).toBe(LeadType.NONE);
    });

    it('should handle zero and negative lengths', () => {
        const zeroConfig = createLeadInConfig(
            createTestPath({
                leadInConfig: { type: LeadType.ARC, length: 0, fit: true },
            })
        );
        expect(zeroConfig.length).toBe(0);

        const negativeConfig = createLeadInConfig(
            createTestPath({
                leadInConfig: { type: LeadType.ARC, length: -5, fit: true },
            })
        );
        expect(negativeConfig.length).toBe(-5);
    });

    it('should handle extreme angle values', () => {
        const config360 = createLeadInConfig(
            createTestPath({
                leadInConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    angle: 360,
                    fit: true,
                },
            })
        );
        expect(config360.angle).toBe(360);

        const configNegative = createLeadInConfig(
            createTestPath({
                leadInConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    angle: -90,
                    fit: true,
                },
            })
        );
        expect(configNegative.angle).toBe(-90);

        const configLarge = createLeadInConfig(
            createTestPath({
                leadInConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    angle: 720,
                    fit: true,
                },
            })
        );
        expect(configLarge.angle).toBe(720);
    });
});

describe('createLeadOutConfig', () => {
    it('should create lead-out config with all properties from path', () => {
        const path = createTestPath({
            leadOutConfig: {
                type: LeadType.ARC,
                length: 12.5,
                flipSide: false,
                angle: 180,
                fit: true,
            },
        });

        const config = createLeadOutConfig(path);

        expect(config.type).toBe(LeadType.ARC);
        expect(config.length).toBe(12.5);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBe(180);
    });

    it('should handle path with undefined lead-out properties', () => {
        const path = createTestPath({
            leadOutConfig: undefined,
        });

        const config = createLeadOutConfig(path);

        expect(config.type).toBe(LeadType.NONE);
        expect(config.length).toBe(0);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBeUndefined();
    });

    it('should handle path with mixed defined/undefined lead-out properties', () => {
        const path = createTestPath({
            leadOutConfig: {
                type: LeadType.ARC,
                length: 0, // Use valid value since length is required
                flipSide: true,
                angle: undefined,
                fit: true,
            },
        });

        const config = createLeadOutConfig(path);

        expect(config.type).toBe(LeadType.ARC);
        expect(config.length).toBe(0);
        expect(config.flipSide).toBe(true);
        expect(config.angle).toBeUndefined();
    });

    it('should handle different lead types', () => {
        const lineConfig = createLeadOutConfig(
            createTestPath({
                leadOutConfig: { type: LeadType.ARC, length: 5, fit: true },
            })
        );
        expect(lineConfig.type).toBe(LeadType.ARC);

        const arcConfig = createLeadOutConfig(
            createTestPath({
                leadOutConfig: { type: LeadType.ARC, length: 5, fit: true },
            })
        );
        expect(arcConfig.type).toBe(LeadType.ARC);

        const noneConfig = createLeadOutConfig(
            createTestPath({
                leadOutConfig: { type: LeadType.NONE, length: 0, fit: true },
            })
        );
        expect(noneConfig.type).toBe(LeadType.NONE);
    });

    it('should handle zero and negative lengths', () => {
        const zeroConfig = createLeadOutConfig(
            createTestPath({
                leadOutConfig: { type: LeadType.ARC, length: 0, fit: true },
            })
        );
        expect(zeroConfig.length).toBe(0);

        const negativeConfig = createLeadOutConfig(
            createTestPath({
                leadOutConfig: { type: LeadType.ARC, length: -3.5, fit: true },
            })
        );
        expect(negativeConfig.length).toBe(-3.5);
    });

    it('should handle extreme angle values', () => {
        const config360 = createLeadOutConfig(
            createTestPath({
                leadOutConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    angle: 360,
                    fit: true,
                },
            })
        );
        expect(config360.angle).toBe(360);

        const configNegative = createLeadOutConfig(
            createTestPath({
                leadOutConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    angle: -45,
                    fit: true,
                },
            })
        );
        expect(configNegative.angle).toBe(-45);

        const configLarge = createLeadOutConfig(
            createTestPath({
                leadOutConfig: {
                    type: LeadType.ARC,
                    length: 5,
                    angle: 540,
                    fit: true,
                },
            })
        );
        expect(configLarge.angle).toBe(540);
    });
});

describe('createLeadConfigs', () => {
    it('should create both lead-in and lead-out configs from path', () => {
        const path = createTestPath({
            leadInConfig: {
                type: LeadType.ARC,
                length: 8,
                flipSide: true,
                angle: 90,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 15,
                flipSide: false,
                angle: 270,
                fit: true,
            },
        });

        const configs = createLeadConfigs(path);

        // Check lead-in config
        expect(configs.leadIn.type).toBe(LeadType.ARC);
        expect(configs.leadIn.length).toBe(8);
        expect(configs.leadIn.flipSide).toBe(true);
        expect(configs.leadIn.angle).toBe(90);

        // Check lead-out config
        expect(configs.leadOut.type).toBe(LeadType.ARC);
        expect(configs.leadOut.length).toBe(15);
        expect(configs.leadOut.flipSide).toBe(false);
        expect(configs.leadOut.angle).toBe(270);
    });

    it('should handle path with no lead configurations', () => {
        const path = createTestPath({
            leadInConfig: undefined,
            leadOutConfig: undefined,
        });

        const configs = createLeadConfigs(path);

        // Check lead-in defaults
        expect(configs.leadIn.type).toBe(LeadType.NONE);
        expect(configs.leadIn.length).toBe(0);
        expect(configs.leadIn.flipSide).toBe(false);
        expect(configs.leadIn.angle).toBeUndefined();

        // Check lead-out defaults
        expect(configs.leadOut.type).toBe(LeadType.NONE);
        expect(configs.leadOut.length).toBe(0);
        expect(configs.leadOut.flipSide).toBe(false);
        expect(configs.leadOut.angle).toBeUndefined();
    });

    it('should handle path with only lead-in configuration', () => {
        const path = createTestPath({
            leadInConfig: {
                type: LeadType.ARC,
                length: 6,
                flipSide: false,
                angle: 180,
                fit: true,
            },
            leadOutConfig: undefined,
        });

        const configs = createLeadConfigs(path);

        // Check lead-in config
        expect(configs.leadIn.type).toBe(LeadType.ARC);
        expect(configs.leadIn.length).toBe(6);
        expect(configs.leadIn.flipSide).toBe(false);
        expect(configs.leadIn.angle).toBe(180);

        // Check lead-out defaults
        expect(configs.leadOut.type).toBe(LeadType.NONE);
        expect(configs.leadOut.length).toBe(0);
        expect(configs.leadOut.flipSide).toBe(false);
        expect(configs.leadOut.angle).toBeUndefined();
    });

    it('should handle path with only lead-out configuration', () => {
        const path = createTestPath({
            leadInConfig: undefined,
            leadOutConfig: {
                type: LeadType.ARC,
                length: 9.5,
                flipSide: true,
                angle: 45,
                fit: true,
            },
        });

        const configs = createLeadConfigs(path);

        // Check lead-in defaults
        expect(configs.leadIn.type).toBe(LeadType.NONE);
        expect(configs.leadIn.length).toBe(0);
        expect(configs.leadIn.flipSide).toBe(false);
        expect(configs.leadIn.angle).toBeUndefined();

        // Check lead-out config
        expect(configs.leadOut.type).toBe(LeadType.ARC);
        expect(configs.leadOut.length).toBe(9.5);
        expect(configs.leadOut.flipSide).toBe(true);
        expect(configs.leadOut.angle).toBe(45);
    });

    it('should produce same results as individual functions', () => {
        const path = createTestPath({
            leadInConfig: {
                type: LeadType.ARC,
                length: 4.2,
                flipSide: true,
                angle: 315,
                fit: true,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 7.8,
                flipSide: false,
                angle: 225,
                fit: true,
            },
        });

        const combinedConfigs = createLeadConfigs(path);
        const separateLeadIn = createLeadInConfig(path);
        const separateLeadOut = createLeadOutConfig(path);

        // Verify lead-in configs match
        expect(combinedConfigs.leadIn).toEqual(separateLeadIn);

        // Verify lead-out configs match
        expect(combinedConfigs.leadOut).toEqual(separateLeadOut);
    });

    it('should handle different combinations of lead types', () => {
        const testCases = [
            { in: LeadType.NONE, out: LeadType.NONE },
            { in: LeadType.ARC, out: LeadType.NONE },
            { in: LeadType.NONE, out: LeadType.ARC },
            { in: LeadType.ARC, out: LeadType.NONE },
            { in: LeadType.NONE, out: LeadType.ARC },
            { in: LeadType.ARC, out: LeadType.ARC },
            { in: LeadType.ARC, out: LeadType.ARC },
            { in: LeadType.ARC, out: LeadType.ARC },
            { in: LeadType.ARC, out: LeadType.ARC },
        ];

        testCases.forEach(({ in: inType, out: outType }) => {
            const path = createTestPath({
                leadInConfig: { type: inType, length: 5, fit: true },
                leadOutConfig: { type: outType, length: 5, fit: true },
            });

            const configs = createLeadConfigs(path);

            expect(configs.leadIn.type).toBe(inType);
            expect(configs.leadOut.type).toBe(outType);
        });
    });
});
