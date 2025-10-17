import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { parseDXF } from '$lib/parsers/dxf';
import {
    detectShapeChains,
    setChainsDirection,
} from '$lib/geometry/chain/chain-detection';
import { detectParts } from '$lib/cam/part/part-detection';
import { drawingStore } from '$lib/stores/drawing/store';
import { chainStore } from '$lib/stores/chains/store';
import { partStore } from '$lib/stores/parts/store';
import { cutStore } from '$lib/stores/cuts/store';
import { operationsStore } from '$lib/stores/operations/store';
import { toolStore } from '$lib/stores/tools/store';
import { settingsStore } from '$lib/stores/settings/store';
import { OffsetImplementation } from '$lib/stores/settings/interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import type { Shape } from '$lib/types';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Spline Rendering Race Condition', () => {
    beforeEach(() => {
        // Reset stores that support it
        cutStore.reset();
        operationsStore.reset();
        toolStore.reset();
        // Set to Exact implementation to preserve splines
        settingsStore.setOffsetImplementation(OffsetImplementation.Exact);
    });

    it('should render all offset shapes including splines for single operation', async () => {
        // Load YOUCANMOVEMOUNTAINS.dxf
        const dxfPath = join(
            process.cwd(),
            'tests/dxf/YOUCANMOVEMOUNTAINS.dxf'
        );
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const drawing = await parseDXF(dxfContent);
        drawingStore.setDrawing(drawing);

        // Detect chains
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.01 });
        const chainsWithDirection = setChainsDirection(chains);
        chainStore.setChains(chainsWithDirection);

        // Detect parts
        const partDetectionResult = await detectParts(chainsWithDirection);
        partStore.setParts(partDetectionResult.parts);

        // Find the O parts (should be 3 of them based on the file name)
        const oParts = partDetectionResult.parts.filter((part) => {
            // O parts will have specific characteristics - we need to identify them
            // For this test, we'll take the first part with holes
            return part.holes.length > 0;
        });

        expect(oParts.length).toBeGreaterThan(0);

        // Create a tool and get its actual ID
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Plasma',
            feedRate: 100,
            pierceHeight: 3.8,
            cutHeight: 1.5,
            pierceDelay: 0.5,
            arcVoltage: 120,
            kerfWidth: 2,
            thcEnable: true,
            gasPressure: 4.5,
            pauseAtEnd: 0,
            puddleJumpHeight: 50,
            puddleJumpDelay: 0,
            plungeRate: 500,
        });
        const toolsAfter = get(toolStore);
        const addedTool = toolsAfter[toolsAfter.length - 1];
        const toolId = addedTool.id;

        // Create operation for first O part
        const firstOPart = oParts[0];
        operationsStore.addOperation({
            name: 'Cut First O',
            toolId: toolId,
            targetType: 'parts',
            targetIds: [firstOPart.id],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.PART,
        });

        // Wait for async cut generation to complete
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Get the generated cuts
        const cutsState = get(cutStore);
        const generatedCuts = cutsState.cuts;

        expect(generatedCuts.length).toBeGreaterThan(0);

        // Check each cut has offset shapes
        for (const cut of generatedCuts) {
            expect(
                cut.offset,
                `Cut ${cut.name} should have offset`
            ).toBeDefined();
            expect(
                cut.offset?.offsetShapes,
                `Cut ${cut.name} should have offset shapes`
            ).toBeDefined();
            expect(
                cut.offset?.offsetShapes.length,
                `Cut ${cut.name} should have at least one offset shape`
            ).toBeGreaterThan(0);

            // Log shape types to help debug
            const shapeTypes = cut.offset?.offsetShapes
                .map((s) => s.type)
                .join(', ');
            console.log(`Cut ${cut.name} has offset shapes: ${shapeTypes}`);
        }

        // Specifically check for spline or polyline shapes (splines may be converted to polylines by offset)
        const allOffsetShapes: Shape[] = generatedCuts
            .filter((cut) => cut.offset?.offsetShapes)
            .flatMap((cut) => cut.offset!.offsetShapes);

        const hasSplineOrPolyline = allOffsetShapes.some(
            (shape) => shape.type === 'spline' || shape.type === 'polyline'
        );

        expect(
            hasSplineOrPolyline,
            'Should have spline or polyline offset shapes'
        ).toBe(true);

        // Verify all offset shapes are present
        const offsetShapeCount = allOffsetShapes.length;
        console.log(
            `Successfully verified ${offsetShapeCount} offset shapes including splines`
        );
    });

    it('should preserve all offset shapes when adding second operation', async () => {
        // Load YOUCANMOVEMOUNTAINS.dxf
        const dxfPath = join(
            process.cwd(),
            'tests/dxf/YOUCANMOVEMOUNTAINS.dxf'
        );
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const drawing = await parseDXF(dxfContent);
        drawingStore.setDrawing(drawing);

        // Detect chains and parts
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.01 });
        const chainsWithDirection = setChainsDirection(chains);
        chainStore.setChains(chainsWithDirection);
        const partDetectionResult = await detectParts(chainsWithDirection);
        partStore.setParts(partDetectionResult.parts);

        const oParts = partDetectionResult.parts.filter(
            (part) => part.holes.length > 0
        );
        expect(oParts.length).toBeGreaterThanOrEqual(2);

        // Create tool and get its actual ID
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Plasma',
            feedRate: 100,
            pierceHeight: 3.8,
            cutHeight: 1.5,
            pierceDelay: 0.5,
            arcVoltage: 120,
            kerfWidth: 2,
            thcEnable: true,
            gasPressure: 4.5,
            pauseAtEnd: 0,
            puddleJumpHeight: 50,
            puddleJumpDelay: 0,
            plungeRate: 500,
        });
        const tools = get(toolStore);
        const toolId = tools[tools.length - 1].id;

        // Create first operation
        operationsStore.addOperation({
            name: 'Cut First O',
            toolId: toolId,
            targetType: 'parts',
            targetIds: [oParts[0].id],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.PART,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Capture first operation's cuts and offset shapes
        const firstCutsState = get(cutStore);
        const firstCuts = [...firstCutsState.cuts];
        const firstOffsetShapes: Map<string, Shape[]> = new Map();

        for (const cut of firstCuts) {
            if (cut.offset?.offsetShapes) {
                firstOffsetShapes.set(cut.id, [...cut.offset.offsetShapes]);
            }
        }

        expect(firstCuts.length).toBeGreaterThan(0);
        console.log(`First operation created ${firstCuts.length} cuts`);

        // Create second operation
        operationsStore.addOperation({
            name: 'Cut Second O',
            toolId: toolId,
            targetType: 'parts',
            targetIds: [oParts[1].id],
            enabled: true,
            order: 2,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.PART,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Get updated cuts
        const secondCutsState = get(cutStore);
        const allCuts = secondCutsState.cuts;

        console.log(`After second operation: ${allCuts.length} total cuts`);

        // Verify first operation's cuts still exist and have ALL their offset shapes
        for (const [
            cutId,
            originalOffsetShapes,
        ] of firstOffsetShapes.entries()) {
            const currentCut = allCuts.find((c) => c.id === cutId);

            expect(
                currentCut,
                `Cut ${cutId} from first operation should still exist`
            ).toBeDefined();
            expect(
                currentCut?.offset?.offsetShapes,
                `Cut ${cutId} should still have offset shapes`
            ).toBeDefined();

            const currentOffsetShapes = currentCut?.offset?.offsetShapes || [];

            // Check same number of offset shapes
            expect(
                currentOffsetShapes.length,
                `Cut ${cutId} should have same number of offset shapes (original: ${originalOffsetShapes.length}, current: ${currentOffsetShapes.length})`
            ).toBe(originalOffsetShapes.length);

            // Check shape types match
            const originalTypes = originalOffsetShapes
                .map((s) => s.type)
                .sort()
                .join(',');
            const currentTypes = currentOffsetShapes
                .map((s) => s.type)
                .sort()
                .join(',');

            expect(
                currentTypes,
                `Cut ${cutId} offset shape types should match (original: ${originalTypes}, current: ${currentTypes})`
            ).toBe(originalTypes);
        }

        // Verify second operation also has offset shapes with splines/polylines
        const secondOpCuts = allCuts.filter((c) => c.name.includes('Second O'));
        expect(secondOpCuts.length).toBeGreaterThan(0);

        for (const cut of secondOpCuts) {
            expect(cut.offset?.offsetShapes.length).toBeGreaterThan(0);
        }
    });

    it('should render all offset shapes from multiple operations simultaneously', async () => {
        // Load file and setup
        const dxfPath = join(
            process.cwd(),
            'tests/dxf/YOUCANMOVEMOUNTAINS.dxf'
        );
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const drawing = await parseDXF(dxfContent);
        drawingStore.setDrawing(drawing);

        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.01 });
        const chainsWithDirection = setChainsDirection(chains);
        chainStore.setChains(chainsWithDirection);
        const partDetectionResult = await detectParts(chainsWithDirection);
        partStore.setParts(partDetectionResult.parts);

        const oParts = partDetectionResult.parts.filter(
            (part) => part.holes.length > 0
        );
        expect(oParts.length).toBeGreaterThanOrEqual(2);

        // Create tool and get its actual ID
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Plasma',
            feedRate: 100,
            pierceHeight: 3.8,
            cutHeight: 1.5,
            pierceDelay: 0.5,
            arcVoltage: 120,
            kerfWidth: 2,
            thcEnable: true,
            gasPressure: 4.5,
            pauseAtEnd: 0,
            puddleJumpHeight: 50,
            puddleJumpDelay: 0,
            plungeRate: 500,
        });
        const tools = get(toolStore);
        const toolId = tools[tools.length - 1].id;

        // Add both operations
        operationsStore.addOperation({
            name: 'Cut First O',
            toolId: toolId,
            targetType: 'parts',
            targetIds: [oParts[0].id],
            enabled: true,
            order: 1,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.PART,
        });

        operationsStore.addOperation({
            name: 'Cut Second O',
            toolId: toolId,
            targetType: 'parts',
            targetIds: [oParts[1].id],
            enabled: true,
            order: 2,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            leadOutConfig: {
                type: LeadType.ARC,
                length: 2,
                flipSide: false,
                angle: 0,
                fit: false,
            },
            kerfCompensation: KerfCompensation.PART,
        });

        await new Promise((resolve) => setTimeout(resolve, 150));

        // Get all cuts
        const cutsState = get(cutStore);
        const allCuts = cutsState.cuts;

        // Collect all offset shapes from all cuts
        const allOffsetShapes: Array<{ cutName: string; shape: Shape }> = [];

        for (const cut of allCuts) {
            if (cut.offset?.offsetShapes) {
                for (const shape of cut.offset.offsetShapes) {
                    allOffsetShapes.push({ cutName: cut.name, shape });
                }
            }
        }

        console.log(
            `Total offset shapes across all cuts: ${allOffsetShapes.length}`
        );

        // Group by type
        const shapesByType = allOffsetShapes.reduce(
            (acc, { cutName, shape }) => {
                if (!acc[shape.type]) acc[shape.type] = [];
                acc[shape.type].push(cutName);
                return acc;
            },
            {} as Record<string, string[]>
        );

        console.log(
            'Shapes by type:',
            Object.entries(shapesByType)
                .map(([type, cuts]) => `${type}: ${cuts.length}`)
                .join(', ')
        );

        // Verify we have offset shapes
        expect(
            allOffsetShapes.length,
            'Should have offset shapes from both operations'
        ).toBeGreaterThan(0);

        // Verify we have splines
        const splineCount = allOffsetShapes.filter(
            ({ shape }) => shape.type === 'spline'
        ).length;
        const polylineCount = allOffsetShapes.filter(
            ({ shape }) => shape.type === 'polyline'
        ).length;

        expect(
            splineCount + polylineCount,
            'Should have spline or polyline shapes'
        ).toBeGreaterThan(0);

        console.log(
            `Successfully verified ${allOffsetShapes.length} offset shapes (${splineCount} splines, ${polylineCount} polylines) from ${allCuts.length} cuts`
        );
    });
});
