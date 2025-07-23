import type { OpenCascadeInstance } from 'opencascade.js';
import OpenCascadeService from './opencascade-service.js';
import type { OpenCascadeShape } from './dxf-to-opencascade.js';

export interface ShapeModification {
  shapeIndex: number;
  modifications: {
    startPoint?: { x: number; y: number; z?: number };
    endPoint?: { x: number; y: number; z?: number };
    origin?: { x: number; y: number; z?: number };
  };
}

export class ShapeModifier {
  private oc: OpenCascadeInstance | null = null;

  constructor() {}

  async initialize(): Promise<void> {
    const service = OpenCascadeService.getInstance();
    this.oc = await service.initialize();
  }

  /**
   * Modify an OpenCascade shape based on new property values
   */
  async modifyShape(
    originalShapes: OpenCascadeShape[], 
    shapeIndex: number, 
    modifications: ShapeModification['modifications']
  ): Promise<OpenCascadeShape[]> {
    console.log('🔧 ShapeModifier.modifyShape called');
    console.log('Shape index:', shapeIndex);
    console.log('Original shapes count:', originalShapes.length);
    console.log('Modifications:', modifications);
    
    if (!this.oc) {
      console.log('🔧 Initializing OpenCascade...');
      await this.initialize();
    }

    if (!this.oc || shapeIndex < 0 || shapeIndex >= originalShapes.length) {
      const error = `Invalid shape index (${shapeIndex}) or OpenCascade not initialized. Shapes count: ${originalShapes.length}`;
      console.error('❌', error);
      throw new Error(error);
    }

    // Create a copy of the shapes array
    const modifiedShapes = [...originalShapes];
    const targetShape = modifiedShapes[shapeIndex];
    
    console.log('🔧 Target shape:', targetShape.type, targetShape);

    try {
      // If origin modification is requested, apply translation to the shape
      if (modifications.origin) {
        console.log('🔧 Applying origin modification to', targetShape.type);
        console.log('New origin:', modifications.origin);
        const newShape = await this.translateShapeToOrigin(targetShape, modifications.origin);
        modifiedShapes[shapeIndex] = newShape;
        console.log('✅ Origin modification completed');
        return modifiedShapes;
      }
      
      // Handle other modifications based on entity type
      switch (targetShape.type) {
        case 'LINE':
          if (modifications.startPoint || modifications.endPoint) {
            const newShape = await this.modifyLineShape(targetShape, modifications);
            modifiedShapes[shapeIndex] = newShape;
          }
          break;
          
        case 'CIRCLE':
          // Circle-specific modifications would go here
          break;
          
        case 'ARC':
          if (modifications.startPoint || modifications.endPoint) {
            const newShape = await this.modifyArcShape(targetShape, modifications);
            modifiedShapes[shapeIndex] = newShape;
          }
          break;
          
        default:
          console.warn(`Shape modification not supported for type: ${targetShape.type}`);
          break;
      }

      return modifiedShapes;
    } catch (error) {
      console.error('Error modifying shape:', error);
      throw error;
    }
  }

  private async translateShapeToOrigin(
    originalShape: OpenCascadeShape, 
    newOrigin: { x: number; y: number; z?: number }
  ): Promise<OpenCascadeShape> {
    if (!this.oc) throw new Error('OpenCascade not initialized');

    try {
      // Get the current geometric origin based on shape type
      const currentOrigin = this.extractGeometricOrigin(originalShape);
      
      console.log('🎯 translateShapeToOrigin');
      console.log('Current origin:', currentOrigin);
      console.log('New origin:', newOrigin);
      
      // Calculate translation vector from current origin to new origin  
      const dx = newOrigin.x - currentOrigin.x;
      const dy = newOrigin.y - currentOrigin.y;
      const dz = (newOrigin.z || 0) - currentOrigin.z;
      
      console.log('Translation vector:', { dx, dy, dz });
      
      const translationVector = new this.oc.gp_Vec_4(dx, dy, dz);
      
      // Create transformation
      const transformation = new this.oc.gp_Trsf();
      transformation.SetTranslation_1(translationVector);
      
      // Apply transformation
      const brepTransform = new this.oc.BRepBuilderAPI_Transform_2(
        originalShape.shape,
        transformation,
        true
      );
      
      const transformedShape = brepTransform.Shape();
      
      // Clean up
      translationVector.delete();
      transformation.delete();
      brepTransform.delete();
      
      // CRITICAL FIX: Update DXF metadata to reflect the transformation
      const updatedShapeData = { ...originalShape, shape: transformedShape };
      
      // Update shape-specific geometric properties based on the translation
      switch (originalShape.type) {
        case 'LINE': {
          if (originalShape.startPoint && originalShape.endPoint) {
            updatedShapeData.startPoint = {
              x: originalShape.startPoint.x + dx,
              y: originalShape.startPoint.y + dy,
              z: (originalShape.startPoint.z || 0) + dz
            };
            updatedShapeData.endPoint = {
              x: originalShape.endPoint.x + dx,
              y: originalShape.endPoint.y + dy,
              z: (originalShape.endPoint.z || 0) + dz
            };
          }
          break;
        }
        case 'CIRCLE':
        case 'ARC': {
          if (originalShape.center) {
            updatedShapeData.center = {
              x: originalShape.center.x + dx,
              y: originalShape.center.y + dy,
              z: (originalShape.center.z || 0) + dz
            };
          }
          break;
        }
        default: {
          // For other shapes, we might not have specific metadata to update
          console.log(`Translation applied to ${originalShape.type} shape - metadata may need manual handling`);
          break;
        }
      }
      
      console.log('✅ Shape transformed and metadata updated');
      console.log('Updated shape data:', {
        type: updatedShapeData.type,
        startPoint: updatedShapeData.startPoint,
        endPoint: updatedShapeData.endPoint,
        center: updatedShapeData.center
      });
      
      return updatedShapeData;
    } catch (error) {
      console.error('Error translating shape:', error);
      throw error;
    }
  }

  /**
   * Extract the geometric origin from an OpenCascade shape based on its type
   * Uses actual DXF geometry data when available, falls back to OpenCascade queries, then bounding box
   */
  private extractGeometricOrigin(shape: OpenCascadeShape): { x: number; y: number; z: number } {
    try {
      // Priority 1: Use original DXF geometry data (most accurate)
      switch (shape.type) {
        case 'LINE': {
          if (shape.startPoint) {
            // Use actual DXF start point - this matches what the UI displays
            return { 
              x: shape.startPoint.x, 
              y: shape.startPoint.y, 
              z: shape.startPoint.z || 0 
            };
          }
          break;
        }
        case 'CIRCLE':
        case 'ARC': {
          if (shape.center) {
            // Use actual DXF center point
            return {
              x: shape.center.x,
              y: shape.center.y,
              z: shape.center.z || 0
            };
          }
          break;
        }
      }

      // Priority 2: Try OpenCascade geometry queries (if OpenCascade is available)
      if (this.oc) {
        // Could implement curve parameter extraction here in the future
        console.log('Could use OpenCascade curve queries for', shape.type);
      }

      // Priority 3: Fall back to bounding box (least accurate, but better than nothing)
      return this.extractBoundingBoxOrigin(shape);
      
    } catch (error) {
      console.error('Error extracting geometric origin:', error);
      // Final fallback
      return { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * Fallback method: extract origin from bounding box
   * Only used when DXF geometry data is not available
   */
  private extractBoundingBoxOrigin(shape: OpenCascadeShape): { x: number; y: number; z: number } {
    if (!this.oc) {
      console.warn('OpenCascade not available for bounding box calculation');
      return { x: 0, y: 0, z: 0 };
    }

    try {
      // Get the bounding box
      const bndBox = new this.oc.Bnd_Box();
      this.oc.BRepBndLib.Add(shape.shape, bndBox, false);
      
      const xMin = bndBox.CornerMin().X();
      const yMin = bndBox.CornerMin().Y();
      const zMin = bndBox.CornerMin().Z();
      const xMax = bndBox.CornerMax().X();
      const yMax = bndBox.CornerMax().Y();
      const zMax = bndBox.CornerMax().Z();
      
      let origin: { x: number; y: number; z: number };
      
      switch (shape.type) {
        case 'LINE': {
          // For lines, use the start corner of bounding box as approximation
          origin = { x: xMin, y: yMin, z: zMin };
          break;
        }
        case 'CIRCLE':
        case 'ARC': {
          // For circles/arcs, use center of bounding box
          origin = {
            x: (xMin + xMax) / 2,
            y: (yMin + yMax) / 2,
            z: (zMin + zMax) / 2
          };
          break;
        }
        default: {
          // For other shapes, use center of bounding box
          origin = {
            x: (xMin + xMax) / 2,
            y: (yMin + yMax) / 2,
            z: (zMin + zMax) / 2
          };
          break;
        }
      }
      
      bndBox.delete();
      return origin;
      
    } catch (error) {
      console.error('Error extracting bounding box origin:', error);
      return { x: 0, y: 0, z: 0 };
    }
  }

  private async modifyLineShape(
    originalShape: OpenCascadeShape, 
    modifications: ShapeModification['modifications']
  ): Promise<OpenCascadeShape> {
    if (!this.oc) throw new Error('OpenCascade not initialized');

    try {
      // Extract current line endpoints from the original shape
      // This is a simplified approach - in a real implementation, you'd extract from the OpenCascade edge
      const currentStart = modifications.startPoint || { x: 0, y: 0, z: 0 };
      const currentEnd = modifications.endPoint || { x: 10, y: 10, z: 0 };

      // Create new line with modified endpoints
      // Create points using gp_Pnt_3 constructor (matching existing code pattern)
      const startPoint = new this.oc.gp_Pnt_3(currentStart.x, currentStart.y, currentStart.z || 0);
      const endPoint = new this.oc.gp_Pnt_3(currentEnd.x, currentEnd.y, currentEnd.z || 0);

      // Create new edge
      const edgeBuilder = new this.oc.BRepBuilderAPI_MakeEdge_3(startPoint, endPoint);
      const newEdge = edgeBuilder.Edge();

      // Clean up temporary objects
      startPoint.delete();
      endPoint.delete();
      edgeBuilder.delete();

      return {
        ...originalShape,
        shape: newEdge
      };
    } catch (error) {
      console.error('Error modifying line shape:', error);
      throw error;
    }
  }

  private async modifyCircleShape(
    originalShape: OpenCascadeShape, 
    modifications: ShapeModification['modifications']
  ): Promise<OpenCascadeShape> {
    if (!this.oc) throw new Error('OpenCascade not initialized');

    // For now, just return the original shape
    // TODO: Implement circle modification
    console.warn('Circle modification not yet implemented');
    return originalShape;
  }

  private async modifyArcShape(
    originalShape: OpenCascadeShape, 
    modifications: ShapeModification['modifications']
  ): Promise<OpenCascadeShape> {
    if (!this.oc) throw new Error('OpenCascade not initialized');

    // For now, just return the original shape
    // TODO: Implement arc modification
    console.warn('Arc modification not yet implemented');
    return originalShape;
  }

  /**
   * Delete a shape from the collection
   */
  deleteShape(shapes: OpenCascadeShape[], shapeIndex: number): OpenCascadeShape[] {
    if (shapeIndex < 0 || shapeIndex >= shapes.length) {
      throw new Error('Invalid shape index');
    }

    // Clean up the OpenCascade shape object if needed
    const targetShape = shapes[shapeIndex];
    if (targetShape.shape && typeof targetShape.shape.delete === 'function') {
      targetShape.shape.delete();
    }

    // Return new array without the deleted shape
    return shapes.filter((_, index) => index !== shapeIndex);
  }
}