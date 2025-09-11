import { describe, expect, it } from 'vitest';
import {
    createLeadConfigs,
    createLeadInConfig,
    createLeadOutConfig,
} from './lead-config-utils';
import { CutDirection, LeadType } from '$lib/types/direction';
import type { Path } from '$lib/stores/paths';

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
        leadInType: LeadType.LINE,
        leadInLength: 5,
        leadInFlipSide: false,
        leadInAngle: 90,
        leadOutType: LeadType.ARC,
        leadOutLength: 10,
        leadOutFlipSide: true,
        leadOutAngle: 45,
    };

    return { ...defaultPath, ...overrides };
}

describe('createLeadInConfig', () => {
    it('should create lead-in config with all properties from path', () => {
        const path = createTestPath({
            leadInType: LeadType.LINE,
            leadInLength: 7.5,
            leadInFlipSide: true,
            leadInAngle: 135,
        });

        const config = createLeadInConfig(path);

        expect(config.type).toBe(LeadType.LINE);
        expect(config.length).toBe(7.5);
        expect(config.flipSide).toBe(true);
        expect(config.angle).toBe(135);
    });

    it('should handle path with undefined lead-in properties', () => {
        const path = createTestPath({
            leadInType: undefined,
            leadInLength: undefined,
            leadInFlipSide: undefined,
            leadInAngle: undefined,
        });

        const config = createLeadInConfig(path);

        expect(config.type).toBe(LeadType.NONE);
        expect(config.length).toBe(0);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBeUndefined();
    });

    it('should handle path with mixed defined/undefined lead-in properties', () => {
        const path = createTestPath({
            leadInType: LeadType.ARC,
            leadInLength: 3.14,
            leadInFlipSide: undefined,
            leadInAngle: 270,
        });

        const config = createLeadInConfig(path);

        expect(config.type).toBe(LeadType.ARC);
        expect(config.length).toBe(3.14);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBe(270);
    });

    it('should handle different lead types', () => {
        const lineConfig = createLeadInConfig(
            createTestPath({ leadInType: LeadType.LINE })
        );
        expect(lineConfig.type).toBe(LeadType.LINE);

        const arcConfig = createLeadInConfig(
            createTestPath({ leadInType: LeadType.ARC })
        );
        expect(arcConfig.type).toBe(LeadType.ARC);

        const noneConfig = createLeadInConfig(
            createTestPath({ leadInType: LeadType.NONE })
        );
        expect(noneConfig.type).toBe(LeadType.NONE);
    });

    it('should handle zero and negative lengths', () => {
        const zeroConfig = createLeadInConfig(
            createTestPath({ leadInLength: 0 })
        );
        expect(zeroConfig.length).toBe(0);

        const negativeConfig = createLeadInConfig(
            createTestPath({ leadInLength: -5 })
        );
        expect(negativeConfig.length).toBe(-5);
    });

    it('should handle extreme angle values', () => {
        const config360 = createLeadInConfig(
            createTestPath({ leadInAngle: 360 })
        );
        expect(config360.angle).toBe(360);

        const configNegative = createLeadInConfig(
            createTestPath({ leadInAngle: -90 })
        );
        expect(configNegative.angle).toBe(-90);

        const configLarge = createLeadInConfig(
            createTestPath({ leadInAngle: 720 })
        );
        expect(configLarge.angle).toBe(720);
    });
});

describe('createLeadOutConfig', () => {
    it('should create lead-out config with all properties from path', () => {
        const path = createTestPath({
            leadOutType: LeadType.ARC,
            leadOutLength: 12.5,
            leadOutFlipSide: false,
            leadOutAngle: 180,
        });

        const config = createLeadOutConfig(path);

        expect(config.type).toBe(LeadType.ARC);
        expect(config.length).toBe(12.5);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBe(180);
    });

    it('should handle path with undefined lead-out properties', () => {
        const path = createTestPath({
            leadOutType: undefined,
            leadOutLength: undefined,
            leadOutFlipSide: undefined,
            leadOutAngle: undefined,
        });

        const config = createLeadOutConfig(path);

        expect(config.type).toBe(LeadType.NONE);
        expect(config.length).toBe(0);
        expect(config.flipSide).toBe(false);
        expect(config.angle).toBeUndefined();
    });

    it('should handle path with mixed defined/undefined lead-out properties', () => {
        const path = createTestPath({
            leadOutType: LeadType.LINE,
            leadOutLength: undefined,
            leadOutFlipSide: true,
            leadOutAngle: undefined,
        });

        const config = createLeadOutConfig(path);

        expect(config.type).toBe(LeadType.LINE);
        expect(config.length).toBe(0);
        expect(config.flipSide).toBe(true);
        expect(config.angle).toBeUndefined();
    });

    it('should handle different lead types', () => {
        const lineConfig = createLeadOutConfig(
            createTestPath({ leadOutType: LeadType.LINE })
        );
        expect(lineConfig.type).toBe(LeadType.LINE);

        const arcConfig = createLeadOutConfig(
            createTestPath({ leadOutType: LeadType.ARC })
        );
        expect(arcConfig.type).toBe(LeadType.ARC);

        const noneConfig = createLeadOutConfig(
            createTestPath({ leadOutType: LeadType.NONE })
        );
        expect(noneConfig.type).toBe(LeadType.NONE);
    });

    it('should handle zero and negative lengths', () => {
        const zeroConfig = createLeadOutConfig(
            createTestPath({ leadOutLength: 0 })
        );
        expect(zeroConfig.length).toBe(0);

        const negativeConfig = createLeadOutConfig(
            createTestPath({ leadOutLength: -3.5 })
        );
        expect(negativeConfig.length).toBe(-3.5);
    });

    it('should handle extreme angle values', () => {
        const config360 = createLeadOutConfig(
            createTestPath({ leadOutAngle: 360 })
        );
        expect(config360.angle).toBe(360);

        const configNegative = createLeadOutConfig(
            createTestPath({ leadOutAngle: -45 })
        );
        expect(configNegative.angle).toBe(-45);

        const configLarge = createLeadOutConfig(
            createTestPath({ leadOutAngle: 540 })
        );
        expect(configLarge.angle).toBe(540);
    });
});

describe('createLeadConfigs', () => {
    it('should create both lead-in and lead-out configs from path', () => {
        const path = createTestPath({
            leadInType: LeadType.LINE,
            leadInLength: 8,
            leadInFlipSide: true,
            leadInAngle: 90,
            leadOutType: LeadType.ARC,
            leadOutLength: 15,
            leadOutFlipSide: false,
            leadOutAngle: 270,
        });

        const configs = createLeadConfigs(path);

        // Check lead-in config
        expect(configs.leadIn.type).toBe(LeadType.LINE);
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
            leadInType: undefined,
            leadInLength: undefined,
            leadInFlipSide: undefined,
            leadInAngle: undefined,
            leadOutType: undefined,
            leadOutLength: undefined,
            leadOutFlipSide: undefined,
            leadOutAngle: undefined,
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
            leadInType: LeadType.ARC,
            leadInLength: 6,
            leadInFlipSide: false,
            leadInAngle: 180,
            leadOutType: undefined,
            leadOutLength: undefined,
            leadOutFlipSide: undefined,
            leadOutAngle: undefined,
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
            leadInType: undefined,
            leadInLength: undefined,
            leadInFlipSide: undefined,
            leadInAngle: undefined,
            leadOutType: LeadType.LINE,
            leadOutLength: 9.5,
            leadOutFlipSide: true,
            leadOutAngle: 45,
        });

        const configs = createLeadConfigs(path);

        // Check lead-in defaults
        expect(configs.leadIn.type).toBe(LeadType.NONE);
        expect(configs.leadIn.length).toBe(0);
        expect(configs.leadIn.flipSide).toBe(false);
        expect(configs.leadIn.angle).toBeUndefined();

        // Check lead-out config
        expect(configs.leadOut.type).toBe(LeadType.LINE);
        expect(configs.leadOut.length).toBe(9.5);
        expect(configs.leadOut.flipSide).toBe(true);
        expect(configs.leadOut.angle).toBe(45);
    });

    it('should produce same results as individual functions', () => {
        const path = createTestPath({
            leadInType: LeadType.LINE,
            leadInLength: 4.2,
            leadInFlipSide: true,
            leadInAngle: 315,
            leadOutType: LeadType.ARC,
            leadOutLength: 7.8,
            leadOutFlipSide: false,
            leadOutAngle: 225,
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
            { in: LeadType.LINE, out: LeadType.NONE },
            { in: LeadType.NONE, out: LeadType.LINE },
            { in: LeadType.ARC, out: LeadType.NONE },
            { in: LeadType.NONE, out: LeadType.ARC },
            { in: LeadType.LINE, out: LeadType.LINE },
            { in: LeadType.ARC, out: LeadType.ARC },
            { in: LeadType.LINE, out: LeadType.ARC },
            { in: LeadType.ARC, out: LeadType.LINE },
        ];

        testCases.forEach(({ in: inType, out: outType }) => {
            const path = createTestPath({
                leadInType: inType,
                leadOutType: outType,
            });

            const configs = createLeadConfigs(path);

            expect(configs.leadIn.type).toBe(inType);
            expect(configs.leadOut.type).toBe(outType);
        });
    });
});
