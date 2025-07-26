<script lang="ts">
  import { onMount } from 'svelte';
  import { drawingStore } from '../lib/stores/drawing';
  import { chainStore } from '../lib/stores/chains';
  import { partStore } from '../lib/stores/parts';
  import { tessellationStore } from '../lib/stores/tessellation';
  import { overlayStore } from '../lib/stores/overlay';
  import { getShapeChainId, getChainShapeIds, getSelectedChainShapeIds } from '../lib/stores/chains';
  import { getChainPartType, getPartChainIds } from '../lib/stores/parts';
  import type { Shape, Point2D } from '../types';
  import type { WorkflowStage } from '../lib/stores/workflow';
  import { getPhysicalScaleFactor, getPixelsPerUnit } from '../lib/utils/units';
  
  export let respectLayerVisibility = true; // Default to true for Edit stage
  export let treatChainsAsEntities = false; // Default to false, true for Program stage
  export let onChainClick: ((chainId: string) => void) | null = null; // Callback for chain clicks
  export let disableDragging = false; // Default to false, true to disable dragging
  export let currentStage: WorkflowStage; // Current workflow stage for overlay rendering
  
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
  $: chains = $chainStore.chains;
  $: selectedChainId = $chainStore.selectedChainId;
  $: parts = $partStore.parts;
  $: highlightedPartId = $partStore.highlightedPartId;
  $: tessellationState = $tessellationStore;
  $: overlayState = $overlayStore;
  $: currentOverlay = overlayState.overlays[currentStage];
  
  // Get chain IDs that belong to the highlighted part
  $: highlightedChainIds = highlightedPartId ? getPartChainIds(highlightedPartId, parts) : [];
  
  // Get shape IDs for the selected chain
  $: selectedChainShapeIds = getSelectedChainShapeIds(selectedChainId, chains);
  
  // Calculate physical scale factor for proper unit display
  $: physicalScale = drawing ? getPhysicalScaleFactor(drawing.units, displayUnit) : 1;
  $: totalScale = scale * physicalScale;
  
  // Re-render when tessellation state changes
  $: if (tessellationState) render();
  
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
      
      const chainId = getShapeChainId(shape.id, chains);
      const partType = getChainPartType(chainId || '', parts);
      let isSelected = selectedShapes.has(shape.id);
      let isHovered = hoveredShape === shape.id;
      
      // If treating chains as entities, check if any shape in the chain is selected/hovered
      if (treatChainsAsEntities && chainId) {
        const chainShapeIds = getChainShapeIds(shape.id, chains);
        isSelected = chainShapeIds.some(id => selectedShapes.has(id));
        isHovered = chainShapeIds.some(id => hoveredShape === id);
      }
      
      drawShape(shape, isSelected, isHovered, chainId, partType);
      
    });
    
    // Draw stage-specific overlays
    if (currentOverlay) {
      drawOverlays(currentOverlay);
    }
    
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
  
  function drawTessellationPoints(points: Array<{x: number, y: number}>) {
    ctx.save();
    
    // Set blue color for tessellation points
    ctx.fillStyle = '#2563eb'; // Blue color
    
    const pointRadius = 2 / totalScale; // Fixed size regardless of zoom
    
    for (const point of points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
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
  
  function drawEllipse(ellipse: any) {
    // Calculate major and minor axis lengths
    const majorAxisLength = Math.sqrt(
      ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
      ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
    );
    const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
    
    // Calculate rotation angle of major axis
    const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
    
    // Save context for transformation
    ctx.save();
    
    // Transform to ellipse coordinate system
    ctx.translate(ellipse.center.x, ellipse.center.y);
    ctx.rotate(majorAxisAngle);
    ctx.scale(majorAxisLength, minorAxisLength);
    
    // Determine if this is an ellipse arc or full ellipse
    const isArc = typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number';
    
    ctx.beginPath();
    if (isArc) {
      // Draw ellipse arc
      let startParam = ellipse.startParam!;
      let endParam = ellipse.endParam!;
      
      // Handle parameter wrapping
      if (endParam < startParam) {
        endParam += 2 * Math.PI;
      }
      
      ctx.arc(0, 0, 1, startParam, endParam, false);
    } else {
      // Draw full ellipse as a circle in the transformed coordinate system
      ctx.arc(0, 0, 1, 0, 2 * Math.PI, false);
    }
    
    ctx.restore();
    ctx.stroke();
  }

  function drawShape(shape: Shape, isSelected: boolean, isHovered: boolean = false, chainId: string | null = null, partType: 'shell' | 'hole' | null = null) {
    // Save context state
    ctx.save();
    
    // Check if this shape is part of the highlighted part
    const isPartHighlighted = chainId && highlightedChainIds.includes(chainId);
    
    // Check if this shape is part of the selected chain
    const isChainSelected = selectedChainShapeIds.includes(shape.id);
    
    // Priority: selected > hovered > chain selected > part highlighted > part type > chain > normal
    if (isSelected) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2 / totalScale;
    } else if (isHovered) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 1.5 / totalScale;
    } else if (isChainSelected) {
      ctx.strokeStyle = '#10b981'; // Emerald color for selected chain
      ctx.lineWidth = 2.5 / totalScale;
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 2 / totalScale;
    } else if (isPartHighlighted) {
      ctx.strokeStyle = '#f59e0b'; // Amber color for highlighted part
      ctx.lineWidth = 2.5 / totalScale;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 3 / totalScale;
    } else if (partType === 'shell') {
      ctx.strokeStyle = '#2563eb'; // Blue color for part shells
      ctx.lineWidth = 1.5 / totalScale;
    } else if (partType === 'hole') {
      ctx.strokeStyle = '#93c5fd'; // Lighter blue color for holes
      ctx.lineWidth = 1.5 / totalScale;
    } else if (chainId) {
      ctx.strokeStyle = '#2563eb'; // Blue color for chained shapes (fallback)
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
        
      case 'ellipse':
        const ellipse = shape.geometry as any;
        drawEllipse(ellipse);
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
        // Calculate major axis length
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        
        if (typeof ellipse.startParam === 'number') {
          // For ellipse arcs, calculate start point from start parameter
          const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
          const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
          
          // Parametric ellipse equations
          const x = majorAxisLength * Math.cos(ellipse.startParam);
          const y = minorAxisLength * Math.sin(ellipse.startParam);
          
          // Rotate by major axis angle and translate to center
          const rotatedX = x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
          const rotatedY = x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);
          
          return {
            x: ellipse.center.x + rotatedX,
            y: ellipse.center.y + rotatedY
          };
        } else {
          // For full ellipses, use rightmost point (parameter 0)
          return {
            x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
            y: ellipse.center.y + ellipse.majorAxisEndpoint.y
          };
        }
      
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
        // Calculate major axis length
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        
        if (typeof ellipse.endParam === 'number') {
          // For ellipse arcs, calculate end point from end parameter
          const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
          const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
          
          // Parametric ellipse equations
          const x = majorAxisLength * Math.cos(ellipse.endParam);
          const y = minorAxisLength * Math.sin(ellipse.endParam);
          
          // Rotate by major axis angle and translate to center
          const rotatedX = x * Math.cos(majorAxisAngle) - y * Math.sin(majorAxisAngle);
          const rotatedY = x * Math.sin(majorAxisAngle) + y * Math.cos(majorAxisAngle);
          
          return {
            x: ellipse.center.x + rotatedX,
            y: ellipse.center.y + rotatedY
          };
        } else {
          // For full ellipses, start and end points are the same (rightmost point at parameter 0)
          return {
            x: ellipse.center.x + ellipse.majorAxisEndpoint.x,
            y: ellipse.center.y + ellipse.majorAxisEndpoint.y
          };
        }
      
      default:
        return null;
    }
  }
  
  
  function drawOverlays(overlay: any) {
    // Draw shape points (Edit stage)
    if (overlay.shapePoints && overlay.shapePoints.length > 0) {
      overlay.shapePoints.forEach((point: any) => {
        drawOverlayPoint(point.x, point.y, point.type, 4 / totalScale);
      });
    }
    
    // Draw chain endpoints (Prepare stage)
    if (overlay.chainEndpoints && overlay.chainEndpoints.length > 0) {
      overlay.chainEndpoints.forEach((endpoint: any) => {
        drawChainEndpoint(endpoint.x, endpoint.y, endpoint.type, 6 / totalScale);
      });
    }
    
    // Draw tessellation points (Program stage)
    if (overlay.tessellationPoints && overlay.tessellationPoints.length > 0) {
      overlay.tessellationPoints.forEach((point: any) => {
        drawTessellationPoint(point.x, point.y, 2 / totalScale);
      });
    }
  }
  
  function drawOverlayPoint(x: number, y: number, type: string, size: number) {
    ctx.save();
    
    switch (type) {
      case 'origin':
        ctx.fillStyle = '#0066ff'; // Blue
        break;
      case 'start':
        ctx.fillStyle = '#00ff00'; // Green
        break;
      case 'end':
        ctx.fillStyle = '#ff0000'; // Red
        break;
      default:
        ctx.fillStyle = '#888888'; // Gray
    }
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
  
  function drawChainEndpoint(x: number, y: number, type: string, size: number) {
    ctx.save();
    
    // Draw white border
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size + 1 / totalScale, 0, 2 * Math.PI);
    ctx.fill();
    
    // Draw colored center
    if (type === 'start') {
      ctx.fillStyle = '#10b981'; // Emerald green
    } else {
      ctx.fillStyle = '#ef4444'; // Red
    }
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
  }
  
  function drawTessellationPoint(x: number, y: number, size: number) {
    ctx.save();
    ctx.fillStyle = '#2563eb'; // Blue
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
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
        return isAngleInArcRange(pointAngle, arc.startAngle, arc.endAngle, arc.clockwise);
        
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
                if (isAngleInArcRange(pointAngle, arc.startAngle, arc.endAngle, arc.clockwise)) {
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
                if (isAngleInArcRange(pointAngle, arc.startAngle, arc.endAngle, arc.clockwise)) {
                  return true;
                }
              }
            }
          }
        }
        
        return false;
        
      case 'ellipse':
        const ellipse = shape.geometry as any;
        // Use a simpler approximation for hit testing: check if point is within ellipse bounds + tolerance
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
        const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
        
        // Transform point to ellipse coordinate system
        const dx = point.x - ellipse.center.x;
        const dy = point.y - ellipse.center.y;
        const rotatedX = dx * Math.cos(-majorAxisAngle) - dy * Math.sin(-majorAxisAngle);
        const rotatedY = dx * Math.sin(-majorAxisAngle) + dy * Math.cos(-majorAxisAngle);
        
        // Check if point is on the ellipse perimeter within tolerance
        const normalizedX = rotatedX / majorAxisLength;
        const normalizedY = rotatedY / minorAxisLength;
        const distanceFromEllipse = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
        
        if (typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number') {
          // For ellipse arcs, also check if point is within angular range
          const pointParam = Math.atan2(normalizedY, normalizedX);
          let startParam = ellipse.startParam;
          let endParam = ellipse.endParam;
          
          // Normalize parameters to [0, 2π]
          while (startParam < 0) startParam += 2 * Math.PI;
          while (endParam < 0) endParam += 2 * Math.PI;
          while (startParam >= 2 * Math.PI) startParam -= 2 * Math.PI;
          while (endParam >= 2 * Math.PI) endParam -= 2 * Math.PI;
          
          let normalizedPointParam = pointParam;
          while (normalizedPointParam < 0) normalizedPointParam += 2 * Math.PI;
          while (normalizedPointParam >= 2 * Math.PI) normalizedPointParam -= 2 * Math.PI;
          
          // Check if point parameter is within arc range
          let withinRange = false;
          if (startParam <= endParam) {
            withinRange = normalizedPointParam >= startParam && normalizedPointParam <= endParam;
          } else {
            // Arc crosses 0 degrees
            withinRange = normalizedPointParam >= startParam || normalizedPointParam <= endParam;
          }
          
          return Math.abs(distanceFromEllipse - 1) < tolerance / Math.min(majorAxisLength, minorAxisLength) && withinRange;
        } else {
          // Full ellipse
          return Math.abs(distanceFromEllipse - 1) < tolerance / Math.min(majorAxisLength, minorAxisLength);
        }
        
      default:
        return false;
    }
  }
  
  function distance(p1: Point2D, p2: Point2D): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }
  
  function isAngleInArcRange(angle: number, startAngle: number, endAngle: number, clockwise: boolean = false): boolean {
    // Normalize angles to [0, 2π]
    const normalizeAngle = (a: number) => {
      while (a < 0) a += 2 * Math.PI;
      while (a >= 2 * Math.PI) a -= 2 * Math.PI;
      return a;
    };
    
    const normAngle = normalizeAngle(angle);
    const normStart = normalizeAngle(startAngle);
    const normEnd = normalizeAngle(endAngle);
    
    if (clockwise) {
      // For clockwise arcs, we traverse from start to end in clockwise direction
      if (normStart >= normEnd) {
        return normAngle <= normStart && normAngle >= normEnd;
      } else {
        // Arc crosses 0 degrees in clockwise direction
        return normAngle <= normStart || normAngle >= normEnd;
      }
    } else {
      // For counter-clockwise arcs (default behavior)
      if (normStart <= normEnd) {
        return normAngle >= normStart && normAngle <= normEnd;
      } else {
        // Arc crosses 0 degrees
        return normAngle >= normStart || normAngle <= normEnd;
      }
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
      if (treatChainsAsEntities) {
        // Get the chain ID for this shape
        const chainId = getShapeChainId(shape.id, chains);
        
        // Get all shapes in the chain
        const chainShapeIds = getChainShapeIds(shape.id, chains);
        
        // Check if any shape in the chain is already selected
        const chainSelected = chainShapeIds.some(id => selectedShapes.has(id));
        
        if (!e.ctrlKey && !chainSelected) {
          drawingStore.clearSelection();
        }
        
        // Select/deselect all shapes in the chain
        chainShapeIds.forEach(id => {
          if (!selectedShapes.has(id) || !e.ctrlKey) {
            drawingStore.selectShape(id, true); // Always multi-select for chains
          }
        });
        
        // Notify parent component about chain click
        if (onChainClick && chainId) {
          onChainClick(chainId);
        }
      } else {
        // Original single-shape selection logic
        if (!e.ctrlKey && !selectedShapes.has(shape.id)) {
          drawingStore.clearSelection();
        }
        drawingStore.selectShape(shape.id, e.ctrlKey);
      }
    } else if (!e.ctrlKey) {
      drawingStore.clearSelection();
    }
  }
  
  function handleMouseMove(e: MouseEvent) {
    const newMousePos = { x: e.offsetX, y: e.offsetY };
    
    if (isMouseDown && dragStart) {
      if (selectedShapes.size > 0 && !disableDragging) {
        // Move selected shapes (only if dragging is enabled)
        const worldDelta = {
          x: (newMousePos.x - mousePos.x) / totalScale,
          y: -(newMousePos.y - mousePos.y) / totalScale
        };
        
        drawingStore.moveShapes(Array.from(selectedShapes), worldDelta);
      } else if (selectedShapes.size === 0) {
        // Pan view (always allowed)
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
      
      if (treatChainsAsEntities && shape) {
        // When treating chains as entities, we still only set the hovered shape to the actual shape
        // The rendering logic will handle highlighting the whole chain
        drawingStore.setHoveredShape(shape.id);
      } else {
        drawingStore.setHoveredShape(shape ? shape.id : null);
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