/**
 * Integration test for complete persistence system including lead geometry
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    restoreApplicationState,
    saveApplicationState,
} from '$lib/stores/storage/store';
import { drawingStore } from '$lib/stores/drawing/store';
import { pathStore } from '$lib/stores/paths/store';
import { operationsStore } from '$lib/stores/operations/store';
import { chainStore } from '$lib/stores/chains/store';
import { CutDirection, LeadType } from '$lib/types/direction';
import { GeometryType } from '$lib/types/geometry';
import type { PathsState } from '$lib/stores/paths/interfaces';
import { Unit } from './units';
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
        warnings: [],
    })),
}));

describe('Persistence Integration - Lead Geometry', () => {
    beforeEach(() => {
        localStorageMock.clear();

        // Reset stores that support reset
        pathStore.reset();
        operationsStore.reset();
        // Note: chainStore doesn't have reset method, so we'll set chains manually in test
    });

    it('should persist and restore paths with lead geometry', async () => {
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

        // Create operation that will generate paths
        const testOperation: Omit<Operation, 'id'> = {
            name: 'Test Cut',
            toolId: 'tool-1',
            targetType: 'chains',
            targetIds: ['chain-1'],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInType: LeadType.ARC,
            leadInLength: 5,
            leadInFlipSide: false,
            leadInAngle: 45,
            leadInFit: false,
            leadOutType: LeadType.LINE,
            leadOutLength: 3,
            leadOutFlipSide: false,
            leadOutAngle: 90,
            leadOutFit: false,
        };

        // Add the operation (this should generate paths)
        operationsStore.addOperation(testOperation);

        // Wait for path generation and lead calculation to complete
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify paths were created
        let pathsState: PathsState | null = null;
        const unsubscribe = pathStore.subscribe((state) => {
            pathsState = state;
        });
        unsubscribe();
        expect(pathsState!.paths.length).toBe(1);

        const createdPath = pathsState!.paths[0];
        expect(createdPath.operationId).toBeDefined();
        expect(createdPath.chainId).toBe('chain-1');

        // Manually add lead geometry to simulate calculated leads
        pathStore.updatePathLeadGeometry(createdPath.id, {
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
        });

        // Get updated path with lead geometry
        const unsubscribe2 = pathStore.subscribe((state) => {
            pathsState = state;
        });
        unsubscribe2();
        const pathWithLeads = pathsState!.paths[0];

        // Verify lead geometry was added
        expect(pathWithLeads.calculatedLeadIn).toBeDefined();
        expect(pathWithLeads.calculatedLeadIn?.points).toHaveLength(2);
        expect(pathWithLeads.calculatedLeadIn?.type).toBe(LeadType.ARC);
        expect(pathWithLeads.calculatedLeadOut).toBeDefined();
        expect(pathWithLeads.calculatedLeadOut?.points).toHaveLength(2);
        expect(pathWithLeads.calculatedLeadOut?.type).toBe(LeadType.LINE);
        expect(pathWithLeads.leadValidation?.warnings).toContain(
            'Test warning'
        );

        // Save application state
        await saveApplicationState();

        // Clear stores to simulate fresh app load
        pathStore.reset();
        operationsStore.reset();

        // Verify stores are empty
        let emptyState: PathsState | null = null;
        const unsubscribe3 = pathStore.subscribe((state) => {
            emptyState = state;
        });
        unsubscribe3();
        expect(emptyState!.paths).toHaveLength(0);

        // Restore application state
        await restoreApplicationState();

        // Verify that lead data was restored
        let restoredState: PathsState | null = null;
        const unsubscribe4 = pathStore.subscribe((state) => {
            restoredState = state;
        });
        unsubscribe4();
        expect(restoredState!.paths).toHaveLength(1);

        const restoredPath = restoredState!.paths[0];
        expect(restoredPath.operationId).toBe(pathWithLeads.operationId);
        expect(restoredPath.chainId).toBe('chain-1');

        // Most importantly - verify lead geometry was persisted and restored
        expect(restoredPath.calculatedLeadIn).toBeDefined();
        expect(restoredPath.calculatedLeadIn?.points).toEqual([
            { x: 0, y: 0 },
            { x: 5, y: 5 },
        ]);
        expect(restoredPath.calculatedLeadIn?.type).toBe(LeadType.ARC);
        expect(restoredPath.calculatedLeadIn?.version).toBe('1.0.0');
        expect(restoredPath.calculatedLeadIn?.generatedAt).toBeDefined();

        expect(restoredPath.calculatedLeadOut).toBeDefined();
        expect(restoredPath.calculatedLeadOut?.points).toEqual([
            { x: 10, y: 10 },
            { x: 15, y: 15 },
        ]);
        expect(restoredPath.calculatedLeadOut?.type).toBe(LeadType.LINE);
        expect(restoredPath.calculatedLeadOut?.version).toBe('1.0.0');
        expect(restoredPath.calculatedLeadOut?.generatedAt).toBeDefined();

        expect(restoredPath.leadValidation).toBeDefined();
        expect(restoredPath.leadValidation?.isValid).toBe(true);
        expect(restoredPath.leadValidation?.warnings).toContain('Test warning');
        expect(restoredPath.leadValidation?.severity).toBe('warning');
        expect(restoredPath.leadValidation?.validatedAt).toBeDefined();
    }, 10000); // 10 second timeout for async operations
});
