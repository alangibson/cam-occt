import { parseString } from 'dxf';
import {
    Unit,
    type Drawing,
    type Ellipse,
    type Point2D,
    type PolylineVertex,
    type Shape,
} from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import { GeometryType } from '$lib/types/geometry';
import { generateId } from '$lib/domain/id';
import {
    MIN_VERTICES_FOR_POLYLINE,
    generateSegments,
} from '$lib/geometry/polyline';
import {
    normalizeSplineWeights,
    DEFAULT_SPLINE_DEGREE,
    MIN_CONTROL_POINTS_FOR_SPLINE,
} from '$lib/geometry/spline';
import { getShapePointsForBounds } from '$lib/geometry/bounding-box/functions';
import type { DXFBlock, DXFEntity, DXFParsed } from 'dxf';
import { FULL_CIRCLE_RADIANS, HALF_CIRCLE_DEG } from '$lib/geometry/circle';
import { MIN_VERTICES_FOR_LINE } from '$lib/geometry/line';
import { transformShape } from '$lib/geometry/shape/functions';
import {
    DEFAULT_ELLIPSE_START_PARAM,
    DXF_INSUNITS_INCHES,
    DXF_INSUNITS_MILLIMETERS,
    DXF_INSUNITS_CENTIMETERS,
    DXF_INSUNITS_METERS,
} from './constants';
import type { ApplicationSettings } from '$lib/stores/settings/interfaces';
import { ImportUnitSetting } from '$lib/stores/settings/interfaces';
import { convertUnits, measurementSystemToUnit } from '$lib/utils/units';

function updateBounds(
    shape: Shape,
    bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
    const points: Point2D[] = getShapePointsForBounds(shape);
    points.forEach((p) => {
        // Only update bounds with finite values
        if (p && isFinite(p.x) && isFinite(p.y)) {
            bounds.minX = Math.min(bounds.minX, p.x);
            bounds.minY = Math.min(bounds.minY, p.y);
            bounds.maxX = Math.max(bounds.maxX, p.x);
            bounds.maxY = Math.max(bounds.maxY, p.y);
        }
    });
}

function convertEllipseEntity(entity: DXFEntity): Shape | null {
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

function convertPolylineEntity(entity: DXFEntity): Shape | null {
    if (
        entity.vertices &&
        Array.isArray(entity.vertices) &&
        entity.vertices.length > 0
    ) {
        // Filter and map vertices to preserve bulge data
        const vertices: PolylineVertex[] = entity.vertices
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
            const shapes: Shape[] = generateSegments(vertices, isClosed);

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

function convertSplineEntity(entity: DXFEntity): Shape | null {
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

function convertArcEntity(entity: DXFEntity): Shape | null {
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

function convertCircleEntity(entity: DXFEntity): Shape | null {
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

function convertLineEntity(entity: DXFEntity): Shape | null {
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
): Shape[] | null {
    const blockName: string | undefined = entity.block || entity.name;
    if (!blockName || !blocks.has(blockName)) {
        return null;
    }

    const blockEntities: DXFEntity[] = blocks.get(blockName) || [];
    const insertedShapes: Shape[] = [];

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
        const shape: Shape | Shape[] | null = convertDXFEntity(
            blockEntity,
            blocks,
            blockBasePoints
        );
        if (shape) {
            const shapesToTransform: Shape[] = Array.isArray(shape)
                ? shape
                : [shape];

            // Apply transformation to each shape
            for (const shapeToTransform of shapesToTransform) {
                const transformedShape: Shape | null = transformShape(
                    shapeToTransform,
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
                if (transformedShape) {
                    insertedShapes.push(transformedShape);
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
): Shape | Shape[] | null {
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
    } catch (error) {
        // Log the error for debugging but don't crash the parsing
        console.warn(
            `Error converting DXF entity of type ${entity.type}:`,
            error
        );
        return null;
    }
}

export async function parseDXF(content: string): Promise<Drawing> {
    let parsed: DXFParsed;
    try {
        parsed = parseString(content);
    } catch (error) {
        console.error('Failed to parse DXF file:', error);
        throw new Error(
            `DXF parsing failed: ${error instanceof Error ? (error as Error).message : 'Unknown error'}`
        );
    }

    if (!parsed) {
        throw new Error('DXF parser returned null or undefined');
    }
    const shapes: Shape[] = [];
    const bounds: { minX: number; minY: number; maxX: number; maxY: number } = {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
    };

    // Extract units from DXF header
    let drawingUnits: Unit = Unit.NONE; // Default to none when no units specified

    if (
        parsed &&
        parsed.header &&
        (parsed.header.$INSUNITS !== undefined ||
            parsed.header.insUnits !== undefined)
    ) {
        const insunits: number | undefined =
            parsed.header.$INSUNITS || parsed.header.insUnits;
        // Convert DXF $INSUNITS values to our unit system
        switch (insunits) {
            case DXF_INSUNITS_INCHES: // Inches
                drawingUnits = Unit.INCH;
                break;
            case DXF_INSUNITS_MILLIMETERS: // Millimeters
                drawingUnits = Unit.MM;
                break;
            case DXF_INSUNITS_CENTIMETERS: // Centimeters - treat as mm for now
                drawingUnits = Unit.MM;
                break;
            case DXF_INSUNITS_METERS: // Meters - treat as mm for now
                drawingUnits = Unit.MM;
                break;
            default:
                // For all other units (unitless, feet, etc.), default to mm
                drawingUnits = Unit.MM;
                break;
        }
    }

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
        parsed.entities.forEach((entity: DXFEntity, index: number) => {
            try {
                const result: Shape | Shape[] | null = convertDXFEntity(
                    entity,
                    blocks,
                    blockBasePoints
                );
                if (result) {
                    if (Array.isArray(result)) {
                        // Multiple shapes (decomposed polyline or INSERT entities)
                        result.forEach((shape) => {
                            shapes.push(shape);
                            updateBounds(shape, bounds);
                        });
                    } else {
                        // Single shape
                        shapes.push(result);
                        updateBounds(result, bounds);
                    }
                }
            } catch (error) {
                console.error(
                    `Failed to convert entity at index ${index} (type: ${entity?.type}):`,
                    error
                );
                // Continue processing other entities
            }
        });
    }

    // Ensure bounds are valid - if no shapes were processed, set to zero bounds
    const finalBounds: { min: Point2D; max: Point2D } = {
        min: {
            x: isFinite(bounds.minX) ? bounds.minX : 0,
            y: isFinite(bounds.minY) ? bounds.minY : 0,
        },
        max: {
            x: isFinite(bounds.maxX) ? bounds.maxX : 0,
            y: isFinite(bounds.maxY) ? bounds.maxY : 0,
        },
    };

    return {
        shapes,
        bounds: finalBounds,
        units: drawingUnits, // Use detected units from DXF header
    };
}

/**
 * Convert a point from one unit to another
 */
function convertPoint(point: Point2D, fromUnit: Unit, toUnit: Unit): Point2D {
    if (fromUnit === toUnit) {
        return point;
    }

    return {
        x: convertUnits(point.x, fromUnit, toUnit),
        y: convertUnits(point.y, fromUnit, toUnit),
    };
}

/**
 * Convert a shape's geometry from one unit to another
 */
function convertShapeGeometry(
    shape: Shape,
    fromUnit: Unit,
    toUnit: Unit
): Shape {
    if (fromUnit === toUnit) {
        return shape;
    }

    const convertedShape: Shape = { ...shape };

    switch (shape.type) {
        case GeometryType.LINE: {
            const lineGeometry = shape.geometry as {
                start: Point2D;
                end: Point2D;
            };
            convertedShape.geometry = {
                start: convertPoint(lineGeometry.start, fromUnit, toUnit),
                end: convertPoint(lineGeometry.end, fromUnit, toUnit),
            };
            break;
        }

        case GeometryType.CIRCLE: {
            const circleGeometry = shape.geometry as {
                center: Point2D;
                radius: number;
            };
            convertedShape.geometry = {
                center: convertPoint(circleGeometry.center, fromUnit, toUnit),
                radius: convertUnits(circleGeometry.radius, fromUnit, toUnit),
            };
            break;
        }

        case GeometryType.ARC: {
            const arcGeometry = shape.geometry as {
                center: Point2D;
                radius: number;
                startAngle: number;
                endAngle: number;
                clockwise: boolean;
            };
            convertedShape.geometry = {
                ...arcGeometry,
                center: convertPoint(arcGeometry.center, fromUnit, toUnit),
                radius: convertUnits(arcGeometry.radius, fromUnit, toUnit),
            };
            break;
        }

        case GeometryType.ELLIPSE: {
            const ellipseGeometry = shape.geometry as Ellipse;
            convertedShape.geometry = {
                ...ellipseGeometry,
                center: convertPoint(ellipseGeometry.center, fromUnit, toUnit),
                majorAxisEndpoint: convertPoint(
                    ellipseGeometry.majorAxisEndpoint,
                    fromUnit,
                    toUnit
                ),
            };
            break;
        }

        case GeometryType.POLYLINE: {
            const polylineGeometry = shape.geometry as {
                closed: boolean;
                shapes: Shape[];
            };
            convertedShape.geometry = {
                ...polylineGeometry,
                shapes: polylineGeometry.shapes.map((subShape: Shape) =>
                    convertShapeGeometry(subShape, fromUnit, toUnit)
                ),
            };
            break;
        }

        case GeometryType.SPLINE: {
            const splineGeometry = shape.geometry as Spline;
            convertedShape.geometry = {
                ...splineGeometry,
                controlPoints: splineGeometry.controlPoints.map((point) =>
                    convertPoint(point, fromUnit, toUnit)
                ),
                fitPoints: splineGeometry.fitPoints.map((point) =>
                    convertPoint(point, fromUnit, toUnit)
                ),
            };
            break;
        }

        default:
            // For unknown types, return the shape unchanged
            break;
    }

    return convertedShape;
}

/**
 * Apply unit conversion to a drawing based on application settings
 * This function handles the logic for when and how to convert units during import
 */
export function applyImportUnitConversion(
    drawing: Drawing,
    settings: ApplicationSettings
): Drawing {
    // Determine target unit based on import setting
    let targetUnit: Unit;

    switch (settings.importUnitSetting) {
        case ImportUnitSetting.Automatic:
            // Use the file's detected units - no conversion needed
            return drawing;

        case ImportUnitSetting.Application:
            // Convert to application's measurement system
            targetUnit = measurementSystemToUnit(settings.measurementSystem);
            break;

        case ImportUnitSetting.Metric:
            // Force metric units
            targetUnit = Unit.MM;
            break;

        case ImportUnitSetting.Imperial:
            // Force imperial units
            targetUnit = Unit.INCH;
            break;

        default:
            // Fallback to automatic behavior
            return drawing;
    }

    // If no conversion needed, return original drawing
    if (drawing.units === targetUnit) {
        return drawing;
    }

    // Convert all shapes
    const convertedShapes = drawing.shapes.map((shape) =>
        convertShapeGeometry(shape, drawing.units, targetUnit)
    );

    // Convert bounds
    const convertedBounds = {
        min: convertPoint(drawing.bounds.min, drawing.units, targetUnit),
        max: convertPoint(drawing.bounds.max, drawing.units, targetUnit),
    };

    return {
        shapes: convertedShapes,
        bounds: convertedBounds,
        units: targetUnit,
    };
}
