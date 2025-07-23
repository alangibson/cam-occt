<script lang="ts">
  import { onMount } from 'svelte';
  import { drawingStore } from '../lib/stores/drawing';
  import type { Shape, Point2D } from '../types';
  import { getPhysicalScaleFactor, getPixelsPerUnit } from '../lib/utils/units';
  
  export let respectLayerVisibility = true; // Default to true for Edit stage
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let mousePos: Point2D = { x: 0, y: 0 };
  let isMouseDown = false;
  let dragStart: Point2D | null = null;
  
  $: drawing = $drawingStore.drawing;
  $: selectedShapes = $drawingStore.selectedShapes;
  $: hoveredShape = $drawingStore.hoveredShape;
  $: scale = $drawingStore.scale;
  $: offset = $drawingStore.offset;
  $: layerVisibility = $drawingStore.layerVisibility;
  $: displayUnit = $drawingStore.displayUnit;
  
  // Calculate physical scale factor for proper unit display
  $: physicalScale = drawing ? getPhysicalScaleFactor(drawing.units, displayUnit) : 1;
  $: totalScale = scale * physicalScale;
  
  onMount(() => {
    ctx = canvas.getContext('2d')!;
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  });
  
  function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    render();
  }
  
  function render() {
    if (!ctx || !drawing) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set transform
    ctx.save();
    ctx.translate(canvas.width / 2 + offset.x, canvas.height / 2 + offset.y);
    ctx.scale(totalScale, -totalScale); // Flip Y axis for CAD convention with physical scaling
    
    // Draw origin cross at (0,0)
    drawOriginCross();
    
    // Draw shapes
    drawing.shapes.forEach(shape => {
      // Check if layer is visible (only if respectLayerVisibility is true)
      if (respectLayerVisibility) {
        const shapeLayer = shape.layer || '0';
        const isVisible = layerVisibility[shapeLayer] !== false; // Default to visible if not set
        
        if (!isVisible) return; // Skip invisible shapes
      }
      
      const isSelected = selectedShapes.has(shape.id);
      const isHovered = hoveredShape === shape.id;
      drawShape(shape, isSelected, isHovered);
      
      // Draw origin/start/end points for selected shapes
      if (isSelected) {
        drawShapePoints(shape);
      }
    });
    
    ctx.restore();
  }
  
  function drawOriginCross() {
    const crossSize = 20 / totalScale; // Fixed size regardless of zoom
    
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 1 / totalScale;
    
    // Draw horizontal line
    ctx.beginPath();
    ctx.moveTo(-crossSize, 0);
    ctx.lineTo(crossSize, 0);
    ctx.stroke();
    
    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(0, -crossSize);
    ctx.lineTo(0, crossSize);
    ctx.stroke();
  }
  
  function drawPolylineWithBulges(vertices: any[], closed: boolean) {
    if (vertices.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    
    // Draw each segment, handling bulges
    for (let i = 0; i < vertices.length - 1; i++) {
      const currentVertex = vertices[i];
      const nextVertex = vertices[i + 1];
      const bulge = currentVertex.bulge || 0;
      
      if (Math.abs(bulge) < 1e-10) {
        // Straight line segment
        ctx.lineTo(nextVertex.x, nextVertex.y);
      } else {
        // Arc segment - draw using canvas arc
        drawBulgedSegment(currentVertex, nextVertex, bulge);
      }
    }
    
    // Handle closing segment for closed polylines
    if (closed && vertices.length >= 3) {
      const lastVertex = vertices[vertices.length - 1];
      const firstVertex = vertices[0];
      const bulge = lastVertex.bulge || 0;
      
      if (Math.abs(bulge) < 1e-10) {
        // Straight line closing segment
        ctx.lineTo(firstVertex.x, firstVertex.y);
      } else {
        // Arc closing segment
        drawBulgedSegment(lastVertex, firstVertex, bulge);
      }
      ctx.closePath();
    }
    
    ctx.stroke();
  }
  
  function drawBulgedSegment(start: any, end: any, bulge: number) {
    // Convert bulge to arc parameters
    const arc = bulgeToArc(start, end, bulge);
    if (!arc) {
      ctx.lineTo(end.x, end.y);
      return;
    }
    
    // Draw arc using canvas arc method
    ctx.arc(
      arc.center.x,
      arc.center.y,
      arc.radius,
      arc.startAngle,
      arc.endAngle,
      arc.clockwise
    );
  }
  
  // Bulge-to-arc conversion function (same as in DXF parser)
  function bulgeToArc(start: any, end: any, bulge: number) {
    if (Math.abs(bulge) < 1e-10) {
      return null;
    }
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const chordLength = Math.sqrt(dx * dx + dy * dy);
    
    if (chordLength < 1e-10) {
      return null;
    }
    
    const theta = 4 * Math.atan(bulge);
    const radius = Math.abs(chordLength / (2 * Math.sin(theta / 2)));
    
    const chordMidX = (start.x + end.x) / 2;
    const chordMidY = (start.y + end.y) / 2;
    
    const perpDist = radius * Math.cos(theta / 2);
    const perpAngle = Math.atan2(dy, dx) + (bulge > 0 ? Math.PI / 2 : -Math.PI / 2);
    
    const center = {
      x: chordMidX + perpDist * Math.cos(perpAngle),
      y: chordMidY + perpDist * Math.sin(perpAngle)
    };
    
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    
    return {
      center,
      radius,
      startAngle,
      endAngle,
      clockwise: bulge < 0
    };
  }

  function drawShape(shape: Shape, isSelected: boolean, isHovered: boolean = false) {
    // Save context state
    ctx.save();
    
    // Priority: selected > hovered > normal
    if (isSelected) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2 / totalScale;
    } else if (isHovered) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 1.5 / totalScale;
    } else {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1 / totalScale;
    }
    
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        ctx.beginPath();
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
        ctx.stroke();
        break;
        
      case 'circle':
        const circle = shape.geometry as any;
        ctx.beginPath();
        ctx.arc(circle.center.x, circle.center.y, circle.radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
        
      case 'arc':
        const arc = shape.geometry as any;
        ctx.beginPath();
        ctx.arc(
          arc.center.x,
          arc.center.y,
          arc.radius,
          arc.startAngle,
          arc.endAngle,
          arc.clockwise
        );
        ctx.stroke();
        break;
        
      case 'polyline':
        const polyline = shape.geometry as any;
        if (polyline.vertices && polyline.vertices.length > 0) {
          // Render polyline with bulge support
          drawPolylineWithBulges(polyline.vertices, polyline.closed);
        } else if (polyline.points && polyline.points.length > 0) {
          // Fallback to simple line rendering for polylines without bulge data
          ctx.beginPath();
          ctx.moveTo(polyline.points[0].x, polyline.points[0].y);
          for (let i = 1; i < polyline.points.length; i++) {
            ctx.lineTo(polyline.points[i].x, polyline.points[i].y);
          }
          if (polyline.closed) {
            ctx.closePath();
          }
          ctx.stroke();
        }
        break;
    }
    
    // Restore context state
    ctx.restore();
  }
  
  function drawShapePoints(shape: Shape) {
    const pointSize = 4 / totalScale; // Fixed size regardless of zoom
    
    // Get points using the same logic as ShapeProperties component
    const origin = getShapeOrigin(shape);
    const startPoint = getShapeStartPoint(shape);
    const endPoint = getShapeEndPoint(shape);
    
    // Draw origin point (blue)
    if (origin) {
      ctx.fillStyle = '#0066ff';
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw start point (green)
    if (startPoint) {
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(startPoint.x, startPoint.y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
    
    // Draw end point (red)
    if (endPoint) {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(endPoint.x, endPoint.y, pointSize, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  
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
        // For circles, start and end points must be the same (rightmost point at 0°)
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
        // For circles, start and end points must be the same (rightmost point at 0°)
        const circle = shape.geometry as any;
        return {
          x: circle.center.x + circle.radius,
          y: circle.center.y
        };
      
      default:
        return null;
    }
  }
  
  function screenToWorld(screenPos: Point2D): Point2D {
    return {
      x: (screenPos.x - canvas.width / 2 - offset.x) / totalScale,
      y: -(screenPos.y - canvas.height / 2 - offset.y) / totalScale
    };
  }
  
  function getShapeAtPoint(point: Point2D): Shape | null {
    if (!drawing) return null;
    
    // Simple hit testing - check if point is near shape
    const tolerance = 5 / totalScale;
    
    for (const shape of drawing.shapes) {
      // Check if layer is visible before hit testing (only if respectLayerVisibility is true)
      if (respectLayerVisibility) {
        const shapeLayer = shape.layer || '0';
        const isVisible = layerVisibility[shapeLayer] !== false; // Default to visible if not set
        
        if (!isVisible) continue; // Skip invisible shapes
      }
      
      if (isPointNearShape(point, shape, tolerance)) {
        return shape;
      }
    }
    
    return null;
  }
  
  function isPointNearShape(point: Point2D, shape: Shape, tolerance: number): boolean {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        return distanceToLine(point, line.start, line.end) < tolerance;
        
      case 'circle':
        const circle = shape.geometry as any;
        const distToCenter = distance(point, circle.center);
        return Math.abs(distToCenter - circle.radius) < tolerance;
        
      case 'arc':
        const arc = shape.geometry as any;
        const distToCenterArc = distance(point, arc.center);
        // Check if point is near the arc circumference
        if (Math.abs(distToCenterArc - arc.radius) > tolerance) {
          return false;
        }
        // Check if point is within the arc's angular range
        const pointAngle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
        return isAngleInArcRange(pointAngle, arc.startAngle, arc.endAngle);
        
      case 'polyline':
        const polyline = shape.geometry as any;
        // Use vertices array if available (bulge-aware polylines)
        const vertices = polyline.vertices || polyline.points.map((p: any) => ({ ...p, bulge: 0 }));
        
        for (let i = 0; i < vertices.length - 1; i++) {
          const currentVertex = vertices[i];
          const nextVertex = vertices[i + 1];
          const bulge = currentVertex.bulge || 0;
          
          if (Math.abs(bulge) < 1e-10) {
            // Straight line segment
            if (distanceToLine(point, currentVertex, nextVertex) < tolerance) {
              return true;
            }
          } else {
            // Arc segment - check if point is near the arc
            const arc = bulgeToArc(currentVertex, nextVertex, bulge);
            if (arc) {
              const distToCenter = distance(point, arc.center);
              if (Math.abs(distToCenter - arc.radius) < tolerance) {
                const pointAngle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
                if (isAngleInArcRange(pointAngle, arc.startAngle, arc.endAngle)) {
                  return true;
                }
              }
            }
          }
        }
        
        // Check closing segment for closed polylines
        if (polyline.closed && vertices.length >= 3) {
          const lastVertex = vertices[vertices.length - 1];
          const firstVertex = vertices[0];
          const bulge = lastVertex.bulge || 0;
          
          if (Math.abs(bulge) < 1e-10) {
            if (distanceToLine(point, lastVertex, firstVertex) < tolerance) {
              return true;
            }
          } else {
            const arc = bulgeToArc(lastVertex, firstVertex, bulge);
            if (arc) {
              const distToCenter = distance(point, arc.center);
              if (Math.abs(distToCenter - arc.radius) < tolerance) {
                const pointAngle = Math.atan2(point.y - arc.center.y, point.x - arc.center.x);
                if (isAngleInArcRange(pointAngle, arc.startAngle, arc.endAngle)) {
                  return true;
                }
              }
            }
          }
        }
        
        return false;
        
      default:
        return false;
    }
  }
  
  function distance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
  
  function isAngleInArcRange(angle: number, startAngle: number, endAngle: number): boolean {
    // Normalize angles to [0, 2π]
    const normalizeAngle = (a: number) => {
      while (a < 0) a += 2 * Math.PI;
      while (a >= 2 * Math.PI) a -= 2 * Math.PI;
      return a;
    };
    
    const normAngle = normalizeAngle(angle);
    const normStart = normalizeAngle(startAngle);
    const normEnd = normalizeAngle(endAngle);
    
    if (normStart <= normEnd) {
      return normAngle >= normStart && normAngle <= normEnd;
    } else {
      // Arc crosses 0 degrees
      return normAngle >= normStart || normAngle <= normEnd;
    }
  }
  
  function distanceToLine(point: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = point.x - xx;
    const dy = point.y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function handleMouseDown(e: MouseEvent) {
    isMouseDown = true;
    mousePos = { x: e.offsetX, y: e.offsetY };
    dragStart = mousePos;
    
    const worldPos = screenToWorld(mousePos);
    const shape = getShapeAtPoint(worldPos);
    
    if (shape) {
      if (!e.ctrlKey && !selectedShapes.has(shape.id)) {
        drawingStore.clearSelection();
      }
      drawingStore.selectShape(shape.id, e.ctrlKey);
    } else if (!e.ctrlKey) {
      drawingStore.clearSelection();
    }
  }
  
  function handleMouseMove(e: MouseEvent) {
    const newMousePos = { x: e.offsetX, y: e.offsetY };
    
    if (isMouseDown && dragStart) {
      if (selectedShapes.size > 0) {
        // Move selected shapes
        const worldDelta = {
          x: (newMousePos.x - mousePos.x) / totalScale,
          y: -(newMousePos.y - mousePos.y) / totalScale
        };
        
        drawingStore.moveShapes(Array.from(selectedShapes), worldDelta);
      } else {
        // Pan view
        const delta = {
          x: newMousePos.x - mousePos.x,
          y: newMousePos.y - mousePos.y
        };
        
        drawingStore.setViewTransform(scale, {
          x: offset.x + delta.x,
          y: offset.y + delta.y
        });
      }
    } else {
      // Handle hover detection when not dragging
      const worldPos = screenToWorld(newMousePos);
      const shape = getShapeAtPoint(worldPos);
      
      drawingStore.setHoveredShape(shape ? shape.id : null);
    }
    
    mousePos = newMousePos;
  }
  
  function handleMouseUp() {
    isMouseDown = false;
    dragStart = null;
  }
  
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = scale * scaleFactor;
    
    // Zoom towards mouse position
    const worldPos = screenToWorld(mousePos);
    const newTotalScale = newScale * physicalScale;
    const newOffset = {
      x: mousePos.x - canvas.width / 2 - worldPos.x * newTotalScale,
      y: mousePos.y - canvas.height / 2 + worldPos.y * newTotalScale
    };
    
    drawingStore.setViewTransform(newScale, newOffset);
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' && selectedShapes.size > 0) {
      drawingStore.deleteSelected();
    }
  }
  
  function handleContextMenu(e: MouseEvent) {
    // Prevent browser context menu when right-clicking for drag operations
    e.preventDefault();
  }
  
  // Re-render when store changes
  $: if (ctx && drawing) render();
  $: if (ctx && selectedShapes) render();
  $: if (ctx && scale) render();
  $: if (ctx && offset) render();
  $: if (ctx && displayUnit) render();
</script>

<canvas
  bind:this={canvas}
  class="drawing-canvas"
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  on:wheel={handleWheel}
  on:contextmenu={handleContextMenu}
  tabindex="0"  
  on:keydown={handleKeyDown}
></canvas>

<style>
  .drawing-canvas {
    width: 100%;
    height: 100%;
    cursor: crosshair;
    outline: none;
  }
  
  .drawing-canvas:active {
    cursor: move;
  }
</style>