<script lang="ts">
  import { drawingStore } from '../lib/stores/drawing';
  import type { Shape, Point2D } from '../types';
  
  $: drawing = $drawingStore.drawing;
  $: selectedShapes = $drawingStore.selectedShapes;
  
  // Get the first selected shape for display
  $: selectedShape = drawing && selectedShapes.size > 0 
    ? drawing.shapes.find(shape => selectedShapes.has(shape.id)) 
    : null;
  
  function getShapeOrigin(shape: Shape): Point2D {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        return line.start; // Origin is the start point
      
      case 'circle':
      case 'arc':
        const circle = shape.geometry as any;
        return circle.center; // Origin is the center
      
      case 'polyline':
        const polyline = shape.geometry as any;
        return polyline.points.length > 0 ? polyline.points[0] : { x: 0, y: 0 }; // Origin is the first point
      
      default:
        return { x: 0, y: 0 };
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
        // For arcs, calculate start point from center, radius, and start angle
        const arc = shape.geometry as any;
        return {
          x: arc.center.x + arc.radius * Math.cos(arc.startAngle),
          y: arc.center.y + arc.radius * Math.sin(arc.startAngle)
        };
      
      case 'circle':
        // For circles, define start point as rightmost point (0°)
        const circle = shape.geometry as any;
        return {
          x: circle.center.x + circle.radius,
          y: circle.center.y
        };
      
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
        // For arcs, calculate end point from center, radius, and end angle
        const arc = shape.geometry as any;
        return {
          x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
          y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
        };
      
      case 'circle':
        // For circles, define end point as leftmost point (180°)
        const circle = shape.geometry as any;
        return {
          x: circle.center.x - circle.radius,
          y: circle.center.y
        };
      
      default:
        return null;
    }
  }
  
  function formatPoint(point: Point2D | null): string {
    if (!point) return 'N/A';
    return `(${point.x.toFixed(2)}, ${point.y.toFixed(2)})`;
  }
  
  function getShapeTypeDisplay(shape: Shape): string {
    if (shape.originalType) {
      return `${shape.originalType.toUpperCase()} (${shape.type})`;
    }
    return shape.type.toUpperCase();
  }
</script>

<div class="shape-properties">
  <h3>Shape Properties</h3>
  
  {#if selectedShape}
    <div class="property-group">
      <div class="property-row">
        <span class="property-label">Type:</span>
        <span class="property-value">{getShapeTypeDisplay(selectedShape)}</span>
      </div>
      
      {#if selectedShape.layer}
        <div class="property-row">
          <span class="property-label">Layer:</span>
          <span class="property-value">{selectedShape.layer}</span>
        </div>
      {/if}
      
      <div class="property-row">
        <span class="property-label">Origin:</span>
        <span class="property-value">{formatPoint(getShapeOrigin(selectedShape))}</span>
      </div>
      
      {#if getShapeStartPoint(selectedShape)}
        {@const startPoint = getShapeStartPoint(selectedShape)}
        <div class="property-row">
          <span class="property-label">Start:</span>
          <span class="property-value">{formatPoint(startPoint)}</span>
        </div>
      {/if}
      
      {#if getShapeEndPoint(selectedShape)}
        {@const endPoint = getShapeEndPoint(selectedShape)}
        <div class="property-row">
          <span class="property-label">End:</span>
          <span class="property-value">{formatPoint(endPoint)}</span>
        </div>
      {/if}
      
      {#if selectedShape.type === 'circle' || selectedShape.type === 'arc'}
        {@const geometry = selectedShape.geometry as any}
        <div class="property-row">
          <span class="property-label">Radius:</span>
          <span class="property-value">{geometry.radius.toFixed(2)}</span>
        </div>
        
        {#if selectedShape.type === 'arc'}
          <div class="property-row">
            <span class="property-label">Start Angle:</span>
            <span class="property-value">{(geometry.startAngle * 180 / Math.PI).toFixed(1)}°</span>
          </div>
          <div class="property-row">
            <span class="property-label">End Angle:</span>
            <span class="property-value">{(geometry.endAngle * 180 / Math.PI).toFixed(1)}°</span>
          </div>
        {/if}
      {/if}
    </div>
    
    {#if selectedShapes.size > 1}
      <p class="multi-selection">
        {selectedShapes.size} shapes selected (showing first)
      </p>
    {/if}
  {:else}
    <p class="no-selection">No shape selected</p>
  {/if}
</div>

<style>
  .shape-properties {
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 4px;
    min-height: 200px;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 1rem;
  }
  
  .property-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .property-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.5rem;
    background-color: #fff;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  
  .property-label {
    font-weight: 500;
    color: #333;
    min-width: 60px;
  }
  
  .property-value {
    font-family: 'Courier New', monospace;
    color: #666;
    text-align: right;
    word-break: break-all;
  }
  
  .no-selection {
    color: #666;
    font-style: italic;
    margin: 0;
    text-align: center;
  }
  
  .multi-selection {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #666;
    font-style: italic;
    text-align: center;
  }
</style>