import * as THREE from 'three';
import type { OpenCascadeInstance } from 'opencascade.js';
import OpenCascadeService from './opencascade-service.js';
import type { OpenCascadeShape } from './dxf-to-opencascade.js';

export interface ThreeJSGeometry {
	geometry: THREE.BufferGeometry;
	isLine: boolean;
	layer: string;
	type: string;
	insertTransform?: {
		translation: { x: number; y: number; z: number };
		rotation: number;
		scale: { x: number; y: number; z: number };
		blockName: string;
		insertHandle: string;
		blockBasePoint?: { x: number; y: number; z: number };
	};
	center?: { x: number; y: number; z: number };
	radius?: number;
	startAngle?: number;
	endAngle?: number;
	shapeIndex: number;
}

export class OpenCascadeToThreeJSConverter {
	private oc: OpenCascadeInstance | null = null;

	constructor() {}

	async initialize(): Promise<void> {
		const service = OpenCascadeService.getInstance();
		this.oc = await service.initialize();
	}

	async convertShapesToThreeJS(shapes: OpenCascadeShape[]): Promise<ThreeJSGeometry[]> {
		if (!this.oc) {
			await this.initialize();
		}

		if (!this.oc) {
			throw new Error('OpenCascade not initialized');
		}

		const geometries: ThreeJSGeometry[] = [];

		for (let i = 0; i < shapes.length; i++) {
			const shape = shapes[i];
			try {
				const geometry = this.convertShapeToThreeJS(shape, i);
				if (geometry) {
					geometries.push(geometry);
				}
			} catch (error) {
				console.error(`Error converting ${shape.type} shape to Three.js:`, error);
			}
		}

		console.log(`Converted ${geometries.length} OpenCascade shapes to Three.js geometries`);
		return geometries;
	}

	private convertShapeToThreeJS(shape: OpenCascadeShape, shapeIndex: number): ThreeJSGeometry | null {
		if (!this.oc) return null;

		const { oc } = this;

		try {
			// For wireframe/line geometries (edges and wires)
			if (this.isLineGeometry(shape)) {
				const points = this.extractPointsFromShape(shape.shape);
				if (points.length === 0) return null;

				const geometry = new THREE.BufferGeometry();
				geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
				
				// Debug logging removed

				return {
					geometry,
					isLine: true,
					layer: shape.layer,
					type: shape.type,
					insertTransform: shape.insertTransform,
					center: shape.center,
					radius: shape.radius,
					startAngle: shape.startAngle,
					endAngle: shape.endAngle,
					shapeIndex: shapeIndex
				};
			}

			// For solid geometries (faces and solids) - create mesh
			const tessellation = this.tessellateShape(shape.shape);
			if (!tessellation) return null;

			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(tessellation.vertices, 3));
			
			if (tessellation.indices.length > 0) {
				geometry.setIndex(tessellation.indices);
			}
			
			if (tessellation.normals.length > 0) {
				geometry.setAttribute('normal', new THREE.Float32BufferAttribute(tessellation.normals, 3));
			}

			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();

			return {
				geometry,
				isLine: false,
				layer: shape.layer,
				type: shape.type,
				insertTransform: shape.insertTransform,
				center: shape.center,
				radius: shape.radius,
				startAngle: shape.startAngle,
				endAngle: shape.endAngle,
				shapeIndex: shapeIndex
			};

		} catch (error) {
			console.error(`Error processing ${shape.type}:`, error);
			return null;
		}
	}

	private isLineGeometry(shape: OpenCascadeShape): boolean {
		// Lines, polylines, arcs, circles, and splines should be rendered as lines
		return ['LINE', 'POLYLINE', 'ARC', 'CIRCLE', 'SPLINE'].includes(shape.type);
	}

	private extractPointsFromShape(shape: any): number[] {
		if (!this.oc) return [];

		const { oc } = this;
		const points: number[] = [];
		let edgeCount = 0;

		try {
			// Create edge explorer to traverse edges
			const edgeExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
			let minX = Infinity, maxX = -Infinity;
			let minY = Infinity, maxY = -Infinity;
			let minZ = Infinity, maxZ = -Infinity;
			
			while (edgeExplorer.More()) {
				const edge = oc.TopoDS.Edge_1(edgeExplorer.Current());
				edgeCount++;
				
				try {
					// Use Adaptor3d_Curve instead of BRep_Tool.Curve for safer access
					const adaptor = new oc.BRepAdaptor_Curve_2(edge);
					const uMin = adaptor.FirstParameter();
					const uMax = adaptor.LastParameter();

					// Sample points along the curve using the adaptor
					const numSamples = 100; // Adjust for curve resolution
					for (let i = 0; i <= numSamples; i++) {
						const u = uMin + (uMax - uMin) * (i / numSamples);
						const point = adaptor.Value(u);
						
						const x = point.X(), y = point.Y(), z = point.Z();
						points.push(x, y, z);
						
						// Track bounds
						minX = Math.min(minX, x);
						maxX = Math.max(maxX, x);
						minY = Math.min(minY, y);
						maxY = Math.max(maxY, y);
						minZ = Math.min(minZ, z);
						maxZ = Math.max(maxZ, z);
					}
				} catch (edgeError) {
					console.warn(`❌ Failed to process edge ${edgeCount}, skipping:`, edgeError);
					// Continue with next edge instead of failing completely
				}

				edgeExplorer.Next();
			}
			
			// Log summary for debugging (removed verbose coordinate bounds)
			if (points.length > 0 && edgeCount <= 3) {
				console.log(`Extracted ${points.length / 3} points from ${edgeCount} edges`);
			}

		} catch (error) {
			console.error('Error extracting points from shape:', error);
		}

		return points;
	}

	private tessellateShape(shape: any): { vertices: number[], indices: number[], normals: number[] } | null {
		if (!this.oc) return null;

		const { oc } = this;

		try {
			// Tessellate the shape
			const mesh = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.1, false);
			
			if (!mesh.IsDone()) {
				console.warn('Tessellation failed');
				return null;
			}

			const vertices: number[] = [];
			const indices: number[] = [];
			const normals: number[] = [];

			// Explore faces
			const faceExplorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);

			while (faceExplorer.More()) {
				const face = oc.TopoDS.Face_1(faceExplorer.Current());
				
				// Get triangulation
				const triangulation = oc.BRep_Tool.Triangulation(face, new oc.TopLoc_Location_1());
				
				if (!triangulation.IsNull()) {
					// Extract vertices
					const nodes = triangulation.Nodes();
					for (let i = 1; i <= nodes.Length(); i++) {
						const node = nodes.Value(i);
						vertices.push(node.X(), node.Y(), node.Z());
					}

					// Extract triangles
					const triangles = triangulation.Triangles();
					const vertexOffset = vertices.length / 3 - nodes.Length();
					
					for (let i = 1; i <= triangles.Length(); i++) {
						const triangle = triangles.Value(i);
						const [n1, n2, n3] = [triangle.Value(1), triangle.Value(2), triangle.Value(3)];
						
						indices.push(
							vertexOffset + n1 - 1,
							vertexOffset + n2 - 1,
							vertexOffset + n3 - 1
						);
					}

					// Compute normals (simplified - using face normal)
					const surface = oc.BRep_Tool.Surface_2(face);
					const uMin = surface.FirstUParameter();
					const uMax = surface.LastUParameter();
					const vMin = surface.FirstVParameter();
					const vMax = surface.LastVParameter();
					
					const uMid = (uMin + uMax) / 2;
					const vMid = (vMin + vMax) / 2;
					
					const normal = surface.DN(uMid, vMid, 0, 1);
					
					// Add same normal for all vertices of this face
					for (let i = 0; i < nodes.Length(); i++) {
						normals.push(normal.X(), normal.Y(), normal.Z());
					}
				}

				faceExplorer.Next();
			}

			return { vertices, indices, normals };

		} catch (error) {
			console.error('Error tessellating shape:', error);
			return null;
		}
	}
}