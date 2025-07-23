import { writable } from 'svelte/store';
import type { Drawing, Shape, Point2D } from '../../types';

interface DrawingState {
  drawing: Drawing | null;
  selectedShapes: Set<string>;
  hoveredShape: string | null;
  isDragging: boolean;
  dragStart: Point2D | null;
  scale: number;
  offset: Point2D;
  fileName: string | null;
  layerVisibility: { [layerName: string]: boolean };
  displayUnit: 'mm' | 'inch';
}

function createDrawingStore() {
  const { subscribe, set, update } = writable<DrawingState>({
    drawing: null,
    selectedShapes: new Set(),
    hoveredShape: null,
    isDragging: false,
    dragStart: null,
    scale: 1,
    offset: { x: 0, y: 0 },
    fileName: null,
    layerVisibility: {},
    displayUnit: 'mm'
  });

  return {
    subscribe,
    setDrawing: (drawing: Drawing, fileName?: string) => update(state => ({ 
      ...state, 
      drawing,
      fileName: fileName || null,
      displayUnit: drawing.units, // Set display unit from drawing's detected units
      scale: 1, // Always start at 100% zoom
      offset: { x: 0, y: 0 } // Reset offset
    })),
    
    selectShape: (shapeId: string, multi = false) => update(state => {
      const selectedShapes = new Set(multi ? state.selectedShapes : []);
      selectedShapes.add(shapeId);
      return { ...state, selectedShapes };
    }),
    
    deselectShape: (shapeId: string) => update(state => {
      const selectedShapes = new Set(state.selectedShapes);
      selectedShapes.delete(shapeId);
      return { ...state, selectedShapes };
    }),
    
    clearSelection: () => update(state => ({
      ...state,
      selectedShapes: new Set()
    })),
    
    deleteSelected: () => update(state => {
      if (!state.drawing) return state;
      
      const shapes = state.drawing.shapes.filter(
        shape => !state.selectedShapes.has(shape.id)
      );
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes },
        selectedShapes: new Set()
      };
    }),
    
    moveShapes: (shapeIds: string[], delta: Point2D) => update(state => {
      if (!state.drawing) return state;
      
      const shapes = state.drawing.shapes.map(shape => {
        if (shapeIds.includes(shape.id)) {
          return moveShape(shape, delta);
        }
        return shape;
      });
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes }
      };
    }),
    
    scaleShapes: (shapeIds: string[], scaleFactor: number, origin: Point2D) => update(state => {
      if (!state.drawing) return state;
      
      const shapes = state.drawing.shapes.map(shape => {
        if (shapeIds.includes(shape.id)) {
          return scaleShape(shape, scaleFactor, origin);
        }
        return shape;
      });
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes }
      };
    }),
    
    rotateShapes: (shapeIds: string[], angle: number, origin: Point2D) => update(state => {
      if (!state.drawing) return state;
      
      const shapes = state.drawing.shapes.map(shape => {
        if (shapeIds.includes(shape.id)) {
          return rotateShape(shape, angle, origin);
        }
        return shape;
      });
      
      return {
        ...state,
        drawing: { ...state.drawing, shapes }
      };
    }),
    
    setViewTransform: (scale: number, offset: Point2D) => update(state => ({
      ...state,
      scale,
      offset
    })),
    
    setLayerVisibility: (layerName: string, visible: boolean) => update(state => ({
      ...state,
      layerVisibility: {
        ...state.layerVisibility,
        [layerName]: visible
      }
    })),
    
    setHoveredShape: (shapeId: string | null) => update(state => ({
      ...state,
      hoveredShape: shapeId
    })),
    
    setDisplayUnit: (unit: 'mm' | 'inch') => update(state => ({
      ...state,
      displayUnit: unit
    }))
  };
}

function moveShape(shape: Shape, delta: Point2D): Shape {
  const moved = { ...shape };
  
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      moved.geometry = {
        start: { x: line.start.x + delta.x, y: line.start.y + delta.y },
        end: { x: line.end.x + delta.x, y: line.end.y + delta.y }
      };
      break;
      
    case 'circle':
    case 'arc':
      const circle = shape.geometry as any;
      moved.geometry = {
        ...circle,
        center: { x: circle.center.x + delta.x, y: circle.center.y + delta.y }
      };
      break;
      
    case 'polyline':
      const polyline = shape.geometry as any;
      moved.geometry = {
        ...polyline,
        points: polyline.points.map((p: Point2D) => ({
          x: p.x + delta.x,
          y: p.y + delta.y
        })),
        // Also update vertices array if it exists (for bulge-aware polylines)
        vertices: polyline.vertices ? polyline.vertices.map((v: any) => ({
          x: v.x + delta.x,
          y: v.y + delta.y,
          bulge: v.bulge || 0
        })) : undefined
      };
      break;
  }
  
  return moved;
}

function scaleShape(shape: Shape, scaleFactor: number, origin: Point2D): Shape {
  const scaled = { ...shape };
  
  const scalePoint = (p: Point2D): Point2D => ({
    x: origin.x + (p.x - origin.x) * scaleFactor,
    y: origin.y + (p.y - origin.y) * scaleFactor
  });
  
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      scaled.geometry = {
        start: scalePoint(line.start),
        end: scalePoint(line.end)
      };
      break;
      
    case 'circle':
    case 'arc':
      const circle = shape.geometry as any;
      scaled.geometry = {
        ...circle,
        center: scalePoint(circle.center),
        radius: circle.radius * scaleFactor
      };
      break;
      
    case 'polyline':
      const polyline = shape.geometry as any;
      scaled.geometry = {
        ...polyline,
        points: polyline.points.map(scalePoint),
        // Also update vertices array if it exists (for bulge-aware polylines)
        vertices: polyline.vertices ? polyline.vertices.map((v: any) => ({
          ...scalePoint({ x: v.x, y: v.y }),
          bulge: v.bulge || 0
        })) : undefined
      };
      break;
  }
  
  return scaled;
}

function rotateShape(shape: Shape, angle: number, origin: Point2D): Shape {
  const rotated = { ...shape };
  
  const rotatePoint = (p: Point2D): Point2D => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = p.x - origin.x;
    const dy = p.y - origin.y;
    
    return {
      x: origin.x + dx * cos - dy * sin,
      y: origin.y + dx * sin + dy * cos
    };
  };
  
  switch (shape.type) {
    case 'line':
      const line = shape.geometry as any;
      rotated.geometry = {
        start: rotatePoint(line.start),
        end: rotatePoint(line.end)
      };
      break;
      
    case 'circle':
      const circle = shape.geometry as any;
      rotated.geometry = {
        ...circle,
        center: rotatePoint(circle.center)
      };
      break;
      
    case 'arc':
      const arc = shape.geometry as any;
      rotated.geometry = {
        ...arc,
        center: rotatePoint(arc.center),
        startAngle: arc.startAngle + angle,
        endAngle: arc.endAngle + angle
      };
      break;
      
    case 'polyline':
      const polyline = shape.geometry as any;
      rotated.geometry = {
        ...polyline,
        points: polyline.points.map(rotatePoint),
        // Also update vertices array if it exists (for bulge-aware polylines)
        vertices: polyline.vertices ? polyline.vertices.map((v: any) => ({
          ...rotatePoint({ x: v.x, y: v.y }),
          bulge: v.bulge || 0
        })) : undefined
      };
      break;
  }
  
  return rotated;
}

export const drawingStore = createDrawingStore();