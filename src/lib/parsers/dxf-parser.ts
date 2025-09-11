// Dynamic import to avoid SSR issues
let parseString: typeof import('dxf').parseString;
import type {
    Drawing,
    Shape,
    Point2D,
    PolylineVertex,
    Polyline,
    Line,
    Circle,
    Ellipse,
} from '$lib/types';
import type { Spline } from '$lib/geometry/spline';
import type { Arc } from '$lib/geometry/arc';
import { GeometryType } from '$lib/types/geometry';
import { Unit } from '../utils/units';
import { generateId } from '../utils/id';
import {
    generateSegments,
    MIN_VERTICES_FOR_POLYLINE,
} from '$lib/geometry/polyline';
import { normalizeSplineWeights } from '$lib/geometry/spline';
import { getShapePointsForBounds } from '../utils/shape-bounds-utils';
import type { DXFBlock, DXFEntity, DXFParsed } from 'dxf';
import { FULL_CIRCLE_RADIANS, HALF_CIRCLE_DEG } from '$lib/geometry/circle';
import {
    DEFAULT_SPLINE_DEGREE,
    MIN_CONTROL_POINTS_FOR_SPLINE,
} from '$lib/geometry/spline';
import { MIN_VERTICES_FOR_LINE } from '$lib/geometry/line';

// DXF INSUNITS constants
const DXF_INSUNITS_INCHES = 1;
const DXF_INSUNITS_MILLIMETERS = 4;
const DXF_INSUNITS_CENTIMETERS = 5;
const DXF_INSUNITS_METERS = 6;

const DEFAULT_ELLIPSE_START_PARAM = 0;
const SCALING_AVERAGE_DIVISOR = 2;

interface DXFOptions {
    squashLayers?: boolean;
    // Legacy options (ignored - algorithms moved to separate functions)
    decomposePolylines?: boolean;
    translateToPositiveQuadrant?: boolean;
}

/**
 * Helper function to conditionally include layer information based on squashLayers option
 */
function getLayerInfo(
    entity: DXFEntity,
    options: DXFOptions
): { layer?: string } {
    if (options.squashLayers) {
        return {}; // Don't include layer information
    }
    return { layer: entity.layer };
}

export async function parseDXF(
    content: string,
    options: DXFOptions = {}
): Promise<Drawing> {
    // Dynamically import DXF parser only on client side
    if (!parseString) {
        const dxfModule = await import('dxf');
        parseString = dxfModule.parseString;
    }

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
    let drawingUnits: Unit = Unit.MM; // Default to mm

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
                    options,
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

function convertDXFEntity(
    entity: DXFEntity,
    options: DXFOptions = {},
    blocks: Map<string, DXFEntity[]> = new Map(),
    blockBasePoints: Map<string, { x: number; y: number }> = new Map()
): Shape | Shape[] | null {
    try {
        switch (entity.type) {
            case 'INSERT':
                // Handle INSERT entities (block references)
                const blockName: string | undefined =
                    entity.block || entity.name;
                if (blockName && blocks.has(blockName)) {
                    const blockEntities: DXFEntity[] =
                        blocks.get(blockName) || [];
                    const insertedShapes: Shape[] = [];

                    // Get transformation parameters with defaults
                    const insertX: number = entity.x || 0;
                    const insertY: number = entity.y || 0;
                    const scaleX: number = entity.scaleX || 1;
                    const scaleY: number = entity.scaleY || 1;
                    const rotation: number = entity.rotation || 0; // In degrees
                    const rotationRad: number =
                        (rotation * Math.PI) / HALF_CIRCLE_DEG; // Convert to radians

                    // Get block base point for proper INSERT positioning
                    const basePoint: { x: number; y: number } =
                        blockBasePoints.get(blockName) || {
                            x: 0,
                            y: 0,
                        };

                    // Process each entity in the block
                    for (const blockEntity of blockEntities) {
                        const shape: Shape | Shape[] | null = convertDXFEntity(
                            blockEntity,
                            options,
                            blocks,
                            blockBasePoints
                        );
                        if (shape) {
                            const shapesToTransform: Shape[] = Array.isArray(
                                shape
                            )
                                ? shape
                                : [shape];

                            // Apply transformation to each shape
                            for (const shapeToTransform of shapesToTransform) {
                                const transformedShape: Shape | null =
                                    transformShape(shapeToTransform, {
                                        insertX,
                                        insertY,
                                        scaleX,
                                        scaleY,
                                        rotationRad,
                                        blockBaseX: basePoint.x,
                                        blockBaseY: basePoint.y,
                                    });
                                if (transformedShape) {
                                    insertedShapes.push(transformedShape);
                                }
                            }
                        }
                    }

                    return insertedShapes.length > 0 ? insertedShapes : null;
                }
                return null;

            case 'LINE':
                // Handle LINE entities - can have vertices array or direct start/end points
                if (
                    entity.vertices &&
                    entity.vertices.length >= MIN_VERTICES_FOR_LINE
                ) {
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
                        ...getLayerInfo(entity, options),
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
                        ...getLayerInfo(entity, options),
                    };
                }
                return null;

            case 'CIRCLE':
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
                        ...getLayerInfo(entity, options),
                    };
                }
                return null;

            case 'ARC':
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
                        ...getLayerInfo(entity, options),
                    };
                }
                return null;

            case 'SPLINE':
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
                            ? entity.fitPoints.map(
                                  (p: { x: number; y: number }) => ({
                                      x: p.x,
                                      y: p.y,
                                  })
                              )
                            : [],
                        closed: entity.closed || false,
                    };

                    // Normalize spline weights to prevent NaN values during offset calculations
                    const normalizedGeometry =
                        normalizeSplineWeights(splineGeometry);

                    return {
                        id: generateId(),
                        type: GeometryType.SPLINE,
                        geometry: normalizedGeometry,
                        ...getLayerInfo(entity, options),
                    };
                }
                return null;

            case 'LWPOLYLINE':
            case 'POLYLINE':
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
                        const isClosed: boolean =
                            entity.shape || entity.closed || false;

                        // Generate shapes using the utility function
                        const shapes: Shape[] = generateSegments(
                            vertices,
                            isClosed
                        );

                        // Only create polyline if we have valid segments
                        if (shapes.length > 0) {
                            return {
                                id: generateId(),
                                type: GeometryType.POLYLINE,
                                geometry: {
                                    closed: isClosed,
                                    shapes,
                                },
                                ...getLayerInfo(entity, options),
                            };
                        }
                    }
                }
                return null;

            case 'ELLIPSE':
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
                        ...getLayerInfo(entity, options),
                    };
                }
                return null;

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

function transformShape(
    shape: Shape,
    transform: {
        insertX: number;
        insertY: number;
        scaleX: number;
        scaleY: number;
        rotationRad: number;
        blockBaseX: number;
        blockBaseY: number;
    }
): Shape | null {
    const {
        insertX,
        insertY,
        scaleX,
        scaleY,
        rotationRad,
        blockBaseX,
        blockBaseY,
    } = transform;
    const clonedShape: Shape = JSON.parse(JSON.stringify(shape));

    const transformPoint: (p: Point2D) => Point2D = (p: Point2D): Point2D => {
        // Step 1: Translate by negative block base point (block origin)
        let x: number = p.x - blockBaseX;
        let y: number = p.y - blockBaseY;

        // Step 2: Apply scaling
        x = x * scaleX;
        y = y * scaleY;

        // Step 3: Apply rotation
        if (rotationRad !== 0) {
            const cos: number = Math.cos(rotationRad);
            const sin: number = Math.sin(rotationRad);
            const newX: number = x * cos - y * sin;
            const newY: number = x * sin + y * cos;
            x = newX;
            y = newY;
        }

        // Step 4: Apply INSERT position translation
        x += insertX;
        y += insertY;

        return { x, y };
    };

    // Transform geometry based on shape type
    switch (clonedShape.type) {
        case GeometryType.LINE:
            const line: Line = clonedShape.geometry as Line;
            line.start = transformPoint(line.start);
            line.end = transformPoint(line.end);
            break;

        case GeometryType.CIRCLE:
        case GeometryType.ARC:
            const circleOrArc: Circle | Arc = clonedShape.geometry as
                | Circle
                | Arc;
            circleOrArc.center = transformPoint(circleOrArc.center);
            // Scale radius (use average of scaleX and scaleY for uniform scaling)
            circleOrArc.radius *= (scaleX + scaleY) / SCALING_AVERAGE_DIVISOR;
            // Adjust arc angles for rotation
            if (clonedShape.type === GeometryType.ARC && rotationRad !== 0) {
                const arc: Arc = circleOrArc as Arc;
                arc.startAngle += rotationRad;
                arc.endAngle += rotationRad;
            }
            break;

        case GeometryType.POLYLINE:
            const polyline: Polyline = clonedShape.geometry as Polyline;
            // Transform all shapes
            polyline.shapes = polyline.shapes.map((shape) => {
                const segment = shape.geometry;
                if ('start' in segment && 'end' in segment) {
                    // Line segment
                    return {
                        ...shape,
                        geometry: {
                            start: transformPoint(segment.start),
                            end: transformPoint(segment.end),
                        },
                    };
                } else if ('center' in segment && 'radius' in segment) {
                    // Arc segment
                    const arc: Arc = { ...segment } as Arc;
                    arc.center = transformPoint(arc.center);
                    // Scale radius (use average of scaleX and scaleY for uniform scaling)
                    arc.radius *= (scaleX + scaleY) / SCALING_AVERAGE_DIVISOR;
                    // Adjust arc angles for rotation
                    if (rotationRad !== 0) {
                        arc.startAngle += rotationRad;
                        arc.endAngle += rotationRad;
                    }
                    return {
                        ...shape,
                        geometry: arc,
                    };
                }
                return shape;
            });
            break;

        case GeometryType.ELLIPSE:
            const ellipse: Ellipse = clonedShape.geometry as Ellipse;
            ellipse.center = transformPoint(ellipse.center);
            // Transform the major axis endpoint vector
            const majorAxisEnd: Point2D = {
                x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
                y: ellipse.center.y + ellipse.majorAxisEndpoint.y,
            };
            const transformedMajorAxisEnd: Point2D =
                transformPoint(majorAxisEnd);
            ellipse.majorAxisEndpoint = {
                x: transformedMajorAxisEnd.x - ellipse.center.x,
                y: transformedMajorAxisEnd.y - ellipse.center.y,
            };
            // Note: minorToMajorRatio stays the same as it's a proportion
            break;

        default:
            console.warn(
                `Unknown shape type for transformation: ${clonedShape.type}`
            );
            return null;
    }

    // Generate new ID for transformed shape
    clonedShape.id = generateId();

    return clonedShape;
}
