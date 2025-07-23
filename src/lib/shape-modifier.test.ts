import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ShapeModifier } from '../../src/lib/shape-modifier';
import type { OpenCascadeShape } from '../../src/lib/dxf-to-opencascade';

// Mock OpenCascade
const mockOC = {
  gp_Vec_3: vi.fn().mockImplementation((x, y, z) => ({
    delete: vi.fn(),
    X: () => x,
    Y: () => y,
    Z: () => z
  })),
  gp_Trsf: vi.fn().mockImplementation(() => ({
    SetTranslation_1: vi.fn(),
    delete: vi.fn()
  })),
  BRepBuilderAPI_Transform_2: vi.fn().mockImplementation(() => ({
    Shape: vi.fn().mockReturnValue({ id: 'transformed-shape' }),
    delete: vi.fn()
  })),
  TopExp_Explorer: vi.fn().mockImplementation(() => ({
    Init: vi.fn(),
    More: vi.fn().mockReturnValue(true),
    Current: vi.fn().mockReturnValue({ id: 'current-shape' }),
    Next: vi.fn(),
    delete: vi.fn()
  })),
  TopoDS: {
    Edge_1: vi.fn().mockReturnValue({ id: 'edge-shape' })
  },
  BRep_Tool: {
    Curve_2: vi.fn().mockReturnValue({ id: 'curve-handle' })
  },
  GeomAdaptor_Curve: vi.fn().mockImplementation(() => ({
    Value: vi.fn().mockReturnValue({
      X: () => 10,
      Y: () => 20,
      Z: () => 0,
      delete: vi.fn()
    }),
    GetType: vi.fn().mockReturnValue('GeomAbs_Circle'),
    Circle: vi.fn().mockReturnValue({
      Location: vi.fn().mockReturnValue({
        X: () => 50,
        Y: () => 60,
        Z: () => 0,
        delete: vi.fn()
      }),
      delete: vi.fn()
    }),
    delete: vi.fn()
  })),
  TopAbs_ShapeEnum: {
    TopAbs_EDGE: 'TopAbs_EDGE',
    TopAbs_SHAPE: 'TopAbs_SHAPE'
  },
  GeomAbs_CurveType: {
    GeomAbs_Circle: 'GeomAbs_Circle'
  },
  Bnd_Box: vi.fn().mockImplementation(() => ({
    CornerMin: vi.fn().mockReturnValue({ X: () => 0, Y: () => 0, Z: () => 0 }),
    CornerMax: vi.fn().mockReturnValue({ X: () => 100, Y: () => 100, Z: () => 0 }),
    delete: vi.fn()
  })),
  BRepBndLib: {
    Add: vi.fn()
  }
};

// Mock OpenCascadeService
vi.mock('../../src/lib/opencascade-service.js', () => ({
  default: {
    getInstance: () => ({
      initialize: vi.fn().mockResolvedValue(mockOC)
    })
  }
}));

describe('ShapeModifier', () => {
  let shapeModifier: ShapeModifier;
  let mockLineShape: OpenCascadeShape;
  let mockCircleShape: OpenCascadeShape;

  beforeEach(() => {
    vi.clearAllMocks();
    shapeModifier = new ShapeModifier();
    
    mockLineShape = {
      type: 'LINE',
      shape: { id: 'line-shape' } as any,
      layer: '0'
    };

    mockCircleShape = {
      type: 'CIRCLE',
      shape: { id: 'circle-shape' } as any,
      layer: '0'
    };
  });

  describe('modifyShape', () => {
    it('should modify line shape origin by translating to new position', async () => {
      const shapes = [mockLineShape];
      const modifications = {
        origin: { x: 50, y: 25, z: 0 }
      };

      const result = await shapeModifier.modifyShape(shapes, 0, modifications);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        type: 'LINE',
        layer: '0'
      }));

      // Verify OpenCascade transformation was called
      expect(mockOC.gp_Vec_3).toHaveBeenCalledWith(40, 5, 0); // newOrigin - currentOrigin
      expect(mockOC.gp_Trsf).toHaveBeenCalled();
      expect(mockOC.BRepBuilderAPI_Transform_2).toHaveBeenCalled();
    });

    it('should modify circle shape origin by translating to new center', async () => {
      const shapes = [mockCircleShape];
      const modifications = {
        origin: { x: 100, y: 75, z: 0 }
      };

      const result = await shapeModifier.modifyShape(shapes, 0, modifications);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(expect.objectContaining({
        type: 'CIRCLE',
        layer: '0'
      }));

      // Verify transformation was applied
      expect(mockOC.gp_Vec_3).toHaveBeenCalledWith(50, 15, 0); // newOrigin - currentCenter
      expect(mockOC.gp_Trsf).toHaveBeenCalled();
    });

    it('should handle invalid shape index', async () => {
      const shapes = [mockLineShape];
      const modifications = { origin: { x: 50, y: 25 } };

      await expect(shapeModifier.modifyShape(shapes, 1, modifications))
        .rejects.toThrow('Invalid shape index or OpenCascade not initialized');
    });

    it('should handle empty shapes array', async () => {
      const shapes: OpenCascadeShape[] = [];
      const modifications = { origin: { x: 50, y: 25 } };

      await expect(shapeModifier.modifyShape(shapes, 0, modifications))
        .rejects.toThrow('Invalid shape index or OpenCascade not initialized');
    });

    it('should not modify shape when no origin change requested', async () => {
      const shapes = [mockLineShape];
      const modifications = {
        startPoint: { x: 10, y: 10, z: 0 },
        endPoint: { x: 90, y: 10, z: 0 }
      };

      const result = await shapeModifier.modifyShape(shapes, 0, modifications);

      // Should call line modification logic instead of origin translation
      expect(result).toHaveLength(1);
      expect(mockOC.gp_Vec_3).not.toHaveBeenCalled(); // Translation should not be called
    });

    it('should preserve all shape properties except geometry', async () => {
      const shapes = [mockLineShape];
      const modifications = {
        origin: { x: 25, y: 10, z: 0 }
      };

      const result = await shapeModifier.modifyShape(shapes, 0, modifications);

      expect(result[0]).toEqual(expect.objectContaining({
        type: 'LINE',
        layer: '0'
      }));
    });
  });

  describe('extractGeometricOrigin', () => {
    it('should extract start point for line shapes', async () => {
      // Access the private method for testing
      const extractOrigin = (shapeModifier as any).extractGeometricOrigin.bind(shapeModifier);
      
      // Initialize the modifier first
      await shapeModifier.modifyShape([], 0, {}); // This will initialize OpenCascade

      const origin = extractOrigin(mockLineShape);

      expect(origin).toEqual({ x: 10, y: 20, z: 0 });
      expect(mockOC.TopExp_Explorer).toHaveBeenCalled();
      expect(mockOC.GeomAdaptor_Curve).toHaveBeenCalled();
    });

    it('should extract center point for circle shapes', async () => {
      const extractOrigin = (shapeModifier as any).extractGeometricOrigin.bind(shapeModifier);
      
      // Initialize the modifier first  
      await shapeModifier.modifyShape([], 0, {}).catch(() => {}); // Ignore error for initialization

      const origin = extractOrigin(mockCircleShape);

      expect(origin).toEqual({ x: 50, y: 60, z: 0 });
      expect(mockOC.GeomAdaptor_Curve).toHaveBeenCalled();
    });

    it('should fall back to bounding box center for unknown shape types', async () => {
      const extractOrigin = (shapeModifier as any).extractGeometricOrigin.bind(shapeModifier);
      
      const unknownShape = {
        ...mockLineShape,
        type: 'UNKNOWN'
      };

      await shapeModifier.modifyShape([], 0, {}).catch(() => {});

      const origin = extractOrigin(unknownShape);

      expect(origin).toEqual({ x: 50, y: 50, z: 0 }); // Bounding box center
      expect(mockOC.Bnd_Box).toHaveBeenCalled();
    });
  });

  describe('deleteShape', () => {
    it('should remove shape from array and clean up', () => {
      const shapes = [mockLineShape, mockCircleShape];
      const mockDelete = vi.fn();
      shapes[0].shape.delete = mockDelete;

      const result = shapeModifier.deleteShape(shapes, 0);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockCircleShape);
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should handle invalid shape index for deletion', () => {
      const shapes = [mockLineShape];

      expect(() => shapeModifier.deleteShape(shapes, 1))
        .toThrow('Invalid shape index');
    });

    it('should handle shapes without delete method', () => {
      const shapes = [mockLineShape];
      shapes[0].shape.delete = undefined;

      expect(() => shapeModifier.deleteShape(shapes, 0)).not.toThrow();
    });
  });
});