import { describe, it, expect, beforeEach } from 'vitest';
import {
  GeometryDomainService,
  GeometryModel,
  ShapeType,
  OperationType,
  ValidGeometrySpecification,
  HasShapesSpecification,
  SupportedFileTypeSpecification,
  GeometryId,
  ShapeId,
  GeometryCreatedEvent,
  ShapeModifiedEvent
} from './domain';

describe('Domain Layer', () => {
  let domainService: GeometryDomainService;
  
  beforeEach(() => {
    domainService = new GeometryDomainService();
  });
  
  describe('GeometryDomainService', () => {
    it('should create geometry model from data', () => {
      const data = { shapes: [] };
      const metadata = {
        fileName: 'test.dxf',
        fileType: 'dxf' as const,
        units: 'mm' as const
      };
      
      const geometry = domainService.createGeometry(data, metadata);
      
      expect(geometry.id).toBeDefined();
      expect(geometry.metadata.fileName).toBe('test.dxf');
      expect(geometry.metadata.fileType).toBe('dxf');
      expect(geometry.metadata.units).toBe('mm');
      expect(geometry.version).toBe(1);
      expect(geometry.metadata.createdAt).toBeInstanceOf(Date);
      expect(geometry.metadata.modifiedAt).toBeInstanceOf(Date);
    });
    
    it('should modify shape in geometry', () => {
      const originalGeometry: GeometryModel = {
        id: 'test-id',
        shapes: [{
          id: 'shape-1',
          type: ShapeType.LINE,
          properties: { layer: 'Layer1', visible: true },
          edges: [{
            id: 'edge-1',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 10, y: 0, z: 0 },
            type: 'line'
          }]
        }],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const operation = {
        type: OperationType.TRANSLATE,
        parameters: {
          translation: { x: 5, y: 5, z: 0 }
        }
      };
      
      const modifiedGeometry = domainService.modifyShape(originalGeometry, 'shape-1', operation);
      
      expect(modifiedGeometry.version).toBe(2);
      expect(modifiedGeometry.metadata.modifiedAt).toBeInstanceOf(Date);
      expect(modifiedGeometry.id).toBe(originalGeometry.id);
      expect(modifiedGeometry.shapes.length).toBe(1);
    });
    
    it('should throw error when modifying non-existent shape', () => {
      const geometry: GeometryModel = {
        id: 'test-id',
        shapes: [],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const operation = {
        type: OperationType.TRANSLATE,
        parameters: { translation: { x: 1, y: 1, z: 0 } }
      };
      
      expect(() => {
        domainService.modifyShape(geometry, 'non-existent', operation);
      }).toThrow('Shape with id non-existent not found');
    });
    
    it('should get shape by ID', () => {
      const geometry: GeometryModel = {
        id: 'test-id',
        shapes: [{
          id: 'shape-1',
          type: ShapeType.CIRCLE,
          properties: { layer: 'Layer1', visible: true },
          edges: []
        }],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const shape = domainService.getShape(geometry, 'shape-1');
      expect(shape).toBeDefined();
      expect(shape!.id).toBe('shape-1');
      expect(shape!.type).toBe(ShapeType.CIRCLE);
      
      const nonExistentShape = domainService.getShape(geometry, 'non-existent');
      expect(nonExistentShape).toBeNull();
    });
    
    it('should calculate bounding box for geometry', () => {
      const geometry: GeometryModel = {
        id: 'test-id',
        shapes: [{
          id: 'shape-1',
          type: ShapeType.LINE,
          properties: { layer: 'Layer1', visible: true },
          edges: [{
            id: 'edge-1',
            startPoint: { x: -5, y: -3, z: 0 },
            endPoint: { x: 10, y: 7, z: 2 },
            type: 'line'
          }]
        }],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const boundingBox = domainService.calculateBoundingBox(geometry);
      
      expect(boundingBox.min.x).toBe(-5);
      expect(boundingBox.min.y).toBe(-3);
      expect(boundingBox.min.z).toBe(0);
      expect(boundingBox.max.x).toBe(10);
      expect(boundingBox.max.y).toBe(7);
      expect(boundingBox.max.z).toBe(2);
    });
    
    it('should return zero bounding box for empty geometry', () => {
      const geometry: GeometryModel = {
        id: 'test-id',
        shapes: [],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const boundingBox = domainService.calculateBoundingBox(geometry);
      
      expect(boundingBox.min.x).toBe(0);
      expect(boundingBox.min.y).toBe(0);
      expect(boundingBox.min.z).toBe(0);
      expect(boundingBox.max.x).toBe(0);
      expect(boundingBox.max.y).toBe(0);
      expect(boundingBox.max.z).toBe(0);
    });
    
    describe('Validation', () => {
      it('should validate valid geometry', () => {
        const geometry: GeometryModel = {
          id: 'test-id',
          shapes: [{
            id: 'shape-1',
            type: ShapeType.LINE,
            properties: { layer: 'Layer1', visible: true },
            edges: [{
              id: 'edge-1',
              startPoint: { x: 0, y: 0, z: 0 },
              endPoint: { x: 10, y: 0, z: 0 },
              type: 'line'
            }]
          }],
          metadata: {
            fileName: 'test.dxf',
            fileType: 'dxf',
            units: 'mm',
            boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 0, z: 0 } },
            createdAt: new Date(),
            modifiedAt: new Date()
          },
          version: 1
        };
        
        const validation = domainService.validateGeometry(geometry);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      });
      
      it('should warn about empty geometry', () => {
        const geometry: GeometryModel = {
          id: 'test-id',
          shapes: [],
          metadata: {
            fileName: 'test.dxf',
            fileType: 'dxf',
            units: 'mm',
            boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
            createdAt: new Date(),
            modifiedAt: new Date()
          },
          version: 1
        };
        
        const validation = domainService.validateGeometry(geometry);
        
        expect(validation.isValid).toBe(true);
        expect(validation.warnings).toHaveLength(1);
        expect(validation.warnings[0].code).toBe('EMPTY_GEOMETRY');
      });
      
      it('should error on shapes with no edges', () => {
        const geometry: GeometryModel = {
          id: 'test-id',
          shapes: [{
            id: 'shape-1',
            type: ShapeType.LINE,
            properties: { layer: 'Layer1', visible: true },
            edges: []
          }],
          metadata: {
            fileName: 'test.dxf',
            fileType: 'dxf',
            units: 'mm',
            boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
            createdAt: new Date(),
            modifiedAt: new Date()
          },
          version: 1
        };
        
        const validation = domainService.validateGeometry(geometry);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors).toHaveLength(1);
        expect(validation.errors[0].code).toBe('EMPTY_SHAPE');
        expect(validation.errors[0].shapeId).toBe('shape-1');
      });
      
      it('should warn about disconnected polyline edges', () => {
        const geometry: GeometryModel = {
          id: 'test-id',
          shapes: [{
            id: 'shape-1',
            type: ShapeType.POLYLINE,
            properties: { layer: 'Layer1', visible: true },
            edges: [
              {
                id: 'edge-1',
                startPoint: { x: 0, y: 0, z: 0 },
                endPoint: { x: 10, y: 0, z: 0 },
                type: 'line'
              },
              {
                id: 'edge-2',
                startPoint: { x: 20, y: 0, z: 0 }, // Disconnected from edge-1
                endPoint: { x: 30, y: 0, z: 0 },
                type: 'line'
              }
            ]
          }],
          metadata: {
            fileName: 'test.dxf',
            fileType: 'dxf',
            units: 'mm',
            boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 30, y: 0, z: 0 } },
            createdAt: new Date(),
            modifiedAt: new Date()
          },
          version: 1
        };
        
        const validation = domainService.validateGeometry(geometry);
        
        expect(validation.isValid).toBe(true);
        expect(validation.warnings).toHaveLength(1);
        expect(validation.warnings[0].code).toBe('DISCONNECTED_EDGES');
        expect(validation.warnings[0].shapeId).toBe('shape-1');
      });
    });
  });
  
  describe('Value Objects', () => {
    describe('GeometryId', () => {
      it('should create valid geometry ID', () => {
        const id = new GeometryId('test-geometry-123');
        expect(id.toString()).toBe('test-geometry-123');
      });
      
      it('should throw error for empty ID', () => {
        expect(() => new GeometryId('')).toThrow('GeometryId cannot be empty');
        expect(() => new GeometryId('   ')).toThrow('GeometryId cannot be empty');
      });
      
      it('should compare IDs correctly', () => {
        const id1 = new GeometryId('test-123');
        const id2 = new GeometryId('test-123');
        const id3 = new GeometryId('test-456');
        
        expect(id1.equals(id2)).toBe(true);
        expect(id1.equals(id3)).toBe(false);
      });
    });
    
    describe('ShapeId', () => {
      it('should create valid shape ID', () => {
        const id = new ShapeId('shape-456');
        expect(id.toString()).toBe('shape-456');
      });
      
      it('should throw error for empty ID', () => {
        expect(() => new ShapeId('')).toThrow('ShapeId cannot be empty');
      });
    });
  });
  
  describe('Domain Events', () => {
    it('should create geometry created event', () => {
      const geometry: GeometryModel = {
        id: 'test-id',
        shapes: [],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const event = new GeometryCreatedEvent(geometry);
      
      expect(event.eventType).toBe('geometry.created');
      expect(event.geometry).toBe(geometry);
      expect(event.occurredAt).toBeInstanceOf(Date);
      expect(event.eventId).toBeDefined();
    });
    
    it('should create shape modified event', () => {
      const operation = {
        type: OperationType.TRANSLATE,
        parameters: { translation: { x: 1, y: 1, z: 0 } }
      };
      
      const event = new ShapeModifiedEvent('geo-1', 'shape-1', operation, 1, 2);
      
      expect(event.eventType).toBe('shape.modified');
      expect(event.geometryId).toBe('geo-1');
      expect(event.shapeId).toBe('shape-1');
      expect(event.operation).toBe(operation);
      expect(event.previousVersion).toBe(1);
      expect(event.newVersion).toBe(2);
    });
  });
  
  describe('Specifications', () => {
    it('should validate geometry using valid geometry specification', () => {
      const validGeometry: GeometryModel = {
        id: 'test-id',
        shapes: [{
          id: 'shape-1',
          type: ShapeType.LINE,
          properties: { layer: 'Layer1', visible: true },
          edges: [{
            id: 'edge-1',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 10, y: 0, z: 0 },
            type: 'line'
          }]
        }],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const spec = new ValidGeometrySpecification();
      expect(spec.isSatisfiedBy(validGeometry)).toBe(true);
    });
    
    it('should check if geometry has shapes', () => {
      const geometryWithShapes: GeometryModel = {
        id: 'test-id',
        shapes: [{ id: 'shape-1', type: ShapeType.LINE, properties: { layer: 'Layer1', visible: true }, edges: [] }],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const emptyGeometry: GeometryModel = {
        ...geometryWithShapes,
        shapes: []
      };
      
      const spec = new HasShapesSpecification();
      expect(spec.isSatisfiedBy(geometryWithShapes)).toBe(true);
      expect(spec.isSatisfiedBy(emptyGeometry)).toBe(false);
    });
    
    it('should check supported file types', () => {
      const dxfGeometry: GeometryModel = {
        id: 'test-id',
        shapes: [],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const spec = new SupportedFileTypeSpecification();
      expect(spec.isSatisfiedBy(dxfGeometry)).toBe(true);
    });
    
    it('should combine specifications with logical operators', () => {
      const geometry: GeometryModel = {
        id: 'test-id',
        shapes: [{
          id: 'shape-1',
          type: ShapeType.LINE,
          properties: { layer: 'Layer1', visible: true },
          edges: [{
            id: 'edge-1',
            startPoint: { x: 0, y: 0, z: 0 },
            endPoint: { x: 10, y: 0, z: 0 },
            type: 'line'
          }]
        }],
        metadata: {
          fileName: 'test.dxf',
          fileType: 'dxf',
          units: 'mm',
          boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 0, z: 0 } },
          createdAt: new Date(),
          modifiedAt: new Date()
        },
        version: 1
      };
      
      const validSpec = new ValidGeometrySpecification();
      const hasShapesSpec = new HasShapesSpecification();
      const supportedTypeSpec = new SupportedFileTypeSpecification();
      
      const combinedSpec = validSpec.and(hasShapesSpec).and(supportedTypeSpec);
      expect(combinedSpec.isSatisfiedBy(geometry)).toBe(true);
      
      const emptyGeometry = { ...geometry, shapes: [] };
      expect(combinedSpec.isSatisfiedBy(emptyGeometry)).toBe(false);
    });
  });
});