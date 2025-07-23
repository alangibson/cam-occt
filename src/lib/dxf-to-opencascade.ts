import type { OpenCascadeInstance } from 'opencascade.js';
import OpenCascadeService from './opencascade-service.js';
import type { UnitType } from '../types/index.js';

export interface UnitInfo {
	code: number;
	name: string;
	type: UnitType;
	confidence: 'high' | 'medium' | 'low';
	fallback?: boolean;
	default?: boolean;
}

export interface OpenCascadeShape {
	shape: any; // OpenCascade shape object
	type: string;
	layer: string;
	// Original DXF data for precise origin calculations
	startPoint?: { x: number; y: number; z: number }; // For lines
	endPoint?: { x: number; y: number; z: number }; // For lines
	center?: { x: number; y: number; z: number }; // For circles and arcs
	radius?: number; // For circles and arcs
	startAngle?: number; // For arcs
	endAngle?: number; // For arcs
	insertTransform?: {
		translation: { x: number; y: number; z: number };
		rotation: number;
		scale: { x: number; y: number; z: number };
		blockName: string;
		insertHandle: string;
		blockBasePoint?: { x: number; y: number; z: number };
	};
}

export interface DxfParseResult {
	shapes: OpenCascadeShape[];
	units: UnitInfo;
}

export class DxfToOpenCascadeConverter {
	private oc: OpenCascadeInstance | null = null;
	private dxfBlocks: any = {};
	private blockBasePoints: Map<string, { x: number; y: number; z: number }> = new Map();

	constructor() {}

	async initialize(): Promise<void> {
		const service = OpenCascadeService.getInstance();
		this.oc = await service.initialize();
	}

	async parseDxfToOpenCascade(dxfContent: string): Promise<DxfParseResult> {
		if (!this.oc) {
			await this.initialize();
		}

		if (!this.oc) {
			throw new Error('OpenCascade not initialized');
		}

		try {
			// Dynamic import to avoid SSR issues
			const dxf = await import('dxf');
			const parsed = dxf.parseString(dxfContent);
			
			// Store blocks for INSERT entity processing
			this.dxfBlocks = parsed.blocks || {};
			
			// Extract block base points from block definitions
			for (const blockKey in this.dxfBlocks) {
				const block = this.dxfBlocks[blockKey];
				if (block && typeof block.x !== 'undefined' && typeof block.y !== 'undefined') {
					const blockName = block.name || blockKey;
					this.blockBasePoints.set(blockName, {
						x: block.x || 0,
						y: block.y || 0,
						z: block.z || 0
					});
					console.log(`Stored base point for block '${blockName}':`, this.blockBasePoints.get(blockName));
				}
			}
			
			if (!parsed) {
				throw new Error('Failed to parse DXF file');
			}

			if (!parsed.entities || parsed.entities.length === 0) {
				throw new Error('No entities found in DXF file');
			}

			const shapes: OpenCascadeShape[] = [];
			const conversionErrors: string[] = [];
			
			// Process each entity in the DXF file
			for (const entity of parsed.entities) {
				try {
					const result = this.convertEntityToOpenCascade(entity);
					if (result) {
						// Handle both single shapes and arrays (for INSERT entities)
						if (Array.isArray(result)) {
							shapes.push(...result);
						} else {
							shapes.push(result);
						}
					}
				} catch (entityError) {
					const errorMsg = `Error converting ${entity.type} entity: ${(entityError as Error).message}`;
					console.error(errorMsg);
					conversionErrors.push(errorMsg);
					// Continue processing other entities instead of failing completely
				}
			}

			console.log(`Converted ${shapes.length} DXF entities to OpenCascade shapes`);
			
			if (shapes.length === 0) {
				if (conversionErrors.length > 0) {
					throw new Error(`No entities could be converted. Errors: ${conversionErrors.join('; ')}`);
				} else {
					throw new Error('No supported entities found in DXF file');
				}
			}
			
			const units = this.detectUnits(parsed);
			
			return {
				shapes,
				units
			};
		} catch (error) {
			console.error('DXF to OpenCascade conversion error:', error);
			throw new Error(`Failed to convert DXF to OpenCascade: ${(error as Error).message}`);
		}
	}

	private convertEntityToOpenCascade(entity: any): OpenCascadeShape | OpenCascadeShape[] | null {
		if (!this.oc) return null;

		const layer = entity.layer || '0';
		
		try {
			switch (entity.type) {
				case 'LINE':
					return this.createOpenCascadeLine(entity, layer);
				case 'POLYLINE':
				case 'LWPOLYLINE':
					return this.createOpenCascadePolyline(entity, layer);
				case 'CIRCLE':
					return this.createOpenCascadeCircle(entity, layer);
				case 'ARC':
					return this.createOpenCascadeArc(entity, layer);
				case 'SPLINE':
					return this.createOpenCascadeSpline(entity, layer);
				case 'INSERT':
					return this.createOpenCascadeInsert(entity, layer);
				default:
					console.warn(`Unsupported DXF entity type: ${entity.type}`);
					return null;
			}
		} catch (error) {
			console.error(`Error converting ${entity.type} entity:`, error);
			return null;
		}
	}

	private createOpenCascadeLine(entity: any, layer: string): OpenCascadeShape {
		const { oc } = this;
		
		// Validate line entity
		if (!entity.start || !entity.end) {
			throw new Error('Line entity missing start or end point');
		}
		
		// Create points
		const startPnt = new oc.gp_Pnt_3(entity.start.x, entity.start.y, entity.start.z || 0);
		const endPnt = new oc.gp_Pnt_3(entity.end.x, entity.end.y, entity.end.z || 0);
		
		// Create edge from points using gp_Pnt directly
		const edge = new oc.BRepBuilderAPI_MakeEdge_3(startPnt, endPnt).Edge();
		
		return {
			shape: edge,
			type: 'LINE',
			layer,
			// Store original DXF coordinates for precise origin calculations
			startPoint: { x: entity.start.x, y: entity.start.y, z: entity.start.z || 0 },
			endPoint: { x: entity.end.x, y: entity.end.y, z: entity.end.z || 0 }
		};
	}

	private createOpenCascadePolyline(entity: any, layer: string): OpenCascadeShape {
		const { oc } = this;
		
		if (!entity.vertices || entity.vertices.length < 2) {
			throw new Error('Polyline must have at least 2 vertices');
		}

		// Debug logging removed - vertex validation implemented below

		try {
			const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
			
			// Create edges between consecutive vertices
			for (let i = 0; i < entity.vertices.length - 1; i++) {
				const v1 = entity.vertices[i];
				const v2 = entity.vertices[i + 1];
				
				// Validate vertex data - require both x and y to be defined
				if (!v1 || !v2 || 
					typeof v1.x === 'undefined' || typeof v1.y === 'undefined' ||
					typeof v2.x === 'undefined' || typeof v2.y === 'undefined') {
					console.warn(`Skipping invalid vertex pair at index ${i}: v1(${v1?.x}, ${v1?.y}) v2(${v2?.x}, ${v2?.y})`);
					continue;
				}
				
				const p1 = new oc.gp_Pnt_3(v1.x, v1.y || 0, v1.z || 0);
				const p2 = new oc.gp_Pnt_3(v2.x, v2.y || 0, v2.z || 0);
				
				// Create edge from points using gp_Pnt directly
				const edgeBuilder = new oc.BRepBuilderAPI_MakeEdge_3(p1, p2);
				if (edgeBuilder.IsDone()) {
					const edge = edgeBuilder.Edge();
					wireBuilder.Add_1(edge);
				}
			}

			// Close the polyline if marked as closed
			if (entity.closed && entity.vertices.length > 2) {
				const firstVertex = entity.vertices[0];
				const lastVertex = entity.vertices[entity.vertices.length - 1];
				
				if (firstVertex && lastVertex && 
					typeof firstVertex.x !== 'undefined' && typeof lastVertex.x !== 'undefined') {
					
					const p1 = new oc.gp_Pnt_3(lastVertex.x, lastVertex.y || 0, lastVertex.z || 0);
					const p2 = new oc.gp_Pnt_3(firstVertex.x, firstVertex.y || 0, firstVertex.z || 0);
					
					const edgeBuilder = new oc.BRepBuilderAPI_MakeEdge_3(p1, p2);
					if (edgeBuilder.IsDone()) {
						const closingEdge = edgeBuilder.Edge();
						wireBuilder.Add_1(closingEdge);
					}
				}
			}

			if (wireBuilder.IsDone()) {
				const wire = wireBuilder.Wire();
				return {
					shape: wire,
					type: 'POLYLINE',
					layer
				};
			} else {
				throw new Error('Failed to create wire from polyline vertices');
			}
		} catch (error) {
			throw new Error(`Polyline creation failed: ${error.message}`);
		}
	}

	private createOpenCascadeCircle(entity: any, layer: string): OpenCascadeShape {
		const { oc } = this;
		
		// Validate center point (DXF parser uses x, y, z properties)
		if (typeof entity.x === 'undefined' || typeof entity.y === 'undefined') {
			throw new Error('Circle entity missing valid center point');
		}
		
		// Create center point
		const center = new oc.gp_Pnt_3(entity.x, entity.y, entity.z || 0);
		
		// Create axis system (Ax2) at the center point with Z direction
		// gp_Ax2 defines a right-handed coordinate system
		const ax2 = new oc.gp_Ax2_3(center, new oc.gp_Dir_4(0, 0, 1));
		
		// Use GC_MakeCircle to create a full circle (not an arc)
		const circleBuilder = new oc.GC_MakeCircle_2(ax2, entity.r);
		
		// Validate the circle construction
		if (!circleBuilder.IsDone()) {
			throw new Error(`Circle creation failed with status: ${circleBuilder.Status()}`);
		}
		
		const circleGeom = circleBuilder.Value();
		
		// Additional validation for the returned handle
		if (circleGeom.IsNull()) {
			throw new Error('Circle geometry handle is null');
		}
		
		// Create edge from geometry curve using Handle wrapper
		const edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(circleGeom.get())).Edge();
		
		// Create wire from edge
		const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
		
		return {
			shape: wire,
			type: 'CIRCLE',
			layer,
			center: { x: entity.x, y: entity.y, z: entity.z || 0 },
			radius: entity.r
		};
	}

	private createOpenCascadeArc(entity: any, layer: string): OpenCascadeShape {
		const { oc } = this;
		
		// Validate center point (DXF parser uses x, y, z properties)
		if (typeof entity.x === 'undefined' || typeof entity.y === 'undefined') {
			throw new Error('Arc entity missing valid center point');
		}
		
		// Create center, start and end points
		const center = new oc.gp_Pnt_3(entity.x, entity.y, entity.z || 0);
		
		// Angles are already in radians from DXF parser
		const startAngle = entity.startAngle || 0;
		const endAngle = entity.endAngle || 0;
		
		// Handle angle wrapping for arcs that cross 0° boundary
		let normalizedStartAngle = startAngle;
		let normalizedEndAngle = endAngle;
		
		// If start angle > end angle, the arc crosses 0° boundary
		if (startAngle > endAngle) {
			normalizedEndAngle = endAngle + 2 * Math.PI;
		}
		
		// Calculate mid-point angle (halfway between start and end)
		const midAngle = (normalizedStartAngle + normalizedEndAngle) / 2;
		
		// Calculate start, mid, and end points on the arc
		const startX = entity.x + entity.r * Math.cos(normalizedStartAngle);
		const startY = entity.y + entity.r * Math.sin(normalizedStartAngle);
		const midX = entity.x + entity.r * Math.cos(midAngle);
		const midY = entity.y + entity.r * Math.sin(midAngle);
		const endX = entity.x + entity.r * Math.cos(normalizedEndAngle);
		const endY = entity.y + entity.r * Math.sin(normalizedEndAngle);
		
		const startPoint = new oc.gp_Pnt_3(startX, startY, entity.z || 0);
		const midPoint = new oc.gp_Pnt_3(midX, midY, entity.z || 0);
		const endPoint = new oc.gp_Pnt_3(endX, endY, entity.z || 0);
		
		// Use GC_MakeArcOfCircle to create the arc geometry with three points
		const arcBuilder = new oc.GC_MakeArcOfCircle_4(startPoint, midPoint, endPoint);
		
		// Validate the arc construction before using it
		if (!arcBuilder.IsDone()) {
			throw new Error(`Arc creation failed with status: ${arcBuilder.Status()}`);
		}
		
		const arcGeom = arcBuilder.Value();
		
		// Additional validation for the returned handle
		if (arcGeom.IsNull()) {
			throw new Error('Arc geometry handle is null');
		}
		
		// Create edge from geometry curve using Handle wrapper
		const edge = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(arcGeom.get())).Edge();
		
		return {
			shape: edge,
			type: 'ARC',
			layer,
			center: { x: entity.x, y: entity.y, z: entity.z || 0 },
			radius: entity.r,
			startAngle: entity.startAngle,
			endAngle: entity.endAngle
		};
	}

	private detectUnits(parsed: any): UnitInfo {
		// DXF Unit detection based on INSUNITS and MEASUREMENT header variables
		const INSUNITS_MAP: Record<number, { name: string; type: UnitType }> = {
			0: { name: 'Unitless', type: 'mm' },
			1: { name: 'Inches', type: 'inches' },
			2: { name: 'Feet', type: 'inches' },
			3: { name: 'Miles', type: 'inches' },
			4: { name: 'Millimeters', type: 'mm' },
			5: { name: 'Centimeters', type: 'mm' },
			6: { name: 'Meters', type: 'mm' },
			7: { name: 'Kilometers', type: 'mm' },
			8: { name: 'Microinches', type: 'inches' },
			9: { name: 'Mils', type: 'inches' },
			10: { name: 'Yards', type: 'inches' },
			11: { name: 'Angstroms', type: 'mm' },
			12: { name: 'Nanometers', type: 'mm' },
			13: { name: 'Microns', type: 'mm' },
			14: { name: 'Decimeters', type: 'mm' },
			15: { name: 'Decameters', type: 'mm' },
			16: { name: 'Hectometers', type: 'mm' },
			17: { name: 'Gigameters', type: 'mm' },
			18: { name: 'Astronomical units', type: 'mm' },
			19: { name: 'Light years', type: 'mm' },
			20: { name: 'Parsecs', type: 'mm' }
		};

		// Primary: Check INSUNITS (most reliable)
		if (parsed.header?.insUnits !== undefined && parsed.header.insUnits in INSUNITS_MAP) {
			const unitDef = INSUNITS_MAP[parsed.header.insUnits];
			return {
				code: parsed.header.insUnits,
				name: unitDef.name,
				type: unitDef.type,
				confidence: 'high'
			};
		}

		// Fallback: Check MEASUREMENT system
		if (parsed.header?.measurement !== undefined) {
			const isMetric = parsed.header.measurement === 1;
			const unitType = isMetric ? 'mm' : 'inches';
			const unitCode = isMetric ? 4 : 1;
			const unitName = isMetric ? 'Millimeters' : 'Inches';

			return {
				code: unitCode,
				name: unitName,
				type: unitType,
				confidence: 'medium',
				fallback: true
			};
		}

		// Default: When no unit information is present, default to millimeters
		return {
			code: 4,
			name: 'Millimeters',
			type: 'mm',
			confidence: 'low',
			default: true
		};
	}

	private createOpenCascadeSpline(entity: any, layer: string): OpenCascadeShape {
		const { oc } = this;
		
		if (!entity.controlPoints || entity.controlPoints.length < 2) {
			throw new Error('Spline must have at least 2 control points');
		}

		// Use the exact NURBS data from DXF entity
		const degree = entity.degree || 3;
		const numControlPoints = entity.controlPoints.length;
		const knots = entity.knots || [];
		const weights = entity.weights || [];
		
		// Validate NURBS data consistency
		const expectedKnotCount = numControlPoints + degree + 1;
		if (knots.length > 0 && knots.length !== expectedKnotCount) {
			console.warn(`NURBS knot count mismatch: expected ${expectedKnotCount}, got ${knots.length}. Using approximation.`);
			return this.createSplineApproximation(entity, layer);
		}

		try {
			// Create proper NURBS curve using exact DXF data
			if (knots.length > 0) {
				return this.createNurbsFromExactData(entity, layer, degree, knots, weights);
			} else {
				// Fallback to interpolation if no knots provided
				return this.createSplineApproximation(entity, layer);
			}
		} catch (error) {
			console.debug('NURBS creation failed, falling back to approximation:', error);
			return this.createSplineApproximation(entity, layer);
		}
	}

	// Create NURBS using exact knots, weights, and control points from DXF
	private createNurbsFromExactData(entity: any, layer: string, degree: number, knots: number[], weights: number[]): OpenCascadeShape {
		const { oc } = this;
		
		const numControlPoints = entity.controlPoints.length;
		const numKnots = knots.length;
		
		// Create control points array
		const controlPoints = new oc.TColgp_Array1OfPnt_2(1, numControlPoints);
		entity.controlPoints.forEach((point: any, index: number) => {
			const pnt = new oc.gp_Pnt_3(point.x, point.y, point.z || 0);
			controlPoints.SetValue(index + 1, pnt);
		});
		
		// Create knots array
		const knotsArray = new oc.TColStd_Array1OfReal_2(1, numKnots);
		knots.forEach((knot: number, index: number) => {
			knotsArray.SetValue(index + 1, knot);
		});
		
		// Create weights array (use 1.0 for non-rational if not provided)
		const weightsArray = new oc.TColStd_Array1OfReal_2(1, numControlPoints);
		for (let i = 1; i <= numControlPoints; i++) {
			const weight = weights.length > 0 ? (weights[i - 1] || 1.0) : 1.0;
			weightsArray.SetValue(i, weight);
		}
		
		// Calculate multiplicities for knots (how many times each unique knot appears)
		const uniqueKnots: number[] = [];
		const multiplicities: number[] = [];
		let currentKnot = knots[0];
		let currentMultiplicity = 1;
		
		for (let i = 1; i < knots.length; i++) {
			if (Math.abs(knots[i] - currentKnot) < 1e-10) {
				currentMultiplicity++;
			} else {
				uniqueKnots.push(currentKnot);
				multiplicities.push(currentMultiplicity);
				currentKnot = knots[i];
				currentMultiplicity = 1;
			}
		}
		uniqueKnots.push(currentKnot);
		multiplicities.push(currentMultiplicity);
		
		// Create unique knots and multiplicities arrays
		const uniqueKnotsArray = new oc.TColStd_Array1OfReal_2(1, uniqueKnots.length);
		const multiplicitiesArray = new oc.TColStd_Array1OfInteger_2(1, multiplicities.length);
		
		uniqueKnots.forEach((knot: number, index: number) => {
			uniqueKnotsArray.SetValue(index + 1, knot);
		});
		multiplicities.forEach((mult: number, index: number) => {
			multiplicitiesArray.SetValue(index + 1, mult);
		});
		
		// Create NURBS curve using Geom_BSplineCurve constructor
		let bsplineCurve: any;
		
		if (weights.length > 0 && weights.some(w => Math.abs(w - 1.0) > 1e-10)) {
			// Rational NURBS (with weights)
			bsplineCurve = new oc.Geom_BSplineCurve_3(controlPoints, weightsArray, uniqueKnotsArray, multiplicitiesArray, degree);
		} else {
			// Non-rational B-spline (no weights or all weights = 1.0)
			bsplineCurve = new oc.Geom_BSplineCurve_2(controlPoints, uniqueKnotsArray, multiplicitiesArray, degree);
		}
		
		// Create handle for the curve
		const curveHandle = new oc.Handle_Geom_Curve_2(bsplineCurve);
		
		// Create edge from curve
		const edgeBuilder = new oc.BRepBuilderAPI_MakeEdge_24(curveHandle);
		if (!edgeBuilder.IsDone()) {
			throw new Error('Failed to create edge from NURBS curve');
		}
		
		const edge = edgeBuilder.Edge();
		
		return {
			shape: edge,
			type: 'SPLINE',
			layer
		};
	}

	// Fallback approximation method when exact NURBS data is incomplete
	private createSplineApproximation(entity: any, layer: string): OpenCascadeShape {
		const { oc } = this;
		
		// Create points array from control points
		const points = new oc.TColgp_Array1OfPnt_2(1, entity.controlPoints.length);
		
		entity.controlPoints.forEach((point: any, index: number) => {
			const pnt = new oc.gp_Pnt_3(point.x, point.y, point.z || 0);
			points.SetValue(index + 1, pnt);
		});

		// Use GeomAPI_PointsToBSpline for approximation
		const splineBuilder = new oc.GeomAPI_PointsToBSpline_1();
		
		const degMin = 1;
		const degMax = Math.min(entity.degree || 3, entity.controlPoints.length - 1);
		const tolerance = entity.controlPointTolerance || 1.0e-6;
		
		splineBuilder.Init_1(points, degMin, degMax, oc.GeomAbs_Shape.GeomAbs_C2 as any, tolerance);
		
		if (!splineBuilder.IsDone()) {
			throw new Error('Failed to create B-spline approximation from control points');
		}
		
		const geomCurveHandle = splineBuilder.Curve();
		
		if (geomCurveHandle.IsNull()) {
			throw new Error('B-spline approximation curve handle is null');
		}
		
		const edgeBuilder = new oc.BRepBuilderAPI_MakeEdge_24(new oc.Handle_Geom_Curve_2(geomCurveHandle.get()));
		if (!edgeBuilder.IsDone()) {
			throw new Error('Failed to create edge from approximated B-spline curve');
		}
		const edge = edgeBuilder.Edge();
		
		return {
			shape: edge,
			type: 'SPLINE',
			layer
		};
	}

	private createOpenCascadeInsert(entity: any, layer: string): OpenCascadeShape[] | null {
		const { oc } = this;
		
		// INSERT entities use 'block' property for block name
		const blockName = entity.block || entity.name;
		
		if (!blockName || !this.dxfBlocks[blockName]) {
			// Try to find block by name in all blocks
			const blockByName = Object.values(this.dxfBlocks).find((block: any) => 
				block.name === blockName || block.name2 === blockName
			);
			
			if (blockByName) {
				// Use the found block
				const foundBlock = blockByName as any;
				return this.processFoundBlock(foundBlock, entity, layer);
			}
			
			console.warn(`Block reference '${blockName}' not found`);
			return null;
		}

		const block = this.dxfBlocks[blockName];
		return this.processFoundBlock(block, entity, layer);
	}
	
	private processFoundBlock(block: any, entity: any, layer: string): OpenCascadeShape[] {
		const { oc } = this;
		
		if (!block.entities || block.entities.length === 0) {
			console.warn(`Block has no entities`);
			return [];
		}

		// Get transformation parameters for later application in Three.js
		const insertX = entity.position?.x || entity.x || 0;
		const insertY = entity.position?.y || entity.y || 0;
		const insertZ = entity.position?.z || entity.z || 0;
		const scaleX = entity.xScale || 1;
		const scaleY = entity.yScale || 1;
		const scaleZ = entity.zScale || 1;
		const rotation = entity.rotation || 0;
		
		// Get block base point offset
		const blockName = entity.block || entity.name;
		const blockBasePoint = this.blockBasePoints.get(blockName) || { x: 0, y: 0, z: 0 };

		// Process each entity in the block WITHOUT any transformation
		// The transformations will be applied at the Three.js level
		const blockShapes: OpenCascadeShape[] = [];
		for (const blockEntity of block.entities) {
			try {
				// Convert block entity to OpenCascade shape WITHOUT transformation
				const blockShape = this.convertEntityToOpenCascade(blockEntity);
				
				if (blockShape) {
					// Handle both single shapes and arrays (for nested INSERT entities)
					const shapes = Array.isArray(blockShape) ? blockShape : [blockShape];
					
					for (const shape of shapes) {
						// Add transformation metadata to be applied in Three.js
						const transformedShape = {
							...shape,
							insertTransform: {
								translation: { x: insertX, y: insertY, z: insertZ },
								rotation: rotation,
								scale: { x: scaleX, y: scaleY, z: scaleZ },
								blockName: blockName,
								insertHandle: entity.handle,
								blockBasePoint: blockBasePoint // Include base point for Three.js to apply offset
							}
						};
						blockShapes.push(transformedShape);
					}
				}
			} catch (error) {
				console.warn(`Error processing block entity:`, error);
			}
		}

		return blockShapes;
	}

	// Removed transformEntityCoordinates method - no longer needed since
	// transformations are now applied at Three.js level using Groups
}