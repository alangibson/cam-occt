/**
 * Domain layer - Business logic and domain models
 * Contains pure business logic without external dependencies
 */

import * as THREE from 'three';

/**
 * Domain models
 */
export interface GeometryModel {
  readonly id: string;
  readonly shapes: OpenCascadeShape[];
  readonly metadata: GeometryMetadata;
  readonly version: number;
}

export interface OpenCascadeShape {
  readonly id: string;
  readonly type: ShapeType;
  readonly properties: ShapeProperties;
  readonly edges: Edge[];
  readonly faces?: Face[];
}

export interface GeometryMetadata {
  readonly fileName: string;
  readonly fileType: 'dxf' | 'svg';
  readonly units: 'mm' | 'inches' | 'meters';
  readonly boundingBox: BoundingBox;
  readonly createdAt: Date;
  readonly modifiedAt: Date;
}

export interface BoundingBox {
  readonly min: Point3D;
  readonly max: Point3D;
}

export interface Point3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface Edge {
  readonly id: string;
  readonly startPoint: Point3D;
  readonly endPoint: Point3D;
  readonly type: 'line' | 'arc' | 'spline';
  readonly parameters?: EdgeParameters;
}

export interface Face {
  readonly id: string;
  readonly edges: string[]; // Edge IDs
  readonly area: number;
  readonly normal: Point3D;
}

export interface EdgeParameters {
  readonly center?: Point3D;
  readonly radius?: number;
  readonly startAngle?: number;
  readonly endAngle?: number;
  readonly controlPoints?: Point3D[];
}

export interface ShapeProperties {
  readonly layer: string;
  readonly color?: string;
  readonly lineWidth?: number;
  readonly visible: boolean;
}

export enum ShapeType {
  LINE = 'line',
  POLYLINE = 'polyline',
  CIRCLE = 'circle',
  ARC = 'arc',
  SPLINE = 'spline',
  BLOCK = 'block'
}

/**
 * Domain operations interface
 */
export interface GeometryOperations {
  /**
   * Create geometry model from raw data
   */
  createGeometry(data: any, metadata: Partial<GeometryMetadata>): GeometryModel;
  
  /**
   * Modify shape within geometry
   */
  modifyShape(geometry: GeometryModel, shapeId: string, operation: ShapeOperation): GeometryModel;
  
  /**
   * Get shape by ID
   */
  getShape(geometry: GeometryModel, shapeId: string): OpenCascadeShape | null;
  
  /**
   * Calculate bounding box for geometry
   */
  calculateBoundingBox(geometry: GeometryModel): BoundingBox;
  
  /**
   * Validate geometry model
   */
  validateGeometry(geometry: GeometryModel): ValidationResult;
}

/**
 * Shape modification operations
 */
export interface ShapeOperation {
  readonly type: OperationType;
  readonly parameters: OperationParameters;
}

export enum OperationType {
  TRANSLATE = 'translate',
  ROTATE = 'rotate',
  SCALE = 'scale',
  MIRROR = 'mirror',
  OFFSET = 'offset',
  BOOLEAN_UNION = 'boolean_union',
  BOOLEAN_SUBTRACT = 'boolean_subtract',
  BOOLEAN_INTERSECT = 'boolean_intersect'
}

export interface OperationParameters {
  readonly translation?: Point3D;
  readonly rotation?: { axis: Point3D; angle: number };
  readonly scale?: { factor: number; center?: Point3D };
  readonly mirror?: { plane: Point3D; normal: Point3D };
  readonly offset?: { distance: number; direction: 'inward' | 'outward' };
  readonly targetShapeId?: string; // For boolean operations
}

/**
 * Validation result
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ValidationError[];
  readonly warnings: ValidationWarning[];
}

export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly shapeId?: string;
  readonly severity: 'error';
}

export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly shapeId?: string;
  readonly severity: 'warning';
}

/**
 * Domain events
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date = new Date();
  public readonly eventId: string = crypto.randomUUID();
  
  constructor(public readonly eventType: string) {}
}

export class GeometryCreatedEvent extends DomainEvent {
  constructor(public readonly geometry: GeometryModel) {
    super('geometry.created');
  }
}

export class ShapeModifiedEvent extends DomainEvent {
  constructor(
    public readonly geometryId: string,
    public readonly shapeId: string,
    public readonly operation: ShapeOperation,
    public readonly previousVersion: number,
    public readonly newVersion: number
  ) {
    super('shape.modified');
  }
}

export class ValidationFailedEvent extends DomainEvent {
  constructor(
    public readonly geometryId: string,
    public readonly validationResult: ValidationResult
  ) {
    super('validation.failed');
  }
}

/**
 * Value objects for immutable data
 */
export class GeometryId {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('GeometryId cannot be empty');
    }
  }
  
  toString(): string {
    return this.value;
  }
  
  equals(other: GeometryId): boolean {
    return this.value === other.value;
  }
}

export class ShapeId {
  constructor(private readonly value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ShapeId cannot be empty');
    }
  }
  
  toString(): string {
    return this.value;
  }
  
  equals(other: ShapeId): boolean {
    return this.value === other.value;
  }
}

/**
 * Domain services
 */
export class GeometryDomainService implements GeometryOperations {
  createGeometry(data: any, metadata: Partial<GeometryMetadata>): GeometryModel {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const fullMetadata: GeometryMetadata = {
      fileName: metadata.fileName || 'unknown',
      fileType: metadata.fileType || 'dxf',
      units: metadata.units || 'mm',
      boundingBox: metadata.boundingBox || { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      createdAt: now,
      modifiedAt: now
    };
    
    // Convert raw data to OpenCascade shapes
    const shapes = this.convertDataToShapes(data);
    
    return {
      id,
      shapes,
      metadata: fullMetadata,
      version: 1
    };
  }
  
  modifyShape(geometry: GeometryModel, shapeId: string, operation: ShapeOperation): GeometryModel {
    const shape = this.getShape(geometry, shapeId);
    if (!shape) {
      throw new Error(`Shape with id ${shapeId} not found`);
    }
    
    const modifiedShape = this.applyOperation(shape, operation);
    const updatedShapes = geometry.shapes.map(s => 
      s.id === shapeId ? modifiedShape : s
    );
    
    return {
      ...geometry,
      shapes: updatedShapes,
      metadata: {
        ...geometry.metadata,
        modifiedAt: new Date()
      },
      version: geometry.version + 1
    };
  }
  
  getShape(geometry: GeometryModel, shapeId: string): OpenCascadeShape | null {
    return geometry.shapes.find(s => s.id === shapeId) || null;
  }
  
  calculateBoundingBox(geometry: GeometryModel): BoundingBox {
    if (geometry.shapes.length === 0) {
      return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (const shape of geometry.shapes) {
      for (const edge of shape.edges) {
        const points = [edge.startPoint, edge.endPoint];
        
        for (const point of points) {
          minX = Math.min(minX, point.x);
          minY = Math.min(minY, point.y);
          minZ = Math.min(minZ, point.z);
          maxX = Math.max(maxX, point.x);
          maxY = Math.max(maxY, point.y);
          maxZ = Math.max(maxZ, point.z);
        }
      }
    }
    
    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }
  
  validateGeometry(geometry: GeometryModel): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Validate shapes exist
    if (geometry.shapes.length === 0) {
      warnings.push({
        code: 'EMPTY_GEOMETRY',
        message: 'Geometry contains no shapes',
        severity: 'warning'
      });
    }
    
    // Validate each shape
    for (const shape of geometry.shapes) {
      if (shape.edges.length === 0) {
        errors.push({
          code: 'EMPTY_SHAPE',
          message: 'Shape contains no edges',
          shapeId: shape.id,
          severity: 'error'
        });
      }
      
      // Validate edge connectivity for polylines
      if (shape.type === ShapeType.POLYLINE && shape.edges.length > 1) {
        for (let i = 0; i < shape.edges.length - 1; i++) {
          const currentEdge = shape.edges[i];
          const nextEdge = shape.edges[i + 1];
          
          if (!this.pointsEqual(currentEdge.endPoint, nextEdge.startPoint)) {
            warnings.push({
              code: 'DISCONNECTED_EDGES',
              message: 'Polyline edges are not connected',
              shapeId: shape.id,
              severity: 'warning'
            });
            break;
          }
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  private convertDataToShapes(data: any): OpenCascadeShape[] {
    // This would be implemented with actual OpenCascade.js integration
    // For now, return mock shapes
    return [];
  }
  
  private applyOperation(shape: OpenCascadeShape, operation: ShapeOperation): OpenCascadeShape {
    // This would be implemented with actual OpenCascade.js operations
    // For now, return the shape unchanged
    return {
      ...shape,
      properties: {
        ...shape.properties,
        // Mark as modified
      }
    };
  }
  
  private pointsEqual(p1: Point3D, p2: Point3D, tolerance: number = 1e-6): boolean {
    return Math.abs(p1.x - p2.x) < tolerance &&
           Math.abs(p1.y - p2.y) < tolerance &&
           Math.abs(p1.z - p2.z) < tolerance;
  }
}

/**
 * Domain specifications (business rules)
 */
export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
}

export abstract class CompositeSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;
  
  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }
  
  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }
  
  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

class AndSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }
  
  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }
}

class OrSpecification<T> extends CompositeSpecification<T> {
  constructor(
    private left: Specification<T>,
    private right: Specification<T>
  ) {
    super();
  }
  
  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }
}

class NotSpecification<T> extends CompositeSpecification<T> {
  constructor(private spec: Specification<T>) {
    super();
  }
  
  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }
}

/**
 * Geometry specifications
 */
export class ValidGeometrySpecification extends CompositeSpecification<GeometryModel> {
  isSatisfiedBy(geometry: GeometryModel): boolean {
    const validation = new GeometryDomainService().validateGeometry(geometry);
    return validation.isValid;
  }
}

export class HasShapesSpecification extends CompositeSpecification<GeometryModel> {
  isSatisfiedBy(geometry: GeometryModel): boolean {
    return geometry.shapes.length > 0;
  }
}

export class SupportedFileTypeSpecification extends CompositeSpecification<GeometryModel> {
  private readonly supportedTypes = ['dxf', 'svg'];
  
  isSatisfiedBy(geometry: GeometryModel): boolean {
    return this.supportedTypes.includes(geometry.metadata.fileType);
  }
}