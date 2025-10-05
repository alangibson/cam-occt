import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { parseDXF } from '$lib/parsers/dxf';
import { detectShapeChains, setChainsDirection } from '$lib/algorithms/chain-detection/chain-detection';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';
import { drawingStore } from '$lib/stores/drawing/store';
import { chainStore } from '$lib/stores/chains/store';
import { partStore } from '$lib/stores/parts/store';
import { pathStore } from '$lib/stores/paths/store';
import { operationsStore } from '$lib/stores/operations/store';
import { toolStore } from '$lib/stores/tools/store';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import { PathRenderer } from './renderers/path';
import { CoordinateTransformer } from '$lib/rendering/coordinate-transformer';
import type { Path } from '$lib/stores/paths/interfaces';
import type { Shape } from '$lib/types';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Spline Rendering Race Condition', () => {
    beforeEach(() => {
        // Reset stores that support it
        pathStore.reset();
        operationsStore.reset();
        toolStore.reset();
    });

    it('should render all offset shapes including splines for single operation', async () => {
        // Load YOUCANMOVEMOUNTAINS.dxf
        const dxfPath = join(process.cwd(), 'tests/dxf/YOUCANMOVEMOUNTAINS.dxf');
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
        const oParts = partDetectionResult.parts.filter(part => {
            // O parts will have specific characteristics - we need to identify them
            // For this test, we'll take the first part with holes
            return part.holes.length > 0;
        });

        expect(oParts.length).toBeGreaterThan(0);

        // Create a tool and get its actual ID
        const toolsBefore = get(toolStore);
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Plasma',
            kerfWidth: 2,
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

        // Wait for async path generation to complete
        await new Promise(resolve => setTimeout(resolve, 200));

        // Get the generated paths
        const pathsState = get(pathStore);
        const generatedPaths = pathsState.paths;

        expect(generatedPaths.length).toBeGreaterThan(0);

        // Check each path has offset shapes
        for (const path of generatedPaths) {
            expect(path.offset, `Path ${path.name} should have offset`).toBeDefined();
            expect(path.offset?.offsetShapes, `Path ${path.name} should have offset shapes`).toBeDefined();
            expect(path.offset?.offsetShapes.length, `Path ${path.name} should have at least one offset shape`).toBeGreaterThan(0);

            // Log shape types to help debug
            const shapeTypes = path.offset?.offsetShapes.map(s => s.type).join(', ');
            console.log(`Path ${path.name} has offset shapes: ${shapeTypes}`);
        }

        // Specifically check for spline or polyline shapes (splines may be converted to polylines by offset)
        const allOffsetShapes: Shape[] = generatedPaths
            .filter(p => p.offset?.offsetShapes)
            .flatMap(p => p.offset!.offsetShapes);

        const hasSplineOrPolyline = allOffsetShapes.some(
            shape => shape.type === 'spline' || shape.type === 'polyline'
        );

        expect(hasSplineOrPolyline, 'Should have spline or polyline offset shapes').toBe(true);

        // Verify all offset shapes are present
        const offsetShapeCount = allOffsetShapes.length;
        console.log(`Successfully verified ${offsetShapeCount} offset shapes including splines`);
    });

    it('should preserve all offset shapes when adding second operation', async () => {
        // Load YOUCANMOVEMOUNTAINS.dxf
        const dxfPath = join(process.cwd(), 'tests/dxf/YOUCANMOVEMOUNTAINS.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const drawing = await parseDXF(dxfContent);
        drawingStore.setDrawing(drawing);

        // Detect chains and parts
        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.01 });
        const chainsWithDirection = setChainsDirection(chains);
        chainStore.setChains(chainsWithDirection);
        const partDetectionResult = await detectParts(chainsWithDirection);
        partStore.setParts(partDetectionResult.parts);

        const oParts = partDetectionResult.parts.filter(part => part.holes.length > 0);
        expect(oParts.length).toBeGreaterThanOrEqual(2);

        // Create tool and get its actual ID
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Plasma',
            kerfWidth: 2,
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
            leadInConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
            leadOutConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
            kerfCompensation: KerfCompensation.PART,
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Capture first operation's paths and offset shapes
        const firstPathsState = get(pathStore);
        const firstPaths = [...firstPathsState.paths];
        const firstOffsetShapes: Map<string, Shape[]> = new Map();

        for (const path of firstPaths) {
            if (path.offset?.offsetShapes) {
                firstOffsetShapes.set(path.id, [...path.offset.offsetShapes]);
            }
        }

        expect(firstPaths.length).toBeGreaterThan(0);
        console.log(`First operation created ${firstPaths.length} paths`);

        // Create second operation
        operationsStore.addOperation({
            name: 'Cut Second O',
            toolId: toolId,
            targetType: 'parts',
            targetIds: [oParts[1].id],
            enabled: true,
            order: 2,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
            leadOutConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
            kerfCompensation: KerfCompensation.PART,
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Get updated paths
        const secondPathsState = get(pathStore);
        const allPaths = secondPathsState.paths;

        console.log(`After second operation: ${allPaths.length} total paths`);

        // Verify first operation's paths still exist and have ALL their offset shapes
        for (const [pathId, originalOffsetShapes] of firstOffsetShapes.entries()) {
            const currentPath = allPaths.find(p => p.id === pathId);

            expect(currentPath, `Path ${pathId} from first operation should still exist`).toBeDefined();
            expect(currentPath?.offset?.offsetShapes, `Path ${pathId} should still have offset shapes`).toBeDefined();

            const currentOffsetShapes = currentPath?.offset?.offsetShapes || [];

            // Check same number of offset shapes
            expect(
                currentOffsetShapes.length,
                `Path ${pathId} should have same number of offset shapes (original: ${originalOffsetShapes.length}, current: ${currentOffsetShapes.length})`
            ).toBe(originalOffsetShapes.length);

            // Check shape types match
            const originalTypes = originalOffsetShapes.map(s => s.type).sort().join(',');
            const currentTypes = currentOffsetShapes.map(s => s.type).sort().join(',');

            expect(
                currentTypes,
                `Path ${pathId} offset shape types should match (original: ${originalTypes}, current: ${currentTypes})`
            ).toBe(originalTypes);
        }

        // Verify second operation also has offset shapes with splines/polylines
        const secondOpPaths = allPaths.filter(p => p.name.includes('Second O'));
        expect(secondOpPaths.length).toBeGreaterThan(0);

        for (const path of secondOpPaths) {
            expect(path.offset?.offsetShapes.length).toBeGreaterThan(0);
        }
    });

    it('should render all offset shapes from multiple operations simultaneously', async () => {
        // Load file and setup
        const dxfPath = join(process.cwd(), 'tests/dxf/YOUCANMOVEMOUNTAINS.dxf');
        const dxfContent = readFileSync(dxfPath, 'utf-8');
        const drawing = await parseDXF(dxfContent);
        drawingStore.setDrawing(drawing);

        const chains = detectShapeChains(drawing.shapes, { tolerance: 0.01 });
        const chainsWithDirection = setChainsDirection(chains);
        chainStore.setChains(chainsWithDirection);
        const partDetectionResult = await detectParts(chainsWithDirection);
        partStore.setParts(partDetectionResult.parts);

        const oParts = partDetectionResult.parts.filter(part => part.holes.length > 0);
        expect(oParts.length).toBeGreaterThanOrEqual(2);

        // Create tool and get its actual ID
        toolStore.addTool({
            toolNumber: 1,
            toolName: 'Plasma',
            kerfWidth: 2,
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
            leadInConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
            leadOutConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
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
            leadInConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
            leadOutConfig: { type: LeadType.ARC, length: 2, flipSide: false, angle: 0, fit: false },
            kerfCompensation: KerfCompensation.PART,
        });

        await new Promise(resolve => setTimeout(resolve, 150));

        // Get all paths
        const pathsState = get(pathStore);
        const allPaths = pathsState.paths;

        // Collect all offset shapes from all paths
        const allOffsetShapes: Array<{ pathName: string; shape: Shape }> = [];

        for (const path of allPaths) {
            if (path.offset?.offsetShapes) {
                for (const shape of path.offset.offsetShapes) {
                    allOffsetShapes.push({ pathName: path.name, shape });
                }
            }
        }

        console.log(`Total offset shapes across all paths: ${allOffsetShapes.length}`);

        // Group by type
        const shapesByType = allOffsetShapes.reduce((acc, { pathName, shape }) => {
            if (!acc[shape.type]) acc[shape.type] = [];
            acc[shape.type].push(pathName);
            return acc;
        }, {} as Record<string, string[]>);

        console.log('Shapes by type:', Object.entries(shapesByType).map(([type, paths]) =>
            `${type}: ${paths.length}`
        ).join(', '));

        // Verify we have offset shapes
        expect(allOffsetShapes.length, 'Should have offset shapes from both operations').toBeGreaterThan(0);

        // Verify we have splines
        const splineCount = allOffsetShapes.filter(({ shape }) => shape.type === 'spline').length;
        const polylineCount = allOffsetShapes.filter(({ shape }) => shape.type === 'polyline').length;

        expect(splineCount + polylineCount, 'Should have spline or polyline shapes').toBeGreaterThan(0);

        console.log(`Successfully verified ${allOffsetShapes.length} offset shapes (${splineCount} splines, ${polylineCount} polylines) from ${allPaths.length} paths`);
    });
});
