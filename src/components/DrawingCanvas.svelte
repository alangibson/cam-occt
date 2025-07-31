<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { drawingStore } from '../lib/stores/drawing';
  import { chainStore } from '../lib/stores/chains';
  import { partStore } from '../lib/stores/parts';
  import { pathStore } from '../lib/stores/paths';
  import { operationsStore } from '../lib/stores/operations';
  import { tessellationStore } from '../lib/stores/tessellation';
  import { overlayStore } from '../lib/stores/overlay';
  import { rapidStore, selectRapid, clearRapidHighlight } from '../lib/stores/rapids';
  import { getShapeChainId, getChainShapeIds, clearChainSelection } from '../lib/stores/chains';
  import { getChainPartType, getPartChainIds, clearHighlight } from '../lib/stores/parts';
  import { selectPath, clearPathHighlight } from '../lib/stores/paths';
  import { sampleNURBS, evaluateNURBS } from '../lib/geometry/nurbs';
  import { calculateLeads } from '../lib/algorithms/lead-calculation';
  import { leadWarningsStore } from '../lib/stores/lead-warnings';
  import type { Shape, Point2D } from '../types';
  import type { WorkflowStage } from '../lib/stores/workflow';
  import { getPhysicalScaleFactor, getPixelsPerUnit } from '../lib/utils/units';
  
  export let respectLayerVisibility = true; // Default to true for Edit stage
  export let treatChainsAsEntities = false; // Default to false, true for Program stage
  export let onChainClick: ((chainId: string) => void) | null = null; // Callback for chain clicks
  export let disableDragging = false; // Default to false, true to disable dragging
  export let currentStage: WorkflowStage; // Current workflow stage for overlay rendering
  export let interactionMode: 'shapes' | 'chains' | 'paths' = 'shapes'; // What type of objects can be selected
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let mousePos: Point2D = { x: 0, y: 0 };
  let isMouseDown = false;
  let dragStart: Point2D | null = null;
  let mouseButton = 0; // Track which mouse button was pressed
  
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
  $: pathsState = $pathStore;
  $: operations = $operationsStore;
  // Only show chains as having paths if their associated operations are enabled
  $: chainsWithPaths = pathsState && operations ? [...new Set(
    pathsState.paths
      .filter(path => {
        // Find the operation for this path
        const operation = operations.find(op => op.id === path.operationId);
        // Only include path if operation exists and is enabled
        return operation && operation.enabled && path.enabled;
      })
      .map(p => p.chainId)
  )] : [];
  $: selectedPathId = pathsState?.selectedPathId;
  $: highlightedPathId = pathsState?.highlightedPathId;
  $: tessellationState = $tessellationStore;
  $: overlayState = $overlayStore;
  $: currentOverlay = overlayState.overlays[currentStage];
  $: rapids = $rapidStore.rapids;
  $: showRapids = $rapidStore.showRapids;
  $: selectedRapidId = $rapidStore.selectedRapidId;
  $: highlightedRapidId = $rapidStore.highlightedRapidId;
  
  // Get chain IDs that belong to the highlighted part
  $: highlightedChainIds = highlightedPartId ? getPartChainIds(highlightedPartId, parts) : [];
  
  
  // Calculate physical scale factor for proper unit display
  $: physicalScale = drawing ? getPhysicalScaleFactor(drawing.units, displayUnit) : 1;
  $: totalScale = scale * physicalScale;
  
  // Consolidate all reactive render triggers
  $: {
    // List all dependencies that should trigger a re-render
    drawing;
    selectedShapes;
    scale;
    offset;
    displayUnit;
    selectedChainId;
    highlightedPartId;
    highlightedChainIds;
    tessellationState;
    currentOverlay;
    pathsState;
    operations;
    
    // Only render if we have a context
    if (ctx) {
      render();
    }
  }
  
  let canvasContainer: HTMLElement;
  
  onMount(() => {
    ctx = canvas.getContext('2d')!;
    
    // Set up resize observer to maintain proper canvas sizing
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        
        // Store previous canvas dimensions to calculate offset adjustment
        const prevWidth = canvas.width;
        const prevHeight = canvas.height;
        
        // Update canvas size to match container
        canvas.width = width;
        canvas.height = height;
        
        // No need to adjust offset anymore - origin position is now fixed
        
        // Re-render after resize
        if (ctx) {
          render();
        }
      }
    });
    
    if (canvasContainer) {
      resizeObserver.observe(canvasContainer);
    }
    
    // Initial render
    render();
    
    return () => {
      resizeObserver.disconnect();
    };
  });

  onDestroy(() => {
    if (hoverTimeout !== null) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
  });
  
  
  function render() {
    if (!ctx || !drawing) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set transform using fixed origin position (25% from left, 75% from top)
    ctx.save();
    const originX = canvas.width * 0.25 + offset.x;
    const originY = canvas.height * 0.75 + offset.y;
    ctx.translate(originX, originY);
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
    
    // Draw rapids (light blue thin lines)
    drawRapids();
    
    // Draw path endpoints (green start, red end)
    drawPathEndpoints();
    
    // Draw lead-ins and lead-outs
    drawLeads();
    
    // Draw chevron arrows along paths
    drawPathChevrons();
    
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
  
  function drawRapids() {
    if (!showRapids || rapids.length === 0) return;
    
    ctx.save();
    
    rapids.forEach((rapid: { id: string; start: any; end: any }) => {
      // Determine visual state
      const isSelected = selectedRapidId === rapid.id;
      const isHighlighted = highlightedRapidId === rapid.id;
      
      // Set styling based on state
      if (isSelected) {
        ctx.strokeStyle = '#ff6600'; // Orange for selected (same as selected shapes)
        ctx.lineWidth = 2 / totalScale; // Thicker line
        ctx.setLineDash([]); // Solid line for selected
      } else if (isHighlighted) {
        ctx.strokeStyle = '#ff6600'; // Orange for highlighted
        ctx.lineWidth = 1.5 / totalScale; // Medium thickness
        ctx.setLineDash([3 / totalScale, 3 / totalScale]); // Shorter dashes
      } else {
        ctx.strokeStyle = '#00bfff'; // Light blue for normal
        ctx.lineWidth = 0.5 / totalScale; // Thin line
        ctx.setLineDash([5 / totalScale, 5 / totalScale]); // Normal dashes
      }
      
      ctx.beginPath();
      ctx.moveTo(rapid.start.x, rapid.start.y);
      ctx.lineTo(rapid.end.x, rapid.end.y);
      ctx.stroke();
    });
    
    ctx.restore();
  }
  
  function drawPathEndpoints() {
    if (!pathsState || pathsState.paths.length === 0) return;
    
    const pointRadius = 3 / totalScale; // Fixed size regardless of zoom
    
    pathsState.paths.forEach(path => {
      // Only draw endpoints for enabled paths with enabled operations
      const operation = operations.find(op => op.id === path.operationId);
      if (!operation || !operation.enabled || !path.enabled) return;
      
      // Get the chain for this path to find start/end points
      const chain = chains.find(c => c.id === path.chainId);
      if (!chain || chain.shapes.length === 0) return;
      
      // Get first and last shape in the chain
      const firstShape = chain.shapes[0];
      const lastShape = chain.shapes[chain.shapes.length - 1];
      
      if (!firstShape || !lastShape) return;
      
      // Get start point of first shape
      const startPoint = getShapeStartPoint(firstShape);
      if (startPoint) {
        ctx.save();
        ctx.fillStyle = '#00ff00'; // Green for start
        ctx.beginPath();
        ctx.arc(startPoint.x, startPoint.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
      
      // Get end point of last shape
      const endPoint = getShapeEndPoint(lastShape);
      if (endPoint) {
        ctx.save();
        ctx.fillStyle = '#ff0000'; // Red for end
        ctx.beginPath();
        ctx.arc(endPoint.x, endPoint.y, pointRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
    });
  }
  
  function drawLeads() {
    if (!pathsState || pathsState.paths.length === 0) return;
    
    pathsState.paths.forEach(path => {
      // Only draw leads for enabled paths with enabled operations
      const operation = operations.find(op => op.id === path.operationId);
      if (!operation || !operation.enabled || !path.enabled) return;
      
      // Skip if both leads are disabled
      if (path.leadInType === 'none' && path.leadOutType === 'none') return;
      
      // Get the chain for this path
      const chain = chains.find(c => c.id === path.chainId);
      if (!chain || chain.shapes.length === 0) return;
      
      // Get the part if the path is part of a part
      let part = null;
      if (operation.targetType === 'parts') {
        part = parts?.find(p => 
          p.shell.chain.id === path.chainId || 
          p.holes.some((h: any) => h.chain.id === path.chainId)
        );
      }
      
      try {
        // Calculate leads
        const leadInConfig = {
          type: path.leadInType || 'none',
          length: path.leadInLength || 0,
          flipSide: path.leadInFlipSide || false,
          angle: path.leadInAngle
        };
        const leadOutConfig = {
          type: path.leadOutType || 'none', 
          length: path.leadOutLength || 0,
          flipSide: path.leadOutFlipSide || false,
          angle: path.leadOutAngle
        };
        
        const leadResult = calculateLeads(chain, leadInConfig, leadOutConfig, path.cutDirection, part || undefined);
        
        // Handle lead warnings
        if (leadResult.warnings && leadResult.warnings.length > 0) {
          // Clear previous warnings for this path first
          leadWarningsStore.clearWarningsForChain(path.chainId);
          
          // Add new warnings
          leadResult.warnings.forEach(warningMessage => {
            const isLeadIn = warningMessage.includes('Lead-in');
            leadWarningsStore.addWarning({
              operationId: path.operationId,
              chainId: path.chainId,
              message: warningMessage,
              type: isLeadIn ? 'lead-in' : 'lead-out'
            });
          });
        }
        
        // Draw lead-in
        if (leadResult.leadIn && leadResult.leadIn.points.length > 1) {
          drawLeadGeometry(leadResult.leadIn.points, '#9333ea'); // Purple for lead-in
        }
        
        // Draw lead-out
        if (leadResult.leadOut && leadResult.leadOut.points.length > 1) {
          drawLeadGeometry(leadResult.leadOut.points, '#dc2626'); // Red for lead-out
        }
      } catch (error) {
        console.warn('Failed to calculate leads for path:', path.name, error);
      }
    });
  }
  
  function drawLeadGeometry(points: Array<{x: number, y: number}>, color: string) {
    if (points.length < 2) return;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5 / totalScale; // Slightly thicker than normal lines
    ctx.setLineDash([5 / totalScale, 5 / totalScale]); // Dashed line to distinguish from main path
    
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    ctx.stroke();
    ctx.restore();
  }
  
  function drawPathChevrons() {
    if (!pathsState || pathsState.paths.length === 0) return;
    
    pathsState.paths.forEach(path => {
      // Only draw chevrons for enabled paths with enabled operations
      const operation = operations.find(op => op.id === path.operationId);
      if (!operation || !operation.enabled || !path.enabled) return;
      
      // Get the chain for this path
      const chain = chains.find(c => c.id === path.chainId);
      if (!chain || chain.shapes.length === 0) return;
      
      // Sample points along the path
      const pathPoints = samplePathPoints(chain, 50, path.cutDirection); // Sample 50 points along the path
      if (pathPoints.length < 2) return;
      
      // Draw chevron arrows at regular intervals
      const chevronSpacing = 20; // Draw a chevron every 20 sample points
      const chevronSize = 8 / totalScale; // Size of chevrons in world units
      
      for (let i = chevronSpacing; i < pathPoints.length - chevronSpacing; i += chevronSpacing) {
        const currentPoint = pathPoints[i];
        const nextPoint = pathPoints[i + 1];
        
        // Calculate direction vector
        const dx = nextPoint.x - currentPoint.x;
        const dy = nextPoint.y - currentPoint.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length > 0) {
          // Normalize direction vector
          const dirX = dx / length;
          const dirY = dy / length;
          
          // Calculate perpendicular vector for chevron wings
          const perpX = -dirY;
          const perpY = dirX;
          
          drawChevronArrow(currentPoint, dirX, dirY, perpX, perpY, chevronSize);
        }
      }
    });
  }
  
  function drawChevronArrow(center: Point2D, dirX: number, dirY: number, perpX: number, perpY: number, size: number) {
    ctx.save();
    ctx.strokeStyle = '#16a34a'; // Green color to match path color
    ctx.lineWidth = 1.5 / totalScale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Calculate chevron wing points (90 degree angle between wings)
    const wingLength = size * 0.7;
    const backOffset = size * 0.3;
    
    // Wing points: 45 degrees on each side of the direction vector
    const wing1X = center.x - backOffset * dirX + wingLength * (dirX * Math.cos(Math.PI / 4) + perpX * Math.sin(Math.PI / 4));
    const wing1Y = center.y - backOffset * dirY + wingLength * (dirY * Math.cos(Math.PI / 4) + perpY * Math.sin(Math.PI / 4));
    
    const wing2X = center.x - backOffset * dirX + wingLength * (dirX * Math.cos(Math.PI / 4) - perpX * Math.sin(Math.PI / 4));
    const wing2Y = center.y - backOffset * dirY + wingLength * (dirY * Math.cos(Math.PI / 4) - perpY * Math.sin(Math.PI / 4));
    
    const tipX = center.x + size * 0.4 * dirX;
    const tipY = center.y + size * 0.4 * dirY;
    
    // Draw the chevron (two lines forming arrow shape)
    ctx.beginPath();
    ctx.moveTo(wing1X, wing1Y);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(wing2X, wing2Y);
    ctx.stroke();
    
    ctx.restore();
  }
  
  function samplePathPoints(chain: any, numSamples: number, cutDirection: 'clockwise' | 'counterclockwise' | 'none' = 'counterclockwise'): Point2D[] {
    const points: Point2D[] = [];
    
    if (!chain.shapes || chain.shapes.length === 0) return points;
    
    // Determine the order to traverse shapes based on cut direction
    const shapes = cutDirection === 'counterclockwise' ? [...chain.shapes].reverse() : chain.shapes;
    
    // For each shape in the chain, sample points along it
    for (const shape of shapes) {
      const shapePoints = sampleShapePoints(shape, Math.max(2, Math.floor(numSamples / chain.shapes.length)), cutDirection === 'counterclockwise');
      points.push(...shapePoints);
    }
    
    return points;
  }
  
  function sampleShapePoints(shape: Shape, numSamples: number, reverse: boolean = false): Point2D[] {
    const points: Point2D[] = [];
    
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        for (let i = 0; i <= numSamples; i++) {
          const t = reverse ? 1 - (i / numSamples) : i / numSamples;
          points.push({
            x: line.start.x + t * (line.end.x - line.start.x),
            y: line.start.y + t * (line.end.y - line.start.y)
          });
        }
        break;
        
      case 'arc':
        const arc = shape.geometry as any;
        let startAngle = arc.startAngle;
        let endAngle = arc.endAngle;
        
        // Handle angle wrapping for proper arc direction
        if (arc.clockwise) {
          while (endAngle > startAngle) endAngle -= 2 * Math.PI;
        } else {
          while (endAngle < startAngle) endAngle += 2 * Math.PI;
        }
        
        // If reverse is true, swap start and end angles
        if (reverse) {
          [startAngle, endAngle] = [endAngle, startAngle];
        }
        
        for (let i = 0; i <= numSamples; i++) {
          const t = i / numSamples;
          const angle = startAngle + t * (endAngle - startAngle);
          points.push({
            x: arc.center.x + arc.radius * Math.cos(angle),
            y: arc.center.y + arc.radius * Math.sin(angle)
          });
        }
        break;
        
      case 'circle':
        const circle = shape.geometry as any;
        for (let i = 0; i <= numSamples; i++) {
          const t = reverse ? 1 - (i / numSamples) : i / numSamples;
          const angle = t * 2 * Math.PI;
          points.push({
            x: circle.center.x + circle.radius * Math.cos(angle),
            y: circle.center.y + circle.radius * Math.sin(angle)
          });
        }
        break;
        
      case 'polyline':
        const polyline = shape.geometry as any;
        let vertices = polyline.vertices || polyline.points?.map((p: any) => ({ ...p, bulge: 0 })) || [];
        
        if (vertices.length < 2) break;
        
        // If reverse is true, reverse the vertex order and adjust bulge signs
        if (reverse) {
          vertices = [...vertices].reverse();
          // When reversing, bulge factors need to be negated and shifted
          for (let i = 0; i < vertices.length - 1; i++) {
            const originalBulge = vertices[i + 1].bulge || 0; // Take bulge from next vertex in original order
            vertices[i].bulge = -originalBulge; // Negate bulge for reverse direction
          }
        }
        
        // Sample along each segment
        const segmentSamples = Math.max(1, Math.floor(numSamples / vertices.length));
        
        for (let i = 0; i < vertices.length - 1; i++) {
          const currentVertex = vertices[i];
          const nextVertex = vertices[i + 1];
          const bulge = currentVertex.bulge || 0;
          
          if (Math.abs(bulge) < 1e-10) {
            // Straight line segment
            for (let j = 0; j <= segmentSamples; j++) {
              const t = j / segmentSamples;
              points.push({
                x: currentVertex.x + t * (nextVertex.x - currentVertex.x),
                y: currentVertex.y + t * (nextVertex.y - currentVertex.y)
              });
            }
          } else {
            // Arc segment
            const arcSegment = bulgeToArc(currentVertex, nextVertex, bulge);
            if (arcSegment) {
              let startAngle = arcSegment.startAngle;
              let endAngle = arcSegment.endAngle;
              
              if (arcSegment.clockwise) {
                while (endAngle > startAngle) endAngle -= 2 * Math.PI;
              } else {
                while (endAngle < startAngle) endAngle += 2 * Math.PI;
              }
              
              for (let j = 0; j <= segmentSamples; j++) {
                const t = j / segmentSamples;
                const angle = startAngle + t * (endAngle - startAngle);
                points.push({
                  x: arcSegment.center.x + arcSegment.radius * Math.cos(angle),
                  y: arcSegment.center.y + arcSegment.radius * Math.sin(angle)
                });
              }
            }
          }
        }
        
        // Handle closing segment for closed polylines
        if (polyline.closed && vertices.length >= 3) {
          const lastVertex = vertices[vertices.length - 1];
          const firstVertex = vertices[0];
          const bulge = lastVertex.bulge || 0;
          
          if (Math.abs(bulge) < 1e-10) {
            for (let j = 0; j <= segmentSamples; j++) {
              const t = j / segmentSamples;
              points.push({
                x: lastVertex.x + t * (firstVertex.x - lastVertex.x),
                y: lastVertex.y + t * (firstVertex.y - lastVertex.y)
              });
            }
          } else {
            const arcSegment = bulgeToArc(lastVertex, firstVertex, bulge);
            if (arcSegment) {
              let startAngle = arcSegment.startAngle;
              let endAngle = arcSegment.endAngle;
              
              if (arcSegment.clockwise) {
                while (endAngle > startAngle) endAngle -= 2 * Math.PI;
              } else {
                while (endAngle < startAngle) endAngle += 2 * Math.PI;
              }
              
              for (let j = 0; j <= segmentSamples; j++) {
                const t = j / segmentSamples;
                const angle = startAngle + t * (endAngle - startAngle);
                points.push({
                  x: arcSegment.center.x + arcSegment.radius * Math.cos(angle),
                  y: arcSegment.center.y + arcSegment.radius * Math.sin(angle)
                });
              }
            }
          }
        }
        break;
        
      case 'spline':
        const spline = shape.geometry as any;
        const splinePoints = sampleNURBS(spline, numSamples);
        if (reverse) {
          points.push(...splinePoints.reverse());
        } else {
          points.push(...splinePoints);
        }
        break;
        
      default:
        // For unsupported shapes, just add start and end points if available
        const startPoint = getShapeStartPoint(shape);
        const endPoint = getShapeEndPoint(shape);
        if (reverse) {
          if (endPoint) points.push(endPoint);
          if (startPoint && startPoint !== endPoint) points.push(startPoint);
        } else {
          if (startPoint) points.push(startPoint);
          if (endPoint && endPoint !== startPoint) points.push(endPoint);
        }
        break;
    }
    
    return points;
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

  function drawSpline(spline: any) {
    // Use proper NURBS evaluation for smooth curves
    const sampledPoints = sampleNURBS(spline);
    
    if (sampledPoints.length < 2) return;
    
    ctx.beginPath();
    ctx.moveTo(sampledPoints[0].x, sampledPoints[0].y);
    
    for (let i = 1; i < sampledPoints.length; i++) {
      ctx.lineTo(sampledPoints[i].x, sampledPoints[i].y);
    }
    
    if (spline.closed) {
      ctx.closePath();
    }
    
    ctx.stroke();
    
    // Optionally draw control points for debugging
    // Enable by setting showSplineControlPoints = true
    const showSplineControlPoints = false;
    if (showSplineControlPoints) {
      ctx.save();
      ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
      for (const cp of spline.controlPoints) {
        ctx.beginPath();
        ctx.arc(cp.x, cp.y, 4 / totalScale, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      // Draw control polygon
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.lineWidth = 1 / totalScale;
      ctx.beginPath();
      if (spline.controlPoints.length > 0) {
        ctx.moveTo(spline.controlPoints[0].x, spline.controlPoints[0].y);
        for (let i = 1; i < spline.controlPoints.length; i++) {
          ctx.lineTo(spline.controlPoints[i].x, spline.controlPoints[i].y);
        }
      }
      ctx.stroke();
      
      ctx.restore();
    }
  }

  function drawShape(shape: Shape, isSelected: boolean, isHovered: boolean = false, chainId: string | null = null, partType: 'shell' | 'hole' | null = null) {
    // Save context state
    ctx.save();
    
    // Check if this shape is part of the highlighted part
    const isPartHighlighted = chainId && highlightedChainIds.includes(chainId);
    
    // Check if this shape is part of the selected chain
    const isChainSelected = chainId && selectedChainId === chainId;
    
    // Check if this chain has paths (green highlighting)
    const hasPath = chainId && chainsWithPaths.includes(chainId);
    
    // Check if this path is selected or highlighted
    const isPathSelected = selectedPathId && pathsState.paths.some(p => p.id === selectedPathId && p.chainId === chainId);
    const isPathHighlighted = highlightedPathId && pathsState.paths.some(p => p.id === highlightedPathId && p.chainId === chainId);
    
    // Priority: selected > hovered > path selected > path highlighted > chain selected > part highlighted > path (green) > part type > chain > normal
    if (isSelected) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 2 / totalScale;
    } else if (isHovered) {
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 1.5 / totalScale;
    } else if (isPathSelected) {
      ctx.strokeStyle = '#15803d'; // Dark green color for selected path
      ctx.lineWidth = 3 / totalScale;
    } else if (isPathHighlighted) {
      ctx.strokeStyle = '#15803d'; // Dark green color for highlighted path
      ctx.lineWidth = 3 / totalScale;
      ctx.shadowColor = '#15803d';
      ctx.shadowBlur = 4 / totalScale;
    } else if (isChainSelected) {
      ctx.strokeStyle = '#ff6600'; // Orange color for selected chain (same as selected shapes)
      ctx.lineWidth = 2 / totalScale;
    } else if (isPartHighlighted) {
      ctx.strokeStyle = '#f59e0b'; // Amber color for highlighted part
      ctx.lineWidth = 2.5 / totalScale;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 3 / totalScale;
    } else if (hasPath) {
      ctx.strokeStyle = '#16a34a'; // Green color for chains with paths
      ctx.lineWidth = 2 / totalScale;
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
        
      case 'spline':
        const spline = shape.geometry as any;
        drawSpline(spline);
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
      
      case 'spline':
        const spline = shape.geometry as any;
        // Origin is the first control point
        return spline.controlPoints.length > 0 ? spline.controlPoints[0] : { x: 0, y: 0 };
      
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
      
      case 'spline':
        const spline = shape.geometry as any;
        // Use proper NURBS evaluation at parameter t=0
        try {
          return evaluateNURBS(0, spline); // Get exact start point at t=0
        } catch (error) {
          // Fallback to first control point if NURBS evaluation fails
          if (spline.fitPoints && spline.fitPoints.length > 0) {
            return spline.fitPoints[0];
          }
          return spline.controlPoints.length > 0 ? spline.controlPoints[0] : null;
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
      
      case 'spline':
        const spline = shape.geometry as any;
        // Use proper NURBS evaluation at parameter t=1
        try {
          return evaluateNURBS(1, spline); // Get exact end point at t=1
        } catch (error) {
          // Fallback to last control point if NURBS evaluation fails
          if (spline.fitPoints && spline.fitPoints.length > 0) {
            return spline.fitPoints[spline.fitPoints.length - 1];
          }
          return spline.controlPoints.length > 0 ? spline.controlPoints[spline.controlPoints.length - 1] : null;
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
    
    // Draw tool head (Simulate stage)
    if (overlay.toolHead && overlay.toolHead.visible) {
      drawToolHead(overlay.toolHead.x, overlay.toolHead.y, 8 / totalScale);
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
  
  function drawToolHead(x: number, y: number, size: number) {
    ctx.save();
    ctx.strokeStyle = '#ff0000'; // Red
    ctx.lineWidth = 2 / totalScale;
    
    // Draw cross
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
    
    ctx.restore();
  }
  
  function screenToWorld(screenPos: Point2D): Point2D {
    // Convert screen coordinates to world coordinates using fixed origin position
    const originX = canvas.width * 0.25 + offset.x;
    const originY = canvas.height * 0.75 + offset.y;
    return {
      x: (screenPos.x - originX) / totalScale,
      y: -(screenPos.y - originY) / totalScale
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
  
  function getRapidAtPoint(point: Point2D): { id: string; start: any; end: any } | null {
    if (!showRapids || rapids.length === 0) return null;
    
    const tolerance = 5 / totalScale; // Fixed tolerance in screen pixels
    
    for (const rapid of rapids) {
      if (distanceToLine(point, rapid.start, rapid.end) < tolerance) {
        return rapid;
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
        
      case 'spline':
        const spline = shape.geometry as any;
        // For hit testing, use properly evaluated NURBS points
        const evaluatedPoints = sampleNURBS(spline, 50); // Use fewer points for hit testing performance
        
        if (!evaluatedPoints || evaluatedPoints.length < 2) return false;
        
        for (let i = 0; i < evaluatedPoints.length - 1; i++) {
          if (distanceToLine(point, evaluatedPoints[i], evaluatedPoints[i + 1]) < tolerance) {
            return true;
          }
        }
        
        // Check closing segment if spline is closed
        if (spline.closed && evaluatedPoints.length > 2) {
          if (distanceToLine(point, evaluatedPoints[evaluatedPoints.length - 1], evaluatedPoints[0]) < tolerance) {
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
    mouseButton = e.button; // Track which button was pressed (0=left, 1=middle, 2=right)
    
    // Only handle shape selection with left mouse button
    if (e.button === 0) {
      const worldPos = screenToWorld(mousePos);
      
      // Check for rapid selection first (rapids are on top)
      const rapid = getRapidAtPoint(worldPos);
      if (rapid) {
        // Handle rapid selection
        if (selectedRapidId === rapid.id) {
          selectRapid(null); // Deselect if already selected
        } else {
          selectRapid(rapid.id);
        }
        return; // Don't process shape selection if rapid was clicked
      }
      
      const shape = getShapeAtPoint(worldPos);
      
      if (shape) {
        if (interactionMode === 'shapes') {
          // Edit mode - allow individual shape selection
          if (!e.ctrlKey && !selectedShapes.has(shape.id)) {
            drawingStore.clearSelection();
          }
          drawingStore.selectShape(shape.id, e.ctrlKey);
        } else if (interactionMode === 'chains') {
          // Program mode - only allow chain selection
          const chainId = getShapeChainId(shape.id, chains);
          if (chainId) {
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
            if (onChainClick) {
              onChainClick(chainId);
            }
          }
        } else if (interactionMode === 'paths') {
          // Simulation mode - only allow path/rapid selection
          const chainId = getShapeChainId(shape.id, chains);
          
          // Check if this chain has a path and handle path selection
          if (chainId && chainsWithPaths.includes(chainId)) {
            // Find the path for this chain
            const pathForChain = pathsState.paths.find(p => p.chainId === chainId);
            if (pathForChain) {
              // Handle path selection - don't select individual shapes
              if (selectedPathId === pathForChain.id) {
                pathStore.selectPath(null); // Deselect if already selected
              } else {
                pathStore.selectPath(pathForChain.id);
              }
            }
          }
          // Don't select individual shapes in paths mode
        }
      } else if (!e.ctrlKey) {
        // Clear all selections when clicking in empty space
        drawingStore.clearSelection();
        clearChainSelection();
        clearHighlight();
        pathStore.selectPath(null);
        clearPathHighlight();
        selectRapid(null);
        clearRapidHighlight();
      }
    }
  }
  
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  function handleMouseMove(e: MouseEvent) {
    const newMousePos = { x: e.offsetX, y: e.offsetY };
    
    if (isMouseDown && dragStart) {
      if (mouseButton === 0 && selectedShapes.size > 0 && !disableDragging) {
        // Move selected shapes with left mouse button (only if dragging is enabled)
        const worldDelta = {
          x: (newMousePos.x - mousePos.x) / totalScale,
          y: -(newMousePos.y - mousePos.y) / totalScale
        };
        
        drawingStore.moveShapes(Array.from(selectedShapes), worldDelta);
      } else if ((mouseButton === 1 || mouseButton === 2)) {
        // Pan view with middle or right mouse button
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
      // Throttle hover detection to improve performance
      if (hoverTimeout !== null) {
        clearTimeout(hoverTimeout);
      }
      
      hoverTimeout = setTimeout(() => {
        // Handle hover detection when not dragging
        const worldPos = screenToWorld(newMousePos);
        const shape = getShapeAtPoint(worldPos);
        
        if (interactionMode === 'shapes') {
          // Edit mode - show hover for individual shapes
          drawingStore.setHoveredShape(shape ? shape.id : null);
        } else if (interactionMode === 'chains') {
          // Program mode - show hover for chains (set to actual shape, rendering handles chain highlighting)
          drawingStore.setHoveredShape(shape ? shape.id : null);
        } else if (interactionMode === 'paths') {
          // Simulation mode - don't show individual shape hover for selection purposes
          // Only hover shapes that are part of selectable paths
          if (shape) {
            const chainId = getShapeChainId(shape.id, chains);
            if (chainId && chainsWithPaths.includes(chainId)) {
              drawingStore.setHoveredShape(shape.id);
            } else {
              drawingStore.setHoveredShape(null);
            }
          } else {
            drawingStore.setHoveredShape(null);
          }
        }
        hoverTimeout = null;
      }, 16); // ~60fps throttling (16ms)
    }
    
    mousePos = newMousePos;
  }
  
  function handleMouseUp() {
    isMouseDown = false;
    dragStart = null;
    mouseButton = 0; // Reset mouse button
  }
  
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    // Calculate new scale in 5% increments
    const currentPercent = Math.round(scale * 100);
    const increment = e.deltaY > 0 ? -5 : 5;
    const newPercent = Math.max(5, currentPercent + increment); // Minimum 5% zoom
    const newScale = newPercent / 100;
    
    // Zoom towards mouse position using fixed origin
    const worldPos = screenToWorld(mousePos);
    const newTotalScale = newScale * physicalScale;
    
    const originX = canvas.width * 0.25;
    const originY = canvas.height * 0.75;
    
    const newOffset = {
      x: mousePos.x - originX - worldPos.x * newTotalScale,
      y: mousePos.y - originY + worldPos.y * newTotalScale
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
  
  // All reactive renders are now handled by the consolidated reactive block above
</script>

<div bind:this={canvasContainer} class="canvas-container">
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
</div>

<style>
  .canvas-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  
  .drawing-canvas {
    display: block; /* Important: prevent inline-block spacing issues */
    width: 100%;
    height: 100%;
    cursor: crosshair;
    outline: none;
  }
  
  .drawing-canvas:active {
    cursor: move;
  }
</style>