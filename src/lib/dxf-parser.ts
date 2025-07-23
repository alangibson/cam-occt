import { parseString } from 'dxf';
import * as THREE from 'three';
import type { OpenCascadeInstance } from 'opencascade.js';

export interface DxfEntity {
	type: string;
	geometry: THREE.BufferGeometry;
	layer: string;
}

export class DxfToOpenCascadeConverter {
	private oc: OpenCascadeInstance | null = null;

	constructor(openCascadeInstance?: OpenCascadeInstance) {
		this.oc = openCascadeInstance || null;
	}

	async parseDxf(dxfContent: string): Promise<DxfEntity[]> {
		try {
			const parsed = parseString(dxfContent);
			
			if (!parsed) {
				throw new Error('Failed to parse DXF file');
			}

			const entities: DxfEntity[] = [];
			
			// Process each entity in the DXF file
			for (const entity of parsed.entities) {
				const convertedEntity = this.convertEntity(entity);
				if (convertedEntity) {
					entities.push(convertedEntity);
				}
			}

			return entities;
		} catch (error) {
			console.error('DXF parsing error:', error);
			throw new Error(`Failed to parse DXF: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	private convertEntity(entity: any): DxfEntity | null {
		const layer = entity.layer || '0';
		
		switch (entity.type) {
			case 'LINE':
				return this.createLine(entity, layer);
			case 'POLYLINE':
			case 'LWPOLYLINE':
				return this.createPolyline(entity, layer);
			case 'CIRCLE':
				return this.createCircle(entity, layer);
			case 'ARC':
				return this.createArc(entity, layer);
			case 'SPLINE':
				return this.createSpline(entity, layer);
			default:
				console.warn(`Unsupported DXF entity type: ${entity.type}`);
				return null;
		}
	}

	private createLine(entity: any, layer: string): DxfEntity {
		const points = [
			entity.start.x, entity.start.y, entity.start.z || 0,
			entity.end.x, entity.end.y, entity.end.z || 0
		];
		
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		
		return {
			type: 'LINE',
			geometry,
			layer
		};
	}

	private createPolyline(entity: any, layer: string): DxfEntity {
		const points: number[] = [];
		
		if (entity.vertices) {
			for (const vertex of entity.vertices) {
				points.push(vertex.x, vertex.y, vertex.z || 0);
			}
		}

		// Close the polyline if it's marked as closed
		if (entity.closed && points.length >= 6) {
			points.push(points[0], points[1], points[2]);
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		
		return {
			type: 'POLYLINE',
			geometry,
			layer
		};
	}

	private createCircle(entity: any, layer: string): DxfEntity {
		const geometry = new THREE.CircleGeometry(entity.radius, 32);
		
		// Position the circle
		if (entity.center) {
			geometry.translate(entity.center.x, entity.center.y, entity.center.z || 0);
		}
		
		return {
			type: 'CIRCLE',
			geometry,
			layer
		};
	}

	private createArc(entity: any, layer: string): DxfEntity {
		const startAngle = (entity.startAngle || 0) * Math.PI / 180;
		const endAngle = (entity.endAngle || 0) * Math.PI / 180;
		const thetaLength = endAngle - startAngle;
		
		const geometry = new THREE.CircleGeometry(
			entity.radius, 
			32, 
			startAngle, 
			thetaLength
		);
		
		// Position the arc
		if (entity.center) {
			geometry.translate(entity.center.x, entity.center.y, entity.center.z || 0);
		}
		
		return {
			type: 'ARC',
			geometry,
			layer
		};
	}

	private createSpline(entity: any, layer: string): DxfEntity {
		// Simplified spline handling - create line segments between control points
		const points: number[] = [];
		
		if (entity.controlPoints) {
			for (const point of entity.controlPoints) {
				points.push(point.x, point.y, point.z || 0);
			}
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		
		return {
			type: 'SPLINE',
			geometry,
			layer
		};
	}

	// Convert Three.js geometry to OpenCascade shapes (when OpenCascade is available)
	private createOpenCascadeShape(entity: DxfEntity): any {
		if (!this.oc) {
			console.warn('OpenCascade not available for shape creation');
			return null;
		}

		// TODO: Implement OpenCascade shape creation
		// This would involve using oc.BRepBuilderAPI_MakeEdge, oc.BRepBuilderAPI_MakeWire, etc.
		// based on the entity type and geometry
		
		return null;
	}
}