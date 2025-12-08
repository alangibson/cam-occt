import { describe, expect, it } from 'vitest';
import type { Line } from '$lib/geometry/line/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { translateToPositiveQuadrant } from './translate-to-positive';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Unit } from '$lib/config/units/units';
import { Operation } from '$lib/cam/operation/classes.svelte';
import { OperationAction, KerfCompensation } from '$lib/cam/operation/enums';
import { CutDirection, OptimizeStarts } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { createCutsFromOperation } from '$lib/cam/pipeline/operations/cut-generation';
import type { Tool } from '$lib/cam/tool/interfaces';

describe('Translate to Positive - Cut Positioning', () => {
    it('should generate cuts at translated positions after preprocessing', async () => {
        // Create a simple closed rectangle at negative coordinates
        const shapes: ShapeData[] = [
            {
                id: 'line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: -10 },
                    end: { x: -10, y: 10 },
                } as Line,
            },
            {
                id: 'line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: 10 },
                    end: { x: 10, y: 10 },
                } as Line,
            },
            {
                id: 'line3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: 10 },
                    end: { x: 10, y: -10 },
                } as Line,
            },
            {
                id: 'line4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 10, y: -10 },
                    end: { x: -10, y: -10 },
                } as Line,
            },
        ];

        const drawing = new Drawing({
            shapes: shapes,
            units: Unit.MM,
            fileName: 'test.dxf',
        });

        // Apply translate to positive (simulating preprocessing)
        translateToPositiveQuadrant(drawing);

        // Verify shapes were translated
        const translatedShapes = drawing.shapes;
        expect(translatedShapes).toHaveLength(4);
        const line1 = translatedShapes[0].geometry as Line;
        expect(line1.start).toEqual({ x: 0, y: 0 }); // -10 + 10 = 0

        // Get the chains from the drawing (via layers)
        const layers = Object.values(drawing.layers);
        expect(layers.length).toBeGreaterThan(0);

        const layer = layers[0];
        const chains = layer.chains;
        expect(chains.length).toBeGreaterThan(0);

        // Verify chains also have translated coordinates
        const chain = chains[0];
        const chainShapes = chain.shapes;
        expect(chainShapes.length).toBeGreaterThan(0);
        const chainLine1 = chainShapes[0].geometry as Line;
        expect(chainLine1.start).toEqual({ x: 0, y: 0 }); // Should match translated shape

        // Create a tool
        const tool: Tool = {
            id: 'tool1',
            toolNumber: 1,
            toolName: 'Test Tool',
            feedRate: 100,
            pierceHeight: 3,
            cutHeight: 1.5,
            pierceDelay: 1,
            arcVoltage: 120,
            kerfWidth: 2,
            thcEnable: true,
            gasPressure: 5,
            pauseAtEnd: 0,
            puddleJumpHeight: 5,
            puddleJumpDelay: 0,
            plungeRate: 200,
        };

        // Create an operation targeting the chain
        const operation = new Operation({
            id: 'op1',
            name: 'Test Operation',
            enabled: true,
            order: 1,
            action: OperationAction.CUT,
            targetType: 'chains',
            targetIds: [chain.id],
            cutDirection: CutDirection.CLOCKWISE,
            optimizeStarts: OptimizeStarts.NONE,
            leadInConfig: { type: LeadType.NONE, length: 0 },
            leadOutConfig: { type: LeadType.NONE, length: 0 },
            kerfCompensation: KerfCompensation.NONE,
            toolId: tool.id,
            holeUnderspeedEnabled: false,
            holeUnderspeedPercent: 75,
        });

        // Set the tool and targets on the operation
        operation.setTool(tool);
        operation.setTargets([chain]);

        // Generate cuts
        const result = await createCutsFromOperation(operation, 0.05);

        expect(result.cuts).toHaveLength(1);
        const cut = result.cuts[0];

        // Verify cut chain has translated coordinates (not original negative coordinates)
        expect(cut.chain).toBeDefined();
        const cutChain = cut.chain!;
        const cutShapes = cutChain.shapes;
        expect(cutShapes.length).toBeGreaterThan(0);

        const cutLine = cutShapes[0].geometry as Line;
        // The cut should be at translated position (0,0), NOT at original position (-10,-10)
        expect(cutLine.start.x).toBeGreaterThanOrEqual(0); // Should be in positive quadrant
        expect(cutLine.start.y).toBeGreaterThanOrEqual(0);
    });

    it('should keep all cuts at translated positions after multiple operations', async () => {
        // Create two separate rectangles at different negative coordinates
        const shapes: ShapeData[] = [
            // Rectangle 1 at (-20, -20) to (-10, -10)
            {
                id: 'rect1-line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -20, y: -20 },
                    end: { x: -20, y: -10 },
                } as Line,
            },
            {
                id: 'rect1-line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -20, y: -10 },
                    end: { x: -10, y: -10 },
                } as Line,
            },
            {
                id: 'rect1-line3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: -10 },
                    end: { x: -10, y: -20 },
                } as Line,
            },
            {
                id: 'rect1-line4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -10, y: -20 },
                    end: { x: -20, y: -20 },
                } as Line,
            },
            // Rectangle 2 at (-5, -5) to (5, 5)
            {
                id: 'rect2-line1',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -5, y: -5 },
                    end: { x: -5, y: 5 },
                } as Line,
            },
            {
                id: 'rect2-line2',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: -5, y: 5 },
                    end: { x: 5, y: 5 },
                } as Line,
            },
            {
                id: 'rect2-line3',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 5, y: 5 },
                    end: { x: 5, y: -5 },
                } as Line,
            },
            {
                id: 'rect2-line4',
                type: GeometryType.LINE,
                geometry: {
                    start: { x: 5, y: -5 },
                    end: { x: -5, y: -5 },
                } as Line,
            },
        ];

        const drawing = new Drawing({
            shapes: shapes,
            units: Unit.MM,
            fileName: 'test.dxf',
        });

        // Apply translate to positive
        translateToPositiveQuadrant(drawing);

        // Get chains from drawing
        const layers = Object.values(drawing.layers);
        const layer = layers[0];
        const chains = layer.chains;
        expect(chains.length).toBeGreaterThanOrEqual(2);

        // Create a tool
        const tool: Tool = {
            id: 'tool1',
            toolNumber: 1,
            toolName: 'Test Tool',
            feedRate: 100,
            pierceHeight: 3,
            cutHeight: 1.5,
            pierceDelay: 1,
            arcVoltage: 120,
            kerfWidth: 2,
            thcEnable: true,
            gasPressure: 5,
            pauseAtEnd: 0,
            puddleJumpHeight: 5,
            puddleJumpDelay: 0,
            plungeRate: 200,
        };

        // Generate cuts for all chains
        const allCuts = [];
        for (let i = 0; i < chains.length; i++) {
            const chain = chains[i];
            const operation = new Operation({
                id: `op${i}`,
                name: `Test Operation ${i}`,
                enabled: true,
                order: i + 1,
                action: OperationAction.CUT,
                targetType: 'chains',
                targetIds: [chain.id],
                cutDirection: CutDirection.CLOCKWISE,
                optimizeStarts: OptimizeStarts.NONE,
                leadInConfig: { type: LeadType.NONE, length: 0 },
                leadOutConfig: { type: LeadType.NONE, length: 0 },
                kerfCompensation: KerfCompensation.NONE,
                toolId: tool.id,
                holeUnderspeedEnabled: false,
                holeUnderspeedPercent: 75,
            });

            operation.setTool(tool);
            operation.setTargets([chain]);

            const result = await createCutsFromOperation(operation, 0.05);
            allCuts.push(...result.cuts);
        }

        // Verify ALL cuts are in positive quadrant
        expect(allCuts.length).toBeGreaterThanOrEqual(2);

        for (const cut of allCuts) {
            expect(cut.chain).toBeDefined();
            const cutShapes = cut.chain!.shapes;

            for (const shape of cutShapes) {
                const geometry = shape.geometry as Line;
                // All coordinates should be >= 0 (positive quadrant)
                expect(geometry.start.x).toBeGreaterThanOrEqual(0);
                expect(geometry.start.y).toBeGreaterThanOrEqual(0);
                expect(geometry.end.x).toBeGreaterThanOrEqual(0);
                expect(geometry.end.y).toBeGreaterThanOrEqual(0);
            }
        }
    });
});
