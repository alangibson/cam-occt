<script lang="ts">
  import { drawingStore } from '../lib/stores/drawing';
  import type { Shape, Point2D } from '../types';
  
  $: drawing = $drawingStore.drawing;
  $: selectedShapes = $drawingStore.selectedShapes;
  $: hoveredShape = $drawingStore.hoveredShape;
  
  // Get the shape to display - prioritize selected shape over hovered
  $: displayShape = drawing && selectedShapes.size > 0 
    ? drawing.shapes.find(shape => selectedShapes.has(shape.id))
    : (drawing && hoveredShape 
        ? drawing.shapes.find(shape => shape.id === hoveredShape)
        : null);
  
  // Determine if we're showing hovered vs selected
  $: isShowingHovered = displayShape && selectedShapes.size === 0 && hoveredShape === displayShape.id;
  
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
      
      case 'ellipse':
        const ellipse = shape.geometry as any;
        return ellipse.center; // Origin is the center
      
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
        // For circles, start and end points must be the same (rightmost point at 0°)
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
        // For arcs, calculate end point from center, radius, and end angle
        const arc = shape.geometry as any;
        return {
          x: arc.center.x + arc.radius * Math.cos(arc.endAngle),
          y: arc.center.y + arc.radius * Math.sin(arc.endAngle)
        };
      
      case 'circle':
        // For circles, start and end points must be the same (rightmost point at 0°)
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
</script>

<div class="shape-properties">
  {#if displayShape}
    <div class="property-group">
      <div class="property-row">
        <span class="property-label">Type:</span>
        <span class="property-value">{getShapeTypeDisplay(displayShape)}</span>
      </div>
      
      {#if displayShape.layer}
        <div class="property-row">
          <span class="property-label">Layer:</span>
          <span class="property-value">{displayShape.layer}</span>
        </div>
      {/if}
      
      <div class="property-row">
        <span class="property-label">Origin:</span>
        <span class="property-value">{formatPoint(getShapeOrigin(displayShape))}</span>
      </div>
      
      {#if getShapeStartPoint(displayShape)}
        {@const startPoint = getShapeStartPoint(displayShape)}
        <div class="property-row">
          <span class="property-label">Start:</span>
          <span class="property-value">{formatPoint(startPoint)}</span>
        </div>
      {/if}
      
      {#if getShapeEndPoint(displayShape)}
        {@const endPoint = getShapeEndPoint(displayShape)}
        <div class="property-row">
          <span class="property-label">End:</span>
          <span class="property-value">{formatPoint(endPoint)}</span>
        </div>
      {/if}
      
      {#if displayShape.type === 'circle' || displayShape.type === 'arc'}
        {@const geometry = displayShape.geometry as any}
        <div class="property-row">
          <span class="property-label">Radius:</span>
          <span class="property-value">{geometry.radius.toFixed(2)}</span>
        </div>
        
        {#if displayShape.type === 'arc'}
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
      
      {#if displayShape.originalType === 'spline' && displayShape.splineData}
        {@const splineData = displayShape.splineData}
        <div class="property-row">
          <span class="property-label">Degree:</span>
          <span class="property-value">{splineData.degree}</span>
        </div>
        
        {#if splineData.controlPoints && splineData.controlPoints.length > 0}
          <div class="property-row">
            <span class="property-label">Control Points:</span>
            <span class="property-value">{splineData.controlPoints.length}</span>
          </div>
          <div class="spline-points">
            {#each splineData.controlPoints.slice(0, 5) as point, index}
              <div class="property-row small">
                <span class="property-label">  CP {index + 1}:</span>
                <span class="property-value">({point.x.toFixed(2)}, {point.y.toFixed(2)})</span>
              </div>
            {/each}
            {#if splineData.controlPoints.length > 5}
              <div class="property-row small">
                <span class="property-label">  ...</span>
                <span class="property-value">+{splineData.controlPoints.length - 5} more</span>
              </div>
            {/if}
          </div>
        {/if}
        
        {#if splineData.knots && splineData.knots.length > 0}
          <div class="property-row">
            <span class="property-label">Knots:</span>
            <span class="property-value">{splineData.knots.length}</span>
          </div>
        {/if}
        
        {#if splineData.weights && splineData.weights.length > 0}
          <div class="property-row">
            <span class="property-label">Weights:</span>
            <span class="property-value">{splineData.weights.length}</span>
          </div>
        {/if}
        
        {#if splineData.fitPoints && splineData.fitPoints.length > 0}
          <div class="property-row">
            <span class="property-label">Fit Points:</span>
            <span class="property-value">{splineData.fitPoints.length}</span>
          </div>
        {/if}
      {/if}
    </div>
    
    {#if isShowingHovered}
      <p class="hover-info">Showing hovered shape (click to select)</p>
    {:else if selectedShapes.size > 1}
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
  
  /* h3 header removed - title now handled by AccordionPanel */
  
  .property-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  
  .property-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: #fff;
    border-radius: 4px;
    border: 1px solid #ddd;
    min-width: 0;
  }
  
  .property-row.small {
    padding: 0.25rem 0.5rem;
    font-size: 0.9rem;
    background-color: #f8f8f8;
    border: none;
    margin-left: 0.5rem;
  }
  
  .spline-points {
    margin-top: 0.5rem;
  }
  
  .property-label {
    font-weight: 500;
    color: #333;
    min-width: 60px;
    flex-shrink: 0;
  }
  
  .property-value {
    font-family: 'Courier New', monospace;
    color: #666;
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex-shrink: 1;
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
  
  .hover-info {
    margin-top: 1rem;
    font-size: 0.9rem;
    color: #0066ff;
    font-style: italic;
    text-align: center;
  }
</style>