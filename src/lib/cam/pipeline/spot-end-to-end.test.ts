/**
 * End-to-end integration test for spot operations
 * Tests the complete pipeline: Operation → Cut → CutPath → G-code
 */
import { describe, expect, it } from 'vitest';
import { generateSpotsForChainsWithOperation } from './operations/spot-operations';
import { generateCutsForChainsWithOperation } from './operations/chain-operations';
import { cutToToolPath, cutsToToolPaths } from '$lib/cam/gcode/cut-to-toolpath';
import { generateGCode } from '$lib/cam/gcode/gcode-generator';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { Tool } from '$lib/cam/tool/interfaces';
import type { OperationData } from '$lib/cam/operation/interface';
import { Operation } from '$lib/cam/operation/classes.svelte';
import { GeometryType } from '$lib/geometry/enums';
import { OperationAction } from '$lib/cam/operation/enums';
import { CutDirection } from '$lib/cam/cut/enums';
import { LeadType } from '$lib/cam/lead/enums';
import { CutterCompensation } from '$lib/cam/gcode/enums';
import { Unit } from '$lib/config/units/units';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import { Drawing } from '$lib/cam/drawing/classes.svelte';
import { Shape } from '$lib/cam/shape/classes';

describe('Spot Operation End-to-End Integration', () => {
    const mockChain: ChainData = {
        id: 'chain-1',
        name: 'chain-1',
        clockwise: true,
        shapes: [
            {
                id: 'shape-1',
                type: GeometryType.CIRCLE,
                layer: 'layer-1',
                geometry: { center: { x: 100, y: 100 }, radius: 50 },
            } as any,
        ],
    };

    const mockTool: Tool = {
        id: 'tool-1',
        toolNumber: 1,
        toolName: 'Spot Tool',
        kerfWidth: 0,
        feedRate: 1000,
        pierceHeight: 3.8,
        pierceDelay: 0.5,
        cutHeight: 1.5,
        arcVoltage: 120,
        kerfWidthMetric: 0,
        kerfWidthImperial: 0,
    } as any;

    const mockDrawing: DrawingData = {
        shapes: [],
        units: Unit.MM,
        fileName: 'test.dxf',
    };

    it('should generate spot G-code from Operation with action=SPOT (complete pipeline)', async () => {
        // 1. Create Operation with action=SPOT
        const spotOperationData: OperationData = {
            id: 'op-1',
            name: 'Test Spot Operation',
            action: OperationAction.SPOT, // This is the key field!
            enabled: true,
            toolId: 'tool-1',
            targetType: 'chains',
            targetIds: ['chain-1'],
            order: 0,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: { type: LeadType.NONE, length: 0 },
            leadOutConfig: { type: LeadType.NONE, length: 0 },
            spotDuration: 150, // 150ms spot duration
        };

        const operation = new Operation(spotOperationData);
        operation.setTool(mockTool);
        operation.setTargets([mockChain]);

        // 2. Generate Cut from Operation
        const { cuts } = await generateSpotsForChainsWithOperation(
            operation,
            0
        );

        expect(cuts).toHaveLength(1);
        const cut = cuts[0];

        // Verify Cut has action field
        expect(cut.action).toBe(OperationAction.SPOT);
        expect(cut.spotDuration).toBe(150);

        // 3. Convert Cut to CutPath (toolpath)
        const cutPath = await cutToToolPath(
            cut,
            mockChain.shapes.map((s) => new Shape(s)),
            [mockTool],
            CutterCompensation.NONE
        );

        // Verify CutPath parameters have action field
        expect(cutPath.parameters?.action).toBe(OperationAction.SPOT);
        expect(cutPath.parameters?.spotDuration).toBe(150);

        // 4. Generate G-code from CutPath
        const gcode = generateGCode([cutPath], new Drawing(mockDrawing), {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        // 5. Verify G-code contains spot commands (M3 $2, M5 $2)
        expect(gcode).toContain('M3 $2');
        expect(gcode).toContain('M5 $2');
        expect(gcode).toContain('G91'); // Relative mode
        expect(gcode).toContain('G1 X0.000001'); // Minimal movement
        expect(gcode).toContain('G90'); // Absolute mode

        // 6. Verify G-code does NOT contain cut commands
        expect(gcode).not.toContain('M3 $0');
        expect(gcode).not.toContain('M5 $0');
        expect(gcode).not.toContain('G4 P'); // No pierce delay
    });

    it('should generate cut G-code from Operation with action=CUT (for comparison)', async () => {
        // 1. Create Operation with action=CUT
        const cutOperationData: OperationData = {
            id: 'op-2',
            name: 'Test Cut Operation',
            action: OperationAction.CUT, // CUT action
            enabled: true,
            toolId: 'tool-1',
            targetType: 'chains',
            targetIds: ['chain-1'],
            order: 0,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: { type: LeadType.NONE, length: 0 },
            leadOutConfig: { type: LeadType.NONE, length: 0 },
        };

        const operation = new Operation(cutOperationData);
        operation.setTool(mockTool);
        operation.setTargets([mockChain]);

        // 2. Generate Cut from Operation
        const { cuts } = await generateCutsForChainsWithOperation(
            operation,
            0,
            0.01
        );

        expect(cuts).toHaveLength(1);
        const cut = cuts[0];

        // Verify Cut has action field (should be CUT or undefined, defaulting to CUT behavior)
        expect(cut.action).toBe(OperationAction.CUT);

        // 3. Convert Cut to CutPath
        const cutPath = await cutToToolPath(
            cut,
            mockChain.shapes.map((s) => new Shape(s)),
            [mockTool],
            CutterCompensation.NONE
        );

        // Verify CutPath parameters have action field
        expect(cutPath.parameters?.action).toBe(OperationAction.CUT);

        // 4. Generate G-code from CutPath
        const gcode = generateGCode([cutPath], new Drawing(mockDrawing), {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        // 5. Verify G-code contains cut commands (M3 $0, M5 $0)
        expect(gcode).toContain('M3 $0');
        expect(gcode).toContain('M5 $0');

        // 6. Verify G-code does NOT contain spot commands
        expect(gcode).not.toContain('M3 $2');
        expect(gcode).not.toContain('M5 $2');
    });

    it('should show the exact user scenario: Operation → G-code', async () => {
        // This test simulates EXACTLY what the user described:
        // "When I create an Operation with action == spot, I don't get the spot gcode generated"

        // Create operation with action = 'spot'
        const userOperation: OperationData = {
            id: 'user-op',
            name: 'User Spot',
            action: OperationAction.SPOT, // User sets action to SPOT
            enabled: true,
            toolId: 'tool-1',
            targetType: 'chains',
            targetIds: ['chain-1'],
            order: 0,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: { type: LeadType.NONE, length: 0 },
            leadOutConfig: { type: LeadType.NONE, length: 0 },
            spotDuration: 100,
        };

        const op = new Operation(userOperation);
        op.setTool(mockTool);
        op.setTargets([mockChain]);

        // Generate cut
        const result = await generateSpotsForChainsWithOperation(op, 0);
        const cut = result.cuts[0];

        // Convert to toolpath
        const toolpath = await cutToToolPath(
            cut,
            mockChain.shapes.map((s) => new Shape(s)),
            [mockTool],
            CutterCompensation.NONE
        );

        // Generate G-code
        const gcode = generateGCode([toolpath], new Drawing(mockDrawing), {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        // What user expects to see:
        // - M3 $2 S1 (spotting on)
        // - G91 (relative distance mode)
        // - G1 X0.000001
        // - G90 (absolute distance mode)
        // - M5 $2 (spotting off)

        // Verify user gets what they expect
        expect(gcode).toContain('M3 $2'); // spotting on
        expect(gcode).toContain('G91'); // relative mode
        expect(gcode).toContain('G1 X0.000001'); // minimal movement
        expect(gcode).toContain('G90'); // absolute mode
        expect(gcode).toContain('M5 $2'); // spotting off

        // What user should NOT see (cut commands):
        expect(gcode).not.toContain('M3 $0'); // NOT plasma torch
        expect(gcode).not.toContain('M5 $0'); // NOT plasma off
        expect(gcode).not.toContain('G4 P'); // NOT pierce delay

        console.log('\n=== GENERATED SPOT G-CODE ===');
        console.log(gcode);
        console.log('=== END G-CODE ===\n');
    });

    it('should generate correct G-code for multiple spots with rapids between them', async () => {
        // Create two separate chains for two spot operations
        const chain1: ChainData = {
            id: 'chain-1',
            name: 'chain-1',
            clockwise: true,
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.CIRCLE,
                    layer: 'layer-1',
                    geometry: { center: { x: 100, y: 100 }, radius: 50 },
                } as any,
            ],
        };

        const chain2: ChainData = {
            id: 'chain-2',
            name: 'chain-2',
            clockwise: true,
            shapes: [
                {
                    id: 'shape-2',
                    type: GeometryType.CIRCLE,
                    layer: 'layer-1',
                    geometry: { center: { x: 200, y: 100 }, radius: 50 },
                } as any,
            ],
        };

        // Create operation targeting both chains
        const spotOperationData: OperationData = {
            id: 'op-1',
            name: 'Multi Spot Operation',
            action: OperationAction.SPOT,
            enabled: true,
            toolId: 'tool-1',
            targetType: 'chains',
            targetIds: ['chain-1', 'chain-2'],
            order: 0,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: { type: LeadType.NONE, length: 0 },
            leadOutConfig: { type: LeadType.NONE, length: 0 },
            spotDuration: 150,
        };

        const operation = new Operation(spotOperationData);
        operation.setTool(mockTool);
        operation.setTargets([chain1, chain2]);

        // Generate cuts for both chains
        const result1 = await generateSpotsForChainsWithOperation(operation, 0);
        const result2 = await generateSpotsForChainsWithOperation(operation, 1);

        expect(result1.cuts).toHaveLength(1);
        expect(result2.cuts).toHaveLength(1);

        // Convert to toolpaths
        const toolpath1 = await cutToToolPath(
            result1.cuts[0],
            chain1.shapes.map((s) => new Shape(s)),
            [mockTool],
            CutterCompensation.NONE
        );

        const toolpath2 = await cutToToolPath(
            result2.cuts[0],
            chain2.shapes.map((s) => new Shape(s)),
            [mockTool],
            CutterCompensation.NONE
        );

        // Generate G-code with both toolpaths (this adds rapids between them)
        const gcode = generateGCode(
            [toolpath1, toolpath2],
            new Drawing(mockDrawing),
            {
                units: Unit.MM,
                safeZ: 10,
                rapidFeedRate: 5000,
                includeComments: true,
                cutterCompensation: CutterCompensation.NONE,
            }
        );

        // Split into lines for analysis
        const lines = gcode.split('\n').filter((line) => line.trim());

        // Find spot 1 and spot 2 sections
        const spot1Index = lines.findIndex((line) => line.includes('Spot 1'));
        const spot2Index = lines.findIndex((line) => line.includes('Spot 2'));

        expect(spot1Index).toBeGreaterThan(-1);
        expect(spot2Index).toBeGreaterThan(-1);

        // Extract lines between spots (should be rapids only)
        const betweenSpots = lines.slice(spot1Index, spot2Index);

        // Verify no cutting commands between spots
        betweenSpots.forEach((line) => {
            // Should NOT contain cutting moves or plasma torch commands
            expect(line).not.toMatch(/G1.*X.*Y/); // No G1 cutting moves with X/Y
            expect(line).not.toContain('M3 $0'); // No plasma on
            expect(line).not.toContain('M5 $0'); // No plasma off
            expect(line).not.toContain('G4 P'); // No pierce delay
        });

        // Verify spots themselves have correct commands
        expect(gcode).toContain('M3 $2'); // Spotting tool on (appears twice)
        expect(gcode).toContain('M5 $2'); // Spotting tool off (appears twice)

        console.log('\n=== MULTI-SPOT G-CODE ===');
        console.log(gcode);
        console.log('=== END G-CODE ===\n');
    });

    it('should generate rapids between spots using cutsToToolPaths pipeline', async () => {
        // Create two separate chains
        const chain1: ChainData = {
            id: 'layer1-chain-1',
            name: 'layer1-chain-1',
            clockwise: true,
            shapes: [
                {
                    id: 'shape-1',
                    type: GeometryType.CIRCLE,
                    layer: 'layer-1',
                    geometry: { center: { x: -151.1691, y: 90 }, radius: 25 },
                } as any,
            ],
        };

        const chain2: ChainData = {
            id: 'layer1-chain-2',
            name: 'layer1-chain-2',
            clockwise: true,
            shapes: [
                {
                    id: 'shape-2',
                    type: GeometryType.CIRCLE,
                    layer: 'layer-1',
                    geometry: { center: { x: -196.1691, y: 90 }, radius: 25 },
                } as any,
            ],
        };

        // Create operation
        const spotOperationData: OperationData = {
            id: 'op-1',
            name: 'Spot Op',
            action: OperationAction.SPOT,
            enabled: true,
            toolId: 'tool-1',
            targetType: 'chains',
            targetIds: ['layer1-chain-1', 'layer1-chain-2'],
            order: 0,
            cutDirection: CutDirection.CLOCKWISE,
            leadInConfig: { type: LeadType.NONE, length: 0 },
            leadOutConfig: { type: LeadType.NONE, length: 0 },
            spotDuration: 150,
        };

        const operation = new Operation(spotOperationData);
        operation.setTool(mockTool);
        operation.setTargets([chain1, chain2]);

        // Generate cuts
        const result1 = await generateSpotsForChainsWithOperation(operation, 0);
        const result2 = await generateSpotsForChainsWithOperation(operation, 1);

        const cuts = [result1.cuts[0], result2.cuts[0]];

        // Create chain shapes map
        const chainShapes = new Map([
            ['layer1-chain-1', chain1.shapes.map((s) => new Shape(s))],
            ['layer1-chain-2', chain2.shapes.map((s) => new Shape(s))],
        ]);

        // Use cutsToToolPaths to convert cuts (this adds rapids!)
        const toolpaths = await cutsToToolPaths(
            cuts,
            chainShapes,
            [mockTool],
            CutterCompensation.NONE,
            undefined,
            undefined,
            Unit.MM
        );

        // Should have 2 spots + 1 rapid between them
        expect(toolpaths.length).toBe(3);
        expect(toolpaths[0].isRapid).toBe(false); // Spot 1
        expect(toolpaths[1].isRapid).toBe(true); // Rapid between spots
        expect(toolpaths[2].isRapid).toBe(false); // Spot 2

        // Generate G-code
        const gcode = generateGCode(toolpaths, new Drawing(mockDrawing), {
            units: Unit.MM,
            safeZ: 10,
            rapidFeedRate: 5000,
            includeComments: true,
            cutterCompensation: CutterCompensation.NONE,
        });

        const lines = gcode.split('\n');

        // Find the rapid section (between first retract and second spot)
        const spot1End = lines.findIndex((line) =>
            line.includes('Spotting tool off')
        );
        const spot2Start = lines.findIndex(
            (line, idx) =>
                idx > spot1End &&
                (line.includes('Spot 2') || line.includes('Spot'))
        );

        expect(spot1End).toBeGreaterThan(-1);
        expect(spot2Start).toBeGreaterThan(-1);

        // Extract rapid section
        const rapidSection = lines.slice(spot1End + 1, spot2Start);

        // Verify rapid section has ONLY G0 moves and feed rate commands, no cutting or torch commands
        rapidSection.forEach((line) => {
            const trimmed = line.trim();
            if (
                !trimmed ||
                trimmed.startsWith('(') ||
                trimmed.startsWith('F')
            ) {
                return; // Skip empty lines, comments, and feed rate commands
            }

            // Should only have G0 commands
            expect(trimmed).toMatch(/^G0/);

            // Should NOT have cutting moves or torch commands
            expect(trimmed).not.toContain('G1');
            expect(trimmed).not.toContain('M3');
            expect(trimmed).not.toContain('M5');
            expect(trimmed).not.toContain('G4');
        });
    });
});
