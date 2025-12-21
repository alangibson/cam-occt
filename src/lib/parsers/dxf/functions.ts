import { parseString } from 'dxf';
import type { DXFBlock, DXFEntity, DXFParsed } from 'dxf';
import { Unit } from '$lib/config/units/units';
import type { DrawingData } from '$lib/cam/drawing/interfaces';
import type { ShapeData } from '$lib/cam/shape/interfaces';
import { Shape } from '$lib/cam/shape/classes';
import type { Ellipse } from '$lib/geometry/ellipse/interfaces';
import type { DxfPolylineVertex } from '$lib/geometry/dxf-polyline/interfaces';
import type { Spline } from '$lib/geometry/spline/interfaces';
import { GeometryType } from '$lib/geometry/enums';
import { generateId } from '$lib/domain/id';
import { generateSegments } from '$lib/geometry/dxf-polyline/functions';
import { normalizeSplineWeights } from '$lib/geometry/spline/functions';
import {
    FULL_CIRCLE_RADIANS,
    HALF_CIRCLE_DEG,
} from '$lib/geometry/circle/constants';
import { MIN_VERTICES_FOR_LINE } from '$lib/geometry/line/constants';
import { transformShape, scaleShape } from '$lib/cam/shape/functions';
import {
    DEFAULT_ELLIPSE_START_PARAM,
    DXF_INSUNITS_INCHES,
    DXF_INSUNITS_FEET,
    DXF_INSUNITS_MILLIMETERS,
    DXF_INSUNITS_CENTIMETERS,
    DXF_INSUNITS_METERS,
    CENTIMETERS_TO_MILLIMETERS,
    METERS_TO_MILLIMETERS,
    FEET_TO_INCHES,
} from './constants';
import {
    DEFAULT_SPLINE_DEGREE,
    MIN_CONTROL_POINTS_FOR_SPLINE,
} from '$lib/geometry/spline/constants';
import { MIN_VERTICES_FOR_POLYLINE } from '$lib/geometry/dxf-polyline/constants';

function convertEllipseEntity(entity: DXFEntity): ShapeData | null {
    // Handle ELLIPSE entities
    // DXF ellipse format:
    // 10, 20, 30: Center point (x, y, z)
    // 11, 21, 31: Major axis endpoint vector (x, y, z)
    // 40: Ratio of minor axis to major axis
    // 41: Start parameter (for ellipse arcs) - optional
    // 42: End parameter (for ellipse arcs) - optional

    if (
        typeof entity.x === 'number' &&
        typeof entity.y === 'number' &&
        typeof entity.majorX === 'number' &&
        typeof entity.majorY === 'number' &&
        typeof entity.axisRatio === 'number'
    ) {
        const ellipse: Ellipse = {
            center: { x: entity.x, y: entity.y },
            majorAxisEndpoint: {
                x: entity.majorX,
                y: entity.majorY,
            },
            minorToMajorRatio: entity.axisRatio,
            startParam: DEFAULT_ELLIPSE_START_PARAM,
            endParam: FULL_CIRCLE_RADIANS,
        };

        // Add start and end parameters if they exist (ellipse arcs)
        // Note: DXF uses startAngle/endAngle but we use startParam/endParam internally
        if (typeof entity.startAngle === 'number') {
            ellipse.startParam = entity.startAngle;
        }
        if (typeof entity.endAngle === 'number') {
            ellipse.endParam = entity.endAngle;
        }

        return {
            id: generateId(),
            type: GeometryType.ELLIPSE,
            geometry: ellipse,
            layer: entity.layer,
        };
    }
    return null;
}

function convertPolylineEntity(entity: DXFEntity): ShapeData | null {
    if (
        entity.vertices &&
        Array.isArray(entity.vertices) &&
        entity.vertices.length > 0
    ) {
        // Filter and map vertices to preserve bulge data
        const vertices: DxfPolylineVertex[] = entity.vertices
            .filter(
                (v: { x?: number | null; y?: number | null }) =>
                    v &&
                    typeof v.x === 'number' &&
                    typeof v.y === 'number' &&
                    v.x !== null &&
                    v.y !== null &&
                    isFinite(v.x) &&
                    isFinite(v.y)
            )
            .map((v: { x: number; y: number; bulge?: number }) => ({
                x: v.x,
                y: v.y,
                bulge: v.bulge || 0,
            }));

        // Need at least 2 vertices to create a valid polyline
        if (vertices.length >= MIN_VERTICES_FOR_POLYLINE) {
            const isClosed: boolean = entity.shape || entity.closed || false;

            // Generate shapes using the utility function
            const shapes: ShapeData[] = generateSegments(vertices, isClosed);

            // Only create polyline if we have valid segments
            if (shapes.length > 0) {
                return {
                    id: generateId(),
                    type: GeometryType.POLYLINE,
                    geometry: {
                        closed: isClosed,
                        shapes,
                    },
                    layer: entity.layer,
                };
            }
        }
    }
    return null;
}

function convertSplineEntity(entity: DXFEntity): ShapeData | null {
    // SPLINE entities are NURBS curves
    if (
        entity.controlPoints &&
        Array.isArray(entity.controlPoints) &&
        entity.controlPoints.length >= MIN_CONTROL_POINTS_FOR_SPLINE
    ) {
        const splineGeometry: Spline = {
            controlPoints: entity.controlPoints.map(
                (p: { x: number; y: number }) => ({
                    x: p.x,
                    y: p.y,
                })
            ),
            knots: entity.knots || [],
            weights: entity.weights || [],
            degree: entity.degree || DEFAULT_SPLINE_DEGREE,
            fitPoints: entity.fitPoints
                ? entity.fitPoints.map((p: { x: number; y: number }) => ({
                      x: p.x,
                      y: p.y,
                  }))
                : [],
            closed: entity.closed || false,
        };

        // Normalize spline weights to prevent NaN values during offset calculations
        const normalizedGeometry = normalizeSplineWeights(splineGeometry);

        return {
            id: generateId(),
            type: GeometryType.SPLINE,
            geometry: normalizedGeometry,
            layer: entity.layer,
        };
    }
    return null;
}

function convertArcEntity(entity: DXFEntity): ShapeData | null {
    // ARC entities have x, y, r properties (not center/radius)
    if (
        typeof entity.x === 'number' &&
        typeof entity.y === 'number' &&
        typeof entity.r === 'number' &&
        typeof entity.startAngle === 'number' &&
        typeof entity.endAngle === 'number'
    ) {
        return {
            id: generateId(),
            type: GeometryType.ARC,
            geometry: {
                center: { x: entity.x, y: entity.y },
                radius: entity.r,
                startAngle: entity.startAngle, // Already in radians from DXF library
                endAngle: entity.endAngle, // Already in radians from DXF library
                clockwise: false,
            },
            layer: entity.layer,
        };
    }
    return null;
}

function convertCircleEntity(entity: DXFEntity): ShapeData | null {
    // CIRCLE entities have x, y, r properties (similar to ARCs)
    if (
        typeof entity.x === 'number' &&
        typeof entity.y === 'number' &&
        typeof entity.r === 'number'
    ) {
        return {
            id: generateId(),
            type: GeometryType.CIRCLE,
            geometry: {
                center: { x: entity.x, y: entity.y },
                radius: entity.r,
            },
            layer: entity.layer,
        };
    }
    return null;
}

function convertLineEntity(entity: DXFEntity): ShapeData | null {
    // Handle LINE entities - can have vertices array or direct start/end points
    if (entity.vertices && entity.vertices.length >= MIN_VERTICES_FOR_LINE) {
        return {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: {
                    x: entity.vertices[0].x,
                    y: entity.vertices[0].y,
                },
                end: {
                    x: entity.vertices[1].x,
                    y: entity.vertices[1].y,
                },
            },
            layer: entity.layer,
        };
    } else if (entity.start && entity.end) {
        // Alternative LINE format
        return {
            id: generateId(),
            type: GeometryType.LINE,
            geometry: {
                start: { x: entity.start.x, y: entity.start.y },
                end: { x: entity.end.x, y: entity.end.y },
            },
            layer: entity.layer,
        };
    }
    return null;
}

function convertInsertEntity(
    entity: DXFEntity,
    blocks: Map<string, DXFEntity[]>,
    blockBasePoints: Map<string, { x: number; y: number }>
): ShapeData[] | null {
    const blockName: string | undefined = entity.block || entity.name;
    if (!blockName || !blocks.has(blockName)) {
        return null;
    }

    const blockEntities: DXFEntity[] = blocks.get(blockName) || [];
    const insertedShapes: ShapeData[] = [];

    // Get transformation parameters with defaults
    const insertX: number = entity.x || 0;
    const insertY: number = entity.y || 0;
    const scaleX: number = entity.scaleX || 1;
    const scaleY: number = entity.scaleY || 1;
    const rotation: number = entity.rotation || 0; // In degrees
    const rotationRad: number = (rotation * Math.PI) / HALF_CIRCLE_DEG; // Convert to radians

    // Get block base point for proper INSERT positioning
    const basePoint: { x: number; y: number } = blockBasePoints.get(
        blockName
    ) || {
        x: 0,
        y: 0,
    };

    // Process each entity in the block
    for (const blockEntity of blockEntities) {
        const shape: ShapeData | ShapeData[] | null = convertDXFEntity(
            blockEntity,
            blocks,
            blockBasePoints
        );
        if (shape) {
            const shapesToTransform: ShapeData[] = Array.isArray(shape)
                ? shape
                : [shape];

            // Apply transformation to each shape
            for (const shapeToTransform of shapesToTransform) {
                const transformed = transformShape(
                    new Shape(shapeToTransform),
                    {
                        insertX,
                        insertY,
                        scaleX,
                        scaleY,
                        rotationRad,
                        blockBaseX: basePoint.x,
                        blockBaseY: basePoint.y,
                    }
                );
                if (transformed) {
                    insertedShapes.push(transformed.toData());
                }
            }
        }
    }

    return insertedShapes.length > 0 ? insertedShapes : null;
}

function convertDXFEntity(
    entity: DXFEntity,
    blocks: Map<string, DXFEntity[]> = new Map(),
    blockBasePoints: Map<string, { x: number; y: number }> = new Map()
): ShapeData | ShapeData[] | null {
    try {
        switch (entity.type) {
            case 'INSERT':
                return convertInsertEntity(entity, blocks, blockBasePoints);

            case 'LINE':
                return convertLineEntity(entity);

            case 'CIRCLE':
                return convertCircleEntity(entity);

            case 'ARC':
                return convertArcEntity(entity);

            case 'SPLINE':
                return convertSplineEntity(entity);

            case 'LWPOLYLINE':
            case 'POLYLINE':
                return convertPolylineEntity(entity);

            case 'ELLIPSE':
                return convertEllipseEntity(entity);

            default:
                // Silently ignore unknown entity types
                return null;
        }
    } catch {
        // Error converting DXF entity - continue parsing other entities
        return null;
    }
}

/**
 * Convert raw DXF $INSUNITS value to Unit type with coordinate scale factor
 */
function convertRawInsUnitsToUnit(rawInsUnits: number | undefined): {
    unit: Unit;
    scaleFactor: number;
} {
    // No $INSUNITS header at all
    if (rawInsUnits === undefined) {
        return { unit: Unit.NONE, scaleFactor: 1.0 };
    }

    // Known $INSUNITS values
    switch (rawInsUnits) {
        case DXF_INSUNITS_INCHES: // Inches
            return { unit: Unit.INCH, scaleFactor: 1.0 };
        case DXF_INSUNITS_FEET: // Feet - convert to inches
            return { unit: Unit.INCH, scaleFactor: FEET_TO_INCHES };
        case DXF_INSUNITS_MILLIMETERS: // Millimeters
            return { unit: Unit.MM, scaleFactor: 1.0 };
        case DXF_INSUNITS_CENTIMETERS: // Centimeters - convert to mm
            return { unit: Unit.MM, scaleFactor: CENTIMETERS_TO_MILLIMETERS };
        case DXF_INSUNITS_METERS: // Meters - convert to mm
            return { unit: Unit.MM, scaleFactor: METERS_TO_MILLIMETERS };
        default:
            // Unknown/unsupported $INSUNITS value - default to mm
            return { unit: Unit.MM, scaleFactor: 1.0 };
    }
}

export function parseDXF(content: string): DrawingData {
    let parsed: DXFParsed;
    try {
        parsed = parseString(content);
    } catch (error) {
        // Failed to parse DXF file
        throw new Error(
            `DXF parsing failed: ${error instanceof Error ? (error as Error).message : 'Unknown error'}`
        );
    }

    if (!parsed) {
        throw new Error('DXF parser returned null or undefined');
    }
    const shapes: ShapeData[] = [];

    // Extract units from DXF header and convert coordinates to mm if needed
    const rawInsUnits: number | undefined =
        parsed?.header?.$INSUNITS ?? parsed?.header?.insUnits;
    const { unit: drawingUnits, scaleFactor: coordinateScaleFactor } =
        convertRawInsUnitsToUnit(rawInsUnits);

    // Process blocks first to build block dictionary
    const blocks: Map<string, DXFEntity[]> = new Map<string, DXFEntity[]>();
    const blockBasePoints: Map<string, { x: number; y: number }> = new Map<
        string,
        { x: number; y: number }
    >();
    if (parsed && parsed.blocks) {
        for (const blockKey in parsed.blocks) {
            const block: DXFBlock = parsed.blocks[blockKey];
            if (block && block.entities && block.name) {
                blocks.set(block.name, block.entities);
                // Store block base point for INSERT transformations
                blockBasePoints.set(block.name, {
                    x: block.x || 0,
                    y: block.y || 0,
                });
            }
        }
    }

    // Process entities
    if (parsed && parsed.entities) {
        parsed.entities.forEach((entity: DXFEntity) => {
            try {
                const result: ShapeData | ShapeData[] | null = convertDXFEntity(
                    entity,
                    blocks,
                    blockBasePoints
                );
                if (result) {
                    if (Array.isArray(result)) {
                        // Multiple shapes (decomposed polyline or INSERT entities)
                        result.forEach((shape) => {
                            // Scale coordinates if needed (cm/m → mm conversion)
                            const scaled =
                                coordinateScaleFactor !== 1.0
                                    ? scaleShape(
                                          new Shape(shape),
                                          coordinateScaleFactor,
                                          {
                                              x: 0,
                                              y: 0,
                                          }
                                      )
                                    : new Shape(shape);
                            shapes.push(scaled.toData());
                        });
                    } else {
                        // Single shape
                        // Scale coordinates if needed (cm/m → mm conversion)
                        const scaled =
                            coordinateScaleFactor !== 1.0
                                ? scaleShape(
                                      new Shape(result),
                                      coordinateScaleFactor,
                                      {
                                          x: 0,
                                          y: 0,
                                      }
                                  )
                                : new Shape(result);
                        shapes.push(scaled.toData());
                    }
                }
            } catch (error) {
                console.error(
                    'Failed to convert entity - continue processing other entities',
                    error
                );
            }
        });
    }

    return {
        shapes,
        units: drawingUnits, // Use detected units from DXF header
        fileName: String(Date.now()), // Default timestamp, can be overridden by caller
    };
}
