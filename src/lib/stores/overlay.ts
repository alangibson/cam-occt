/**
 * Drawing Overlay Store
 * Manages stage-specific visual overlays that are displayed on top of the drawing
 */

import { writable } from 'svelte/store';
import type { WorkflowStage } from './workflow';
import type { Point2D, Shape } from '../../types';
import type { ShapeChain } from '../algorithms/chain-detection';

export interface TessellationPoint {
  x: number;
  y: number;
  shapeId: string;
  chainId: string;
}

export interface ShapePoint {
  x: number;
  y: number;
  type: 'origin' | 'start' | 'end';
  shapeId: string;
}

export interface ChainEndpoint {
  x: number;
  y: number;
  type: 'start' | 'end';
  chainId: string;
}

export interface DrawingOverlay {
  stage: WorkflowStage;
  shapePoints: ShapePoint[];
  chainEndpoints: ChainEndpoint[];
  tessellationPoints: TessellationPoint[];
}

export interface OverlayState {
  currentStage: WorkflowStage;
  overlays: Record<WorkflowStage, DrawingOverlay>;
}

function createOverlayStore() {
  const initialState: OverlayState = {
    currentStage: 'import',
    overlays: {
      import: { stage: 'import', shapePoints: [], chainEndpoints: [], tessellationPoints: [] },
      edit: { stage: 'edit', shapePoints: [], chainEndpoints: [], tessellationPoints: [] },
      prepare: { stage: 'prepare', shapePoints: [], chainEndpoints: [], tessellationPoints: [] },
      program: { stage: 'program', shapePoints: [], chainEndpoints: [], tessellationPoints: [] },
      simulate: { stage: 'simulate', shapePoints: [], chainEndpoints: [], tessellationPoints: [] },
      export: { stage: 'export', shapePoints: [], chainEndpoints: [], tessellationPoints: [] }
    }
  };

  const { subscribe, set, update } = writable<OverlayState>(initialState);

  return {
    subscribe,
    
    // Set the current workflow stage
    setCurrentStage: (stage: WorkflowStage) => {
      update(state => ({
        ...state,
        currentStage: stage
      }));
    },

    // Get overlay for current stage
    getCurrentOverlay: () => {
      let currentOverlay: DrawingOverlay | null = null;
      update(state => {
        currentOverlay = state.overlays[state.currentStage];
        return state;
      });
      return currentOverlay;
    },

    // Shape points management (Edit stage)
    setShapePoints: (stage: WorkflowStage, points: ShapePoint[]) => {
      update(state => ({
        ...state,
        overlays: {
          ...state.overlays,
          [stage]: {
            ...state.overlays[stage],
            shapePoints: points
          }
        }
      }));
    },

    clearShapePoints: (stage: WorkflowStage) => {
      update(state => ({
        ...state,
        overlays: {
          ...state.overlays,
          [stage]: {
            ...state.overlays[stage],
            shapePoints: []
          }
        }
      }));
    },

    // Chain endpoints management (Prepare stage)
    setChainEndpoints: (stage: WorkflowStage, endpoints: ChainEndpoint[]) => {
      update(state => ({
        ...state,
        overlays: {
          ...state.overlays,
          [stage]: {
            ...state.overlays[stage],
            chainEndpoints: endpoints
          }
        }
      }));
    },

    clearChainEndpoints: (stage: WorkflowStage) => {
      update(state => ({
        ...state,
        overlays: {
          ...state.overlays,
          [stage]: {
            ...state.overlays[stage],
            chainEndpoints: []
          }
        }
      }));
    },

    // Tessellation points management (Program stage)
    setTessellationPoints: (stage: WorkflowStage, points: TessellationPoint[]) => {
      update(state => ({
        ...state,
        overlays: {
          ...state.overlays,
          [stage]: {
            ...state.overlays[stage],
            tessellationPoints: points
          }
        }
      }));
    },

    clearTessellationPoints: (stage: WorkflowStage) => {
      update(state => ({
        ...state,
        overlays: {
          ...state.overlays,
          [stage]: {
            ...state.overlays[stage],
            tessellationPoints: []
          }
        }
      }));
    },

    // Clear all overlays for a stage
    clearStageOverlay: (stage: WorkflowStage) => {
      update(state => ({
        ...state,
        overlays: {
          ...state.overlays,
          [stage]: {
            stage,
            shapePoints: [],
            chainEndpoints: [],
            tessellationPoints: []
          }
        }
      }));
    },

    // Clear all overlays
    clearAllOverlays: () => {
      update(state => ({
        ...state,
        overlays: Object.keys(state.overlays).reduce((acc, stage) => {
          acc[stage as WorkflowStage] = {
            stage: stage as WorkflowStage,
            shapePoints: [],
            chainEndpoints: [],
            tessellationPoints: []
          };
          return acc;
        }, {} as Record<WorkflowStage, DrawingOverlay>)
      }));
    }
  };
}

export const overlayStore = createOverlayStore();

// Helper functions to generate overlay data
export function generateShapePoints(shapes: Shape[], selectedShapeIds: Set<string>): ShapePoint[] {
  const points: ShapePoint[] = [];
  
  shapes.forEach(shape => {
    if (selectedShapeIds.has(shape.id)) {
      // Generate origin, start, and end points for selected shapes
      const origin = getShapeOrigin(shape);
      const start = getShapeStartPoint(shape);
      const end = getShapeEndPoint(shape);
      
      if (origin) {
        points.push({ ...origin, type: 'origin', shapeId: shape.id });
      }
      if (start) {
        points.push({ ...start, type: 'start', shapeId: shape.id });
      }
      if (end) {
        points.push({ ...end, type: 'end', shapeId: shape.id });
      }
    }
  });
  
  return points;
}

export function generateChainEndpoints(chains: ShapeChain[]): ChainEndpoint[] {
  const endpoints: ChainEndpoint[] = [];
  
  chains.forEach(chain => {
    if (chain.shapes.length === 0) return;
    
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    
    const start = getShapeStartPoint(firstShape);
    const end = getShapeEndPoint(lastShape);
    
    if (start) {
      endpoints.push({ ...start, type: 'start', chainId: chain.id });
    }
    
    if (end && (!start || Math.abs(end.x - start.x) > 0.01 || Math.abs(end.y - start.y) > 0.01)) {
      endpoints.push({ ...end, type: 'end', chainId: chain.id });
    }
  });
  
  return endpoints;
}

// Temporary helper functions - these should be moved to a shared utilities file
function getShapeOrigin(shape: Shape): Point2D | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.start;
    case 'circle':
    case 'arc':
      const circle = shape.geometry as any;
      return circle.center;
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[0] : null;
    case 'ellipse':
      const ellipse = shape.geometry as any;
      return ellipse.center;
    default:
      return null;
  }
}

function getShapeStartPoint(shape: Shape): Point2D | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.start;
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[0] : null;
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
      };
    case 'circle':
      const circle = shape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    case 'ellipse':
      const ellipse = shape.geometry as any;
      // For ellipse arcs, use startParam if available, otherwise start at parameter 0
      const startParam = ellipse.startParam !== undefined ? ellipse.startParam : 0;
      return getEllipsePointAtParameter(ellipse, startParam);
    default:
      return null;
  }
}

function getShapeEndPoint(shape: Shape): Point2D | null {
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      return line.end;
    case 'polyline':
      const polyline = shape.geometry as any;
      return polyline.points.length > 0 ? polyline.points[polyline.points.length - 1] : null;
    case 'arc':
      const arc = shape.geometry as any;
      return {
        x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
        y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
      };
    case 'circle':
      const circle = shape.geometry as any;
      return {
        x: circle.center.x + circle.radius,
        y: circle.center.y
      };
    case 'ellipse':
      const ellipse = shape.geometry as any;
      // For ellipse arcs, use endParam if available, otherwise end at parameter 2π
      const endParam = ellipse.endParam !== undefined ? ellipse.endParam : 2 * Math.PI;
      return getEllipsePointAtParameter(ellipse, endParam);
    default:
      return null;
  }
}

// Helper function to calculate a point on an ellipse at a given parameter
// Uses the ezdxf approach: calculating minor axis using counterclockwise perpendicular
function getEllipsePointAtParameter(ellipse: any, parameter: number): Point2D {
  // IMPORTANT: majorAxisEndpoint is already a VECTOR from center, not an absolute point!
  // This is how DXF stores ellipse data (group codes 11,21,31)
  const majorAxisVector = ellipse.majorAxisEndpoint;
  
  // Calculate major axis length (this is the semi-major axis length)
  const majorAxisLength = Math.sqrt(majorAxisVector.x * majorAxisVector.x + majorAxisVector.y * majorAxisVector.y);
  
  // Calculate minor axis length (this is the semi-minor axis length)
  const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
  
  // Calculate unit vectors
  const majorAxisUnit = {
    x: majorAxisVector.x / majorAxisLength,
    y: majorAxisVector.y / majorAxisLength
  };
  
  // Minor axis is perpendicular to major axis (counterclockwise rotation)
  // This is equivalent to the 2D cross product: z_axis × major_axis (right-hand rule)
  const minorAxisUnit = {
    x: -majorAxisUnit.y,  // counterclockwise perpendicular
    y: majorAxisUnit.x
  };
  
  // Calculate point using parametric ellipse equation from ezdxf
  const cosParam = Math.cos(parameter);
  const sinParam = Math.sin(parameter);
  
  const x = cosParam * majorAxisLength * majorAxisUnit.x + sinParam * minorAxisLength * minorAxisUnit.x;
  const y = cosParam * majorAxisLength * majorAxisUnit.y + sinParam * minorAxisLength * minorAxisUnit.y;
  
  // Translate to ellipse center
  return {
    x: ellipse.center.x + x,
    y: ellipse.center.y + y
  };
}