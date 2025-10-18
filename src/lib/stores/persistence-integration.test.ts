/**
 * Integration test for complete persistence system including lead geometry
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    restoreApplicationState,
    saveApplicationState,
} from '$lib/stores/storage/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { cutStore } from '$lib/stores/cuts/store';
import { operationsStore } from '$lib/stores/operations/store';
import { chainStore } from '$lib/stores/chains/store';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { GeometryType } from '$lib/geometry/shape/enums';
import type { CutsState } from '$lib/stores/cuts/interfaces';
import { Unit } from '$lib/config/units/units';
import type { Operation } from '$lib/stores/operations/interfaces';

// Mock localStorage
const localStorageMock = {
    data: {} as Record<string, string>,
    getItem: (key: string) => localStorageMock.data[key] || null,
    setItem: (key: string, value: string) => {
        localStorageMock.data[key] = value;
    },
    removeItem: (key: string) => {
        delete localStorageMock.data[key];
    },
    clear: () => {
        localStorageMock.data = {};
    },
};

// Replace global localStorage with mock
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock lead calculation to avoid dependencies
vi.mock('../algorithms/lead-calculation', () => ({
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
        warnings: [],
    })),
}));

describe('Persistence Integration - Lead Geometry', () => {
    beforeEach(() => {
        localStorageMock.clear();

        // Reset stores that support reset
        cutStore.reset();
        operationsStore.reset();
        // Note: chainStore doesn't have reset method, so we'll set chains manually in test
    });

    it('should persist and restore cuts with lead geometry', async () => {
        // Setup test data - create a drawing with chains
        const testDrawing = {
            id: 'test-drawing-1',
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.CIRCLE as GeometryType,
                    geometry: { center: { x: 50, y: 50 }, radius: 25 },
                    layer: 'default',
                },
            ],
            layers: {
                default: {
                    shapes: [],
                    name: 'default',
                    visible: true,
                    color: '#000000',
                },
            },
            units: Unit.MM,
            bounds: { min: { x: 25, y: 25 }, max: { x: 75, y: 75 } },
        };

        const testChain = {
            id: 'chain-1',
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.CIRCLE as GeometryType,
                    geometry: { center: { x: 50, y: 50 }, radius: 25 },
                },
            ],
        };

        // Set up the drawing and chains
        drawingStore.setDrawing(testDrawing, 'test.dxf');
        chainStore.setChains([testChain]);

        // Create operation that will generate cuts
        const testOperation: Omit<Operation, 'id'> = {
            name: 'Test Cut',
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
        };

        // Add the operation (this should generate cuts)
        operationsStore.addOperation(testOperation);

        // Wait for cut generation and lead calculation to complete
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify cuts were created
        let cutsState: CutsState | null = null;
        const unsubscribe = cutStore.subscribe((state) => {
            cutsState = state;
        });
        unsubscribe();
        expect(cutsState!.cuts.length).toBe(1);

        const createdCut = cutsState!.cuts[0];
        expect(createdCut.operationId).toBeDefined();
        expect(createdCut.chainId).toBe('chain-1');

        // Manually add lead geometry to simulate calculated leads
        cutStore.updateCutLeadGeometry(createdCut.id, {
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
        });

        // Get updated cut with lead geometry
        const unsubscribe2 = cutStore.subscribe((state) => {
            cutsState = state;
        });
        unsubscribe2();
        const cutWithLeads = cutsState!.cuts[0];

        // Verify lead geometry was added
        expect(cutWithLeads.leadIn).toBeDefined();
        expect(cutWithLeads.leadIn?.geometry).toBeDefined();
        expect(cutWithLeads.leadIn?.type).toBe(LeadType.ARC);
        expect(cutWithLeads.leadOut).toBeDefined();
        expect(cutWithLeads.leadOut?.geometry).toBeDefined();
        expect(cutWithLeads.leadOut?.type).toBe(LeadType.ARC);
        expect(cutWithLeads.leadValidation?.warnings).toContain('Test warning');

        // Save application state
        await saveApplicationState();

        // Clear stores to simulate fresh app load
        cutStore.reset();
        operationsStore.reset();

        // Verify stores are empty
        let emptyState: CutsState | null = null;
        const unsubscribe3 = cutStore.subscribe((state) => {
            emptyState = state;
        });
        unsubscribe3();
        expect(emptyState!.cuts).toHaveLength(0);

        // Restore application state
        await restoreApplicationState();

        // Verify that lead data was restored
        let restoredState: CutsState | null = null;
        const unsubscribe4 = cutStore.subscribe((state) => {
            restoredState = state;
        });
        unsubscribe4();
        expect(restoredState!.cuts).toHaveLength(1);

        const restoredCut = restoredState!.cuts[0];
        expect(restoredCut.operationId).toBe(cutWithLeads.operationId);
        expect(restoredCut.chainId).toBe('chain-1');

        // Most importantly - verify lead geometry was persisted and restored
        expect(restoredCut.leadIn).toBeDefined();
        expect(restoredCut.leadIn?.geometry).toEqual({
            center: { x: 2.5, y: 2.5 },
            radius: 3.54,
            startAngle: Math.PI / 4,
            endAngle: (5 * Math.PI) / 4,
            clockwise: false,
        });
        expect(restoredCut.leadIn?.type).toBe(LeadType.ARC);
        expect(restoredCut.leadIn?.version).toBe('1.0.0');
        expect(restoredCut.leadIn?.generatedAt).toBeDefined();

        expect(restoredCut.leadOut).toBeDefined();
        expect(restoredCut.leadOut?.geometry).toEqual({
            center: { x: 12.5, y: 12.5 },
            radius: 3.536,
            startAngle: 225,
            endAngle: 45,
            clockwise: false,
        });
        expect(restoredCut.leadOut?.type).toBe(LeadType.ARC);
        expect(restoredCut.leadOut?.version).toBe('1.0.0');
        expect(restoredCut.leadOut?.generatedAt).toBeDefined();

        expect(restoredCut.leadValidation).toBeDefined();
        expect(restoredCut.leadValidation?.isValid).toBe(true);
        expect(restoredCut.leadValidation?.warnings).toContain('Test warning');
        expect(restoredCut.leadValidation?.severity).toBe('warning');
        expect(restoredCut.leadValidation?.validatedAt).toBeDefined();
    }, 10000); // 10 second timeout for async operations
});
