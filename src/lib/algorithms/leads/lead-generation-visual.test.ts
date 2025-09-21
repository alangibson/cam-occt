import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, it } from 'vitest';
import { scaleShape } from '$lib/geometry/shape/functions';
import { calculateDynamicTolerance } from '$lib/geometry/bounding-box';
import { parseDXF } from '$lib/parsers/dxf/functions';
import { SVGBuilder } from '$lib/test/svg-builder';
import type { Shape } from '$lib/types/geometry';
import { Unit, getPhysicalScaleFactor } from '$lib/utils/units';
import type { Chain } from '$lib/geometry/chain/interfaces';
import { detectShapeChains } from '$lib/algorithms/chain-detection/chain-detection';
import { normalizeChain } from '$lib/algorithms/chain-normalization/chain-normalization';
import { optimizeStartPoints } from '$lib/algorithms/optimize-start-points/optimize-start-points';
import type { StartPointOptimizationParameters } from '$lib/types/algorithm-parameters';
import { detectParts } from '$lib/algorithms/part-detection/part-detection';
import type { DetectedPart } from '$lib/algorithms/part-detection/part-detection';
import type {
    Operation,
    PathGenerationResult,
} from '$lib/stores/operations/interfaces';
import { CutDirection, LeadType } from '$lib/types/direction';
import { KerfCompensation } from '$lib/types/kerf-compensation';
import { createPathsFromOperation } from '$lib/stores/operations/functions';
import type { Line } from '$lib/types';
import { isArc } from '$lib/geometry/arc';
import { isLine } from '$lib/geometry/line';
import { GeometryType } from '$lib/types/geometry';
import {
    getChainStartPoint,
    getChainEndPoint,
    getChainTangent,
} from '$lib/geometry/chain/functions';

// Test that loads DXF files, applies prepare stage fixes, adds operations with arc leads,
// and generates SVG outputs for both clockwise and counterclockwise cut directions
describe('Lead Generation Visual Test', () => {
    // Test data for each DXF file
    const testFiles = [
        'tests/dxf/2013-11-08_test.dxf',
        'tests/dxf/ADLER.dxf',
        'tests/dxf/polylines_with_bulge.dxf',
        'tests/dxf/chain-pill.dxf',
        'tests/dxf/1.dxf',
        'tests/dxf/2.dxf',
        'tests/dxf/3.dxf',
        'tests/dxf/Tractor Light Mount - Left.dxf',
        'tests/dxf/Tractor Seat Mount - Left.dxf',
    ];

    testFiles.forEach((dxfFile) => {
        describe(`${dxfFile}`, () => {
            let shapes: Shape[];
            let chains: Chain[];
            let parts: DetectedPart[];
            let outputDir: string;
            let tolerance: number;

            beforeAll(async () => {
                // Set up output directory
                outputDir = 'tests/output/visual/leads';
                mkdirSync(outputDir, { recursive: true });

                // Load and parse DXF file
                const dxfContent = readFileSync(dxfFile, 'utf-8');
                const drawing = await parseDXF(dxfContent);

                // Calculate physical scale factor for proper visual display (using mm as display unit)
                const physicalScale = getPhysicalScaleFactor(
                    drawing.units,
                    Unit.MM
                );

                // Scale shapes first
                shapes = drawing.shapes.map((shape) =>
                    scaleShape(shape, physicalScale, { x: 0, y: 0 })
                );

                // Calculate dynamic tolerance based on scaled drawing size
                tolerance = calculateDynamicTolerance(shapes, 0.1);

                // Apply only chain detection and part detection from Prepare stage:

                // 1. Detect chains on scaled coordinates
                const detectedChains = detectShapeChains(shapes, { tolerance });

                // 2. Normalize chains after detection
                const normalizedChains = detectedChains.map((chain) =>
                    normalizeChain(chain)
                );

                // 3. Optimize start points for cutting
                const startPointParams: StartPointOptimizationParameters = {
                    splitPosition: 'midpoint',
                    tolerance: tolerance,
                };
                const optimizedShapes = optimizeStartPoints(
                    normalizedChains,
                    startPointParams
                );

                // 4. Rebuild chains from optimized shapes
                const optimizedDetectedChains = detectShapeChains(
                    optimizedShapes,
                    { tolerance }
                );
                chains = optimizedDetectedChains.map((chain) =>
                    normalizeChain(chain)
                );

                // 5. Detect parts (shells with holes)
                const partDetectionResult = await detectParts(chains);
                parts = partDetectionResult.parts;
            });

            it(
                'should generate SVG outputs for both clockwise and counterclockwise cut directions',
                { timeout: 30000 },
                async () => {
                    // Create mock tools array
                    const tools = [
                        {
                            id: 'plasma-tool',
                            toolNumber: 1,
                            toolName: 'Plasma Cutter',
                            feedRate: 1000,
                            rapidRate: 5000,
                            pierceHeight: 5.0,
                            cutHeight: 1.5,
                            pierceDelay: 1.0,
                            arcVoltage: 120,
                            kerfWidth: 0.5,
                            thcEnable: true,
                            gasPressure: 5.0,
                            pauseAtEnd: 0,
                            puddleJumpHeight: 0,
                            puddleJumpDelay: 0,
                            plungeRate: 500,
                        },
                    ];

                    // Determine target type based on available data
                    const hasValidParts =
                        parts &&
                        parts.length > 0 &&
                        parts.some(
                            (part) =>
                                part.shell && part.shell.chain.shapes.length > 0
                        );
                    const targetType = hasValidParts ? 'parts' : 'chains';
                    const targetIds = hasValidParts
                        ? parts.map((part) => part.id)
                        : chains.map((chain) => chain.id);

                    // Process all targets (either all parts or all chains)
                    const allClockwisePaths = [];
                    const allCounterclockwisePaths = [];

                    for (const targetId of targetIds) {
                        // Create operation with disabled offsets and enabled arc leads
                        const baseOperation: Omit<Operation, 'id'> = {
                            name: 'Arc Lead Test',
                            toolId: 'plasma-tool',
                            targetType: targetType,
                            targetIds: [targetId],
                            enabled: true,
                            order: 1,
                            cutDirection: CutDirection.CLOCKWISE,
                            leadInConfig: {
                                type: LeadType.ARC,
                                length: 20.0,
                                flipSide: false,
                                fit: false,
                            },
                            leadOutConfig: {
                                type: LeadType.ARC,
                                length: 20.0,
                                flipSide: false,
                                fit: false,
                            },
                            kerfCompensation: KerfCompensation.NONE,
                            holeUnderspeedEnabled: false,
                        };

                        // Test clockwise cut direction
                        const clockwiseOperation: Operation = {
                            ...baseOperation,
                            id: `clockwise-op-${targetId}`,
                            cutDirection: CutDirection.CLOCKWISE,
                        };

                        const clockwiseResult: PathGenerationResult =
                            await createPathsFromOperation(
                                clockwiseOperation,
                                chains,
                                parts,
                                tools
                            );

                        allClockwisePaths.push(...clockwiseResult.paths);

                        // Test counterclockwise cut direction
                        const counterclockwiseOperation: Operation = {
                            ...baseOperation,
                            id: `counterclockwise-op-${targetId}`,
                            cutDirection: CutDirection.COUNTERCLOCKWISE,
                        };

                        const counterclockwiseResult: PathGenerationResult =
                            await createPathsFromOperation(
                                counterclockwiseOperation,
                                chains,
                                parts,
                                tools
                            );

                        allCounterclockwisePaths.push(
                            ...counterclockwiseResult.paths
                        );
                    }

                    // Generate SVG for clockwise cut direction
                    const clockwiseSvg = new SVGBuilder();
                    clockwiseSvg.addLegend([
                        { color: 'black', label: 'Original Shapes' },
                        { color: 'green', label: 'Cut Paths' },
                        { color: 'blue', label: 'Lead In' },
                        { color: 'red', label: 'Lead Out' },
                        { color: 'purple', label: 'Start Tangent' },
                        { color: 'orange', label: 'End Tangent' },
                    ]);

                    // Add original shapes
                    shapes.forEach((shape) => {
                        clockwiseSvg.addShape(shape, 'black', 1.0);
                    });

                    // Add paths and leads for clockwise
                    allClockwisePaths.forEach((path) => {
                        // Add the main path using cutChain
                        if (path.cutChain && path.cutChain.shapes.length > 0) {
                            path.cutChain.shapes.forEach((shape) => {
                                clockwiseSvg.addShape(shape, 'green', 1.5);
                            });
                        }

                        // Add connection points at chain start/end
                        if (path.cutChain && path.cutChain.shapes.length > 0) {
                            // Find the actual chain this path represents in our chains array
                            const matchingChain = chains.find(
                                (c) => c.id === path.cutChain?.id
                            );
                            if (matchingChain) {
                                console.log(
                                    `Chain ${matchingChain.id}: ${matchingChain.shapes.length} shapes`
                                );
                                matchingChain.shapes.forEach((shape, i) => {
                                    console.log(
                                        `  Shape ${i}: type=${shape.type}, id=${shape.id}`
                                    );
                                });

                                // Add start point (lead-in connection)
                                const startPoint =
                                    getChainStartPoint(matchingChain);
                                console.log(
                                    `Start point for ${matchingChain.id}:`,
                                    startPoint
                                );

                                // Add end point (lead-out connection)
                                const endPoint =
                                    getChainEndPoint(matchingChain);
                                console.log(
                                    `End point for ${matchingChain.id}:`,
                                    endPoint
                                );
                            }
                        }

                        // Add lead geometry from path properties
                        if (path.leadIn) {
                            // Render lead-in geometry directly as arc or line
                            const leadInGeometry = path.leadIn.geometry;
                            if (isArc(leadInGeometry)) {
                                // Create shape wrapper for arc
                                clockwiseSvg.addShape(
                                    {
                                        id: `lead-in-${path.id}`,
                                        type: GeometryType.ARC,
                                        geometry: leadInGeometry,
                                    },
                                    'blue',
                                    2.0
                                );
                            } else if (isLine(leadInGeometry)) {
                                // Use addLine directly for line geometry
                                clockwiseSvg.addLine(
                                    leadInGeometry,
                                    'blue',
                                    2.0
                                );
                            }
                        }
                        if (path.leadOut) {
                            // Render lead-out geometry directly as arc or line
                            const leadOutGeometry = path.leadOut.geometry;
                            if (isArc(leadOutGeometry)) {
                                // Create shape wrapper for arc
                                clockwiseSvg.addShape(
                                    {
                                        id: `lead-out-${path.id}`,
                                        type: GeometryType.ARC,
                                        geometry: leadOutGeometry,
                                    },
                                    'red',
                                    2.0
                                );
                            } else if (isLine(leadOutGeometry)) {
                                // Use addLine directly for line geometry
                                clockwiseSvg.addLine(
                                    leadOutGeometry,
                                    'red',
                                    2.0
                                );
                            }
                        }

                        // Add tangent visualization for debugging - use cutChain directly
                        if (path.cutChain && path.cutChain.shapes.length > 0) {
                            const chainToUse = path.cutChain;
                            // Show tangent at start point (lead-in connection)
                            const startPoint = getChainStartPoint(chainToUse);
                            if (startPoint) {
                                const startTangent = getChainTangent(
                                    chainToUse,
                                    startPoint,
                                    true
                                );
                                const tangentLength = 30; // Length of tangent line for visualization
                                const tangentEnd = {
                                    x:
                                        startPoint.x +
                                        startTangent.x * tangentLength,
                                    y:
                                        startPoint.y +
                                        startTangent.y * tangentLength,
                                };
                                const tangentLine: Line = {
                                    start: startPoint,
                                    end: tangentEnd,
                                };
                                clockwiseSvg.addLine(
                                    tangentLine,
                                    'purple',
                                    2.0
                                );
                            }

                            // Show tangent at end point (lead-out connection)
                            const endPoint = getChainEndPoint(chainToUse);
                            if (endPoint) {
                                const endTangent = getChainTangent(
                                    chainToUse,
                                    endPoint,
                                    false
                                );
                                const tangentLength = 30; // Length of tangent line for visualization
                                const tangentEnd = {
                                    x:
                                        endPoint.x +
                                        endTangent.x * tangentLength,
                                    y:
                                        endPoint.y +
                                        endTangent.y * tangentLength,
                                };
                                const tangentLine: Line = {
                                    start: endPoint,
                                    end: tangentEnd,
                                };
                                clockwiseSvg.addLine(
                                    tangentLine,
                                    'orange',
                                    2.0
                                );
                            }
                        }
                    });

                    clockwiseSvg.addTitle(
                        'Clockwise Cut Direction with Arc Leads'
                    );

                    // Generate SVG for counterclockwise cut direction
                    const counterclockwiseSvg = new SVGBuilder();
                    counterclockwiseSvg.addLegend([
                        { color: 'black', label: 'Original Shapes' },
                        { color: 'green', label: 'Cut Paths' },
                        { color: 'blue', label: 'Lead In' },
                        { color: 'red', label: 'Lead Out' },
                        { color: 'purple', label: 'Start Tangent' },
                        { color: 'orange', label: 'End Tangent' },
                    ]);

                    // Add original shapes
                    shapes.forEach((shape) => {
                        counterclockwiseSvg.addShape(shape, 'black', 1.0);
                    });

                    // Add paths and leads for counterclockwise
                    allCounterclockwisePaths.forEach((path) => {
                        // Add the main path using cutChain
                        if (path.cutChain && path.cutChain.shapes.length > 0) {
                            path.cutChain.shapes.forEach((shape) => {
                                counterclockwiseSvg.addShape(
                                    shape,
                                    'green',
                                    1.5
                                );
                            });
                        }

                        // Add lead geometry from path properties
                        if (path.leadIn) {
                            // Render lead-in geometry directly as arc or line
                            const leadInGeometry = path.leadIn.geometry;
                            if (isArc(leadInGeometry)) {
                                // Create shape wrapper for arc
                                counterclockwiseSvg.addShape(
                                    {
                                        id: `lead-in-${path.id}`,
                                        type: GeometryType.ARC,
                                        geometry: leadInGeometry,
                                    },
                                    'blue',
                                    2.0
                                );
                            } else if (isLine(leadInGeometry)) {
                                // Use addLine directly for line geometry
                                counterclockwiseSvg.addLine(
                                    leadInGeometry as Line,
                                    'blue',
                                    2.0
                                );
                            }
                        }
                        if (path.leadOut) {
                            // Render lead-out geometry directly as arc or line
                            const leadOutGeometry = path.leadOut.geometry;
                            if (isArc(leadOutGeometry)) {
                                // Create shape wrapper for arc
                                counterclockwiseSvg.addShape(
                                    {
                                        id: `lead-out-${path.id}`,
                                        type: GeometryType.ARC,
                                        geometry: leadOutGeometry,
                                    },
                                    'red',
                                    2.0
                                );
                            } else if (isLine(leadOutGeometry)) {
                                // Use addLine directly for line geometry
                                counterclockwiseSvg.addLine(
                                    leadOutGeometry as Line,
                                    'red',
                                    2.0
                                );
                            }
                        }

                        // Add tangent visualization for debugging - use cutChain directly
                        if (path.cutChain && path.cutChain.shapes.length > 0) {
                            console.log(
                                `[CCW] Processing cutChain with id: ${path.cutChain.id}`
                            );
                            // Use the cutChain directly instead of searching for matching chain
                            const chainToUse = path.cutChain;
                            console.log(
                                `[CCW] Using cutChain with ${chainToUse.shapes.length} shapes`
                            );
                            // Show tangent at start point (lead-in connection)
                            const startPoint = getChainStartPoint(chainToUse);
                            console.log(`[CCW] Start point:`, startPoint);
                            console.log(
                                `[CCW] First shape type:`,
                                chainToUse.shapes[0]?.type
                            );
                            console.log(
                                `[CCW] First shape geometry:`,
                                chainToUse.shapes[0]?.geometry
                            );
                            if (startPoint) {
                                const startTangent = getChainTangent(
                                    chainToUse,
                                    startPoint,
                                    true
                                );
                                console.log(
                                    `[CCW] Start tangent:`,
                                    startTangent
                                );
                                const tangentLength = 30; // Length of tangent line for visualization
                                const tangentEnd = {
                                    x:
                                        startPoint.x +
                                        startTangent.x * tangentLength,
                                    y:
                                        startPoint.y +
                                        startTangent.y * tangentLength,
                                };
                                const tangentLine: Line = {
                                    start: startPoint,
                                    end: tangentEnd,
                                };
                                console.log(
                                    `[CCW] Adding tangent line:`,
                                    tangentLine
                                );
                                counterclockwiseSvg.addLine(
                                    tangentLine,
                                    'purple',
                                    2.0
                                );
                            }

                            // Show tangent at end point (lead-out connection)
                            const endPoint = getChainEndPoint(chainToUse);
                            if (endPoint) {
                                const endTangent = getChainTangent(
                                    chainToUse,
                                    endPoint,
                                    false
                                );
                                const tangentLength = 30; // Length of tangent line for visualization
                                const tangentEnd = {
                                    x:
                                        endPoint.x +
                                        endTangent.x * tangentLength,
                                    y:
                                        endPoint.y +
                                        endTangent.y * tangentLength,
                                };
                                const tangentLine: Line = {
                                    start: endPoint,
                                    end: tangentEnd,
                                };
                                counterclockwiseSvg.addLine(
                                    tangentLine,
                                    'orange',
                                    2.0
                                );
                            }
                        }
                    });

                    counterclockwiseSvg.addTitle(
                        'Counterclockwise Cut Direction with Arc Leads'
                    );

                    // Write SVG files to tests/output/visual/leads/ with file-specific names
                    const fileName =
                        dxfFile.split('/').pop()?.replace('.dxf', '') || 'test';
                    const clockwiseFilename = join(
                        outputDir,
                        `${fileName}-clockwise-arc-leads.svg`
                    );
                    const counterclockwiseFilename = join(
                        outputDir,
                        `${fileName}-counterclockwise-arc-leads.svg`
                    );

                    writeFileSync(clockwiseFilename, clockwiseSvg.toString());
                    writeFileSync(
                        counterclockwiseFilename,
                        counterclockwiseSvg.toString()
                    );
                }
            );
        });
    });
});
