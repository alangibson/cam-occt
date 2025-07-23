<script lang="ts">
  import { onMount } from 'svelte';
  import { drawingStore } from '../lib/stores/drawing';
  import type { Shape, Point2D } from '../types';
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let mousePos: Point2D = { x: 0, y: 0 };
  let isMouseDown = false;
  let dragStart: Point2D | null = null;
  
  $: drawing = $drawingStore.drawing;
  $: selectedShapes = $drawingStore.selectedShapes;
  $: scale = $drawingStore.scale;
  $: offset = $drawingStore.offset;
  
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
    ctx.scale(scale, -scale); // Flip Y axis for CAD convention
    
    // Draw shapes
    drawing.shapes.forEach(shape => {
      const isSelected = selectedShapes.has(shape.id);
      drawShape(shape, isSelected);
    });
    
    ctx.restore();
  }
  
  
  function drawShape(shape: Shape, isSelected: boolean) {
    ctx.strokeStyle = isSelected ? '#ff6600' : '#000000';
    ctx.lineWidth = (isSelected ? 2 : 1) / scale;
    
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
        if (polyline.points.length > 0) {
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
  }
  
  function screenToWorld(screenPos: Point2D): Point2D {
    return {
      x: (screenPos.x - canvas.width / 2 - offset.x) / scale,
      y: -(screenPos.y - canvas.height / 2 - offset.y) / scale
    };
  }
  
  function getShapeAtPoint(point: Point2D): Shape | null {
    if (!drawing) return null;
    
    // Simple hit testing - check if point is near shape
    const tolerance = 5 / scale;
    
    for (const shape of drawing.shapes) {
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
        
      case 'polyline':
        const polyline = shape.geometry as any;
        for (let i = 0; i < polyline.points.length - 1; i++) {
          if (distanceToLine(point, polyline.points[i], polyline.points[i + 1]) < tolerance) {
            return true;
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
          x: (newMousePos.x - mousePos.x) / scale,
          y: -(newMousePos.y - mousePos.y) / scale
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
    }
    
    mousePos = newMousePos;
  }
  
  function handleMouseUp() {
    isMouseDown = false;
    dragStart = null;
  }
  
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = scale * scaleFactor;
    
    // Zoom towards mouse position
    const worldPos = screenToWorld(mousePos);
    const newOffset = {
      x: mousePos.x - canvas.width / 2 - worldPos.x * newScale,
      y: mousePos.y - canvas.height / 2 + worldPos.y * newScale
    };
    
    drawingStore.setViewTransform(newScale, newOffset);
  }
  
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Delete' && selectedShapes.size > 0) {
      drawingStore.deleteSelected();
    }
  }
  
  // Re-render when store changes
  $: if (ctx && drawing) render();
  $: if (ctx && selectedShapes) render();
  $: if (ctx && scale) render();
  $: if (ctx && offset) render();
</script>

<canvas
  bind:this={canvas}
  class="drawing-canvas"
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  on:wheel={handleWheel}
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