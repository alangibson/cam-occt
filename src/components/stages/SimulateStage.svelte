<script lang="ts">
  import AccordionPanel from '../AccordionPanel.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { pathStore } from '../../lib/stores/paths';
  import { rapidStore } from '../../lib/stores/rapids';
  import { chainStore } from '../../lib/stores/chains';
  import { operationsStore } from '../../lib/stores/operations';
  import { drawingStore } from '../../lib/stores/drawing';
  import { uiStore } from '../../lib/stores/ui';
  import { onMount, onDestroy } from 'svelte';
  import type { Shape, Point2D } from '../../types';
  import type { ShapeChain } from '../../lib/algorithms/chain-detection';
  import type { Path } from '../../lib/stores/paths';
  import type { Rapid } from '../../lib/algorithms/optimize-cut-order';
  import { getPhysicalScaleFactor } from '../../lib/utils/units';

  // Resizable columns state
  let rightColumnWidth = 280; // Default width in pixels
  let isDraggingRight = false;
  let startX = 0;
  let startWidth = 0;

  // Canvas and simulation state
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let canvasContainer: HTMLDivElement;
  let animationFrame: number;
  let isDestroyed = false;
  
  // Simulation state
  let isPlaying = false;
  let isPaused = false;
  let currentTime = 0;
  let totalTime = 0;
  let currentProgress = 0;
  let currentOperation = 'Ready';
  let lastFrameTime = 0;
  
  // Tool head position
  let toolHeadPosition: Point2D = { x: 0, y: 0 };
  
  // Animation data
  let animationSteps: Array<{
    type: 'rapid' | 'cut';
    path: Path | null;
    rapid: Rapid | null;
    startTime: number;
    endTime: number;
    distance: number;
  }> = [];

  // Store subscriptions
  let pathStoreState: any;
  let rapidStoreState: any;
  let chainStoreState: any;
  let operationsState: any;
  let drawingState: any;
  let uiState: any;
  
  // Unsubscribe functions
  let unsubscribers: Array<() => void> = [];

  // Canvas properties
  let scale = 1.0;
  let offsetX = 0;
  let offsetY = 0;
  let totalScale = 1.0;

  function handleNext() {
    workflowStore.completeStage('simulate');
    workflowStore.setStage('export');
  }

  // Setup store subscriptions
  function setupStoreSubscriptions() {
    // Clear any existing subscriptions
    unsubscribers.forEach(fn => fn());
    unsubscribers = [];
    
    unsubscribers.push(
      pathStore.subscribe(state => {
        pathStoreState = state;
        if (ctx) drawCanvas();
      })
    );
    
    unsubscribers.push(
      rapidStore.subscribe(state => {
        rapidStoreState = state;
        if (ctx) drawCanvas();
      })
    );
    
    unsubscribers.push(
      chainStore.subscribe(state => {
        chainStoreState = state;
        if (ctx) drawCanvas();
      })
    );
    
    unsubscribers.push(
      operationsStore.subscribe(state => {
        operationsState = state;
        if (ctx) drawCanvas();
      })
    );
    
    unsubscribers.push(
      drawingStore.subscribe(state => {
        drawingState = state;
        if (ctx) {
          updateCanvasScale();
          drawCanvas();
        }
      })
    );
    
    unsubscribers.push(
      uiStore.subscribe(state => {
        uiState = state;
        if (ctx) {
          updateCanvasScale();
          drawCanvas();
        }
      })
    );
  }

  // Resize canvas to fill container
  function resizeCanvas() {
    if (!canvas || !canvasContainer) return;
    
    const rect = canvasContainer.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    updateCanvasScale();
    drawCanvas();
  }

  // Update canvas scaling and offset
  function updateCanvasScale() {
    if (!drawingState || !uiState) return;
    
    const physicalScale = getPhysicalScaleFactor(drawingState.units, uiState.displayUnit);
    totalScale = scale * physicalScale;
    
    // Position origin at 25% from left, 75% from top
    offsetX = canvas.width * 0.25;
    offsetY = canvas.height * 0.75;
  }

  // Initialize simulation data
  function initializeSimulation() {
    if (!pathStoreState || !rapidStoreState) return;
    
    buildAnimationSteps();
    resetSimulation();
  }

  // Build animation steps from paths and rapids
  function buildAnimationSteps() {
    animationSteps = [];
    let currentTime = 0;
    
    // Get ordered paths and rapids
    const orderedPaths = [...pathStoreState.paths].sort((a, b) => a.order - b.order);
    const rapids = rapidStoreState.rapids;
    
    // Find starting position (first rapid start or first path start)
    if (rapids.length > 0) {
      toolHeadPosition = { ...rapids[0].start };
    } else if (orderedPaths.length > 0) {
      toolHeadPosition = getPathStartPoint(orderedPaths[0]);
    }
    
    // Interleave paths and rapids
    for (let i = 0; i < orderedPaths.length; i++) {
      const path = orderedPaths[i];
      
      // Add rapid before this path (if exists)
      if (i < rapids.length) {
        const rapid = rapids[i];
        const rapidDistance = Math.sqrt(
          Math.pow(rapid.end.x - rapid.start.x, 2) + 
          Math.pow(rapid.end.y - rapid.start.y, 2)
        );
        const rapidTime = (rapidDistance / 3000) * 60; // Convert to seconds (3000 units/min)
        
        animationSteps.push({
          type: 'rapid',
          path: null,
          rapid,
          startTime: currentTime,
          endTime: currentTime + rapidTime,
          distance: rapidDistance
        });
        
        currentTime += rapidTime;
      }
      
      // Add cut path
      const pathDistance = getPathDistance(path);
      const feedRate = path.feedRate || 1000; // Default feed rate
      const cutTime = (pathDistance / feedRate) * 60; // Convert to seconds (feedRate is units/min)
      
      animationSteps.push({
        type: 'cut',
        path,
        rapid: null,
        startTime: currentTime,
        endTime: currentTime + cutTime,
        distance: pathDistance
      });
      
      currentTime += cutTime;
    }
    
    totalTime = currentTime;
  }

  // Get starting point of a path
  function getPathStartPoint(path: Path): Point2D {
    const chain = chainStoreState?.chains?.find((c: any) => c.id === path.chainId);
    if (!chain || chain.shapes.length === 0) return { x: 0, y: 0 };
    
    const firstShape = chain.shapes[0];
    return getShapeStartPoint(firstShape);
  }

  // Get shape start point
  function getShapeStartPoint(shape: Shape): Point2D {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        return line.start;
      case 'circle':
        const circle = shape.geometry as any;
        return { x: circle.center.x + circle.radius, y: circle.center.y };
      case 'arc':
        const arc = shape.geometry as any;
        const startAngle = arc.startAngle * Math.PI / 180;
        return {
          x: arc.center.x + arc.radius * Math.cos(startAngle),
          y: arc.center.y + arc.radius * Math.sin(startAngle)
        };
      case 'polyline':
        const polyline = shape.geometry as any;
        return polyline.points.length > 0 ? { ...polyline.points[0] } : { x: 0, y: 0 };
      case 'spline':
        // For splines converted to polylines, check splineData first
        if (shape.splineData && shape.splineData.controlPoints && shape.splineData.controlPoints.length > 0) {
          return { ...shape.splineData.controlPoints[0] };
        }
        // Fall back to geometry if it's a polyline
        const splineGeom = shape.geometry as any;
        return splineGeom.points?.length > 0 ? { ...splineGeom.points[0] } : { x: 0, y: 0 };
      case 'ellipse':
        const ellipse = shape.geometry as any;
        return ellipse.center;
      default:
        return { x: 0, y: 0 };
    }
  }

  // Calculate total distance of a path
  function getPathDistance(path: Path): number {
    const chain = chainStoreState?.chains?.find((c: any) => c.id === path.chainId);
    if (!chain) return 0;
    
    let totalDistance = 0;
    for (const shape of chain.shapes) {
      totalDistance += getShapeLength(shape);
    }
    return totalDistance;
  }

  // Calculate length of a shape
  function getShapeLength(shape: Shape): number {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        return Math.sqrt(
          Math.pow(line.end.x - line.start.x, 2) + 
          Math.pow(line.end.y - line.start.y, 2)
        );
      case 'circle':
        const circle = shape.geometry as any;
        return 2 * Math.PI * circle.radius;
      case 'arc':
        const arc = shape.geometry as any;
        const angleRange = Math.abs(arc.endAngle - arc.startAngle) * Math.PI / 180;
        return angleRange * arc.radius;
      case 'polyline':
        const polyline = shape.geometry as any;
        let polylineDistance = 0;
        for (let i = 0; i < polyline.points.length - 1; i++) {
          const p1 = polyline.points[i];
          const p2 = polyline.points[i + 1];
          polylineDistance += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        }
        return polylineDistance;
      case 'spline':
        // For splines converted to polylines, use splineData if available
        if (shape.splineData && shape.splineData.controlPoints && shape.splineData.controlPoints.length > 1) {
          let splineDistance = 0;
          for (let i = 0; i < shape.splineData.controlPoints.length - 1; i++) {
            const p1 = shape.splineData.controlPoints[i];
            const p2 = shape.splineData.controlPoints[i + 1];
            splineDistance += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          }
          return splineDistance;
        }
        // Fall back to geometry if it's a polyline
        const splineGeom = shape.geometry as any;
        let splineGeomDistance = 0;
        if (splineGeom.points?.length > 1) {
          for (let i = 0; i < splineGeom.points.length - 1; i++) {
            const p1 = splineGeom.points[i];
            const p2 = splineGeom.points[i + 1];
            splineGeomDistance += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          }
        }
        return splineGeomDistance;
      case 'ellipse':
        // Approximate ellipse perimeter (Ramanujan's approximation)
        const ellipse = shape.geometry as any;
        const majorRadius = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorRadius = majorRadius * ellipse.minorToMajorRatio;
        const h = Math.pow(majorRadius - minorRadius, 2) / Math.pow(majorRadius + minorRadius, 2);
        return Math.PI * (majorRadius + minorRadius) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
      default:
        return 0;
    }
  }

  // Reset simulation to beginning
  function resetSimulation() {
    isPlaying = false;
    isPaused = false;
    currentTime = 0;
    currentProgress = 0;
    currentOperation = 'Ready';
    lastFrameTime = 0;
    
    // Reset tool head to starting position
    if (animationSteps.length > 0) {
      const firstStep = animationSteps[0];
      if (firstStep.type === 'rapid' && firstStep.rapid) {
        toolHeadPosition = { ...firstStep.rapid.start };
      } else if (firstStep.type === 'cut' && firstStep.path) {
        toolHeadPosition = getPathStartPoint(firstStep.path);
      }
    }
    
    drawCanvas();
  }

  // Simulation controls
  function playSimulation() {
    if (isPaused) {
      isPaused = false;
      lastFrameTime = 0; // Reset frame time when resuming
    } else if (!isPlaying) {
      isPlaying = true;
      lastFrameTime = 0; // Reset frame time when starting
    }
    animate();
  }

  function pauseSimulation() {
    isPaused = true;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  }

  function stopSimulation() {
    isPlaying = false;
    isPaused = false;
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    resetSimulation();
  }

  // Animation loop
  function animate() {
    if (!isPlaying || isPaused || isDestroyed) return;
    
    const now = performance.now() / 1000; // Convert to seconds
    if (lastFrameTime === 0) {
      lastFrameTime = now;
    }
    
    const deltaTime = now - lastFrameTime;
    lastFrameTime = now;
    currentTime += deltaTime;
    
    if (currentTime >= totalTime) {
      // Animation complete
      currentTime = totalTime;
      currentProgress = 100;
      currentOperation = 'Complete';
      isPlaying = false;
      drawCanvas();
      workflowStore.completeStage('simulate');
      return;
    }
    
    // Update tool head position and current operation
    updateToolHeadPosition();
    
    // Update progress
    currentProgress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;
    
    drawCanvas();
    animationFrame = requestAnimationFrame(() => animate());
  }

  // Update tool head position based on current time
  function updateToolHeadPosition() {
    const currentStep = animationSteps.find(step => 
      currentTime >= step.startTime && currentTime <= step.endTime
    );
    
    if (!currentStep) return;
    
    const stepProgress = (currentTime - currentStep.startTime) / (currentStep.endTime - currentStep.startTime);
    
    if (currentStep.type === 'rapid' && currentStep.rapid) {
      currentOperation = 'Rapid Movement';
      const rapid = currentStep.rapid;
      toolHeadPosition = {
        x: rapid.start.x + (rapid.end.x - rapid.start.x) * stepProgress,
        y: rapid.start.y + (rapid.end.y - rapid.start.y) * stepProgress
      };
    } else if (currentStep.type === 'cut' && currentStep.path) {
      currentOperation = `Cutting (${currentStep.path.feedRate || 1000} units/min)`;
      updateToolHeadOnPath(currentStep.path, stepProgress);
    }
  }

  // Update tool head position along a cutting path
  function updateToolHeadOnPath(path: Path, progress: number) {
    const chain = chainStoreState?.chains?.find((c: any) => c.id === path.chainId);
    if (!chain || chain.shapes.length === 0) return;
    
    // Calculate total path length
    const totalLength = getPathDistance(path);
    const targetDistance = totalLength * progress;
    
    let currentDistance = 0;
    for (const shape of chain.shapes) {
      const shapeLength = getShapeLength(shape);
      if (currentDistance + shapeLength >= targetDistance) {
        // Tool head is on this shape
        const shapeProgress = (targetDistance - currentDistance) / shapeLength;
        toolHeadPosition = getPositionOnShape(shape, shapeProgress);
        return;
      }
      currentDistance += shapeLength;
    }
  }

  // Get position along a shape at given progress (0-1)
  function getPositionOnShape(shape: Shape, progress: number): Point2D {
    progress = Math.max(0, Math.min(1, progress)); // Clamp to 0-1
    
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        return {
          x: line.start.x + (line.end.x - line.start.x) * progress,
          y: line.start.y + (line.end.y - line.start.y) * progress
        };
      case 'circle':
        const circle = shape.geometry as any;
        const circleAngle = progress * 2 * Math.PI;
        return {
          x: circle.center.x + circle.radius * Math.cos(circleAngle),
          y: circle.center.y + circle.radius * Math.sin(circleAngle)
        };
      case 'arc':
        const arc = shape.geometry as any;
        const startAngle = arc.startAngle * Math.PI / 180;
        const endAngle = arc.endAngle * Math.PI / 180;
        const arcAngle = startAngle + (endAngle - startAngle) * progress;
        return {
          x: arc.center.x + arc.radius * Math.cos(arcAngle),
          y: arc.center.y + arc.radius * Math.sin(arcAngle)
        };
      case 'polyline':
        const polyline = shape.geometry as any;
        if (polyline.points.length < 2) return polyline.points[0] || { x: 0, y: 0 };
        
        // Find which segment we're on
        const totalLength = getShapeLength(shape);
        const targetDistance = totalLength * progress;
        
        let currentDistance = 0;
        for (let i = 0; i < polyline.points.length - 1; i++) {
          const p1 = polyline.points[i];
          const p2 = polyline.points[i + 1];
          const segmentLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          
          if (currentDistance + segmentLength >= targetDistance) {
            const segmentProgress = (targetDistance - currentDistance) / segmentLength;
            return {
              x: p1.x + (p2.x - p1.x) * segmentProgress,
              y: p1.y + (p2.y - p1.y) * segmentProgress
            };
          }
          currentDistance += segmentLength;
        }
        return polyline.points[polyline.points.length - 1];
      case 'spline':
        // For splines, use control points if available, otherwise fall back to geometry
        const controlPoints = shape.splineData?.controlPoints;
        if (controlPoints && controlPoints.length >= 2) {
          const splineIndex = Math.floor(progress * (controlPoints.length - 1));
          const splineT = (progress * (controlPoints.length - 1)) - splineIndex;
          const p1 = controlPoints[splineIndex];
          const p2 = controlPoints[Math.min(splineIndex + 1, controlPoints.length - 1)];
          return {
            x: p1.x + (p2.x - p1.x) * splineT,
            y: p1.y + (p2.y - p1.y) * splineT
          };
        }
        // Fall back to geometry points
        const splineGeom = shape.geometry as any;
        if (splineGeom.points?.length >= 2) {
          const splineIndex = Math.floor(progress * (splineGeom.points.length - 1));
          const splineT = (progress * (splineGeom.points.length - 1)) - splineIndex;
          const p1 = splineGeom.points[splineIndex];
          const p2 = splineGeom.points[Math.min(splineIndex + 1, splineGeom.points.length - 1)];
          return {
            x: p1.x + (p2.x - p1.x) * splineT,
            y: p1.y + (p2.y - p1.y) * splineT
          };
        }
        return { x: 0, y: 0 };
      case 'ellipse':
        const ellipse = shape.geometry as any;
        const angle = progress * 2 * Math.PI;
        const majorRadius = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorRadius = majorRadius * ellipse.minorToMajorRatio;
        return {
          x: ellipse.center.x + majorRadius * Math.cos(angle),
          y: ellipse.center.y + minorRadius * Math.sin(angle)
        };
      default:
        return { x: 0, y: 0 };
    }
  }

  // Draw the simulation canvas
  function drawCanvas() {
    if (!ctx || !canvas || isDestroyed) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up coordinate system
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(totalScale, -totalScale); // Flip Y axis for CAD coordinates
    
    // Draw all shapes in light gray
    if (drawingState?.shapes) {
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1 / totalScale;
      
      for (const shape of drawingState.shapes) {
        drawShape(shape);
      }
    }
    
    // Draw paths in green
    if (pathStoreState?.paths && chainStoreState?.chains) {
      ctx.strokeStyle = '#00aa00';
      ctx.lineWidth = 1.5 / totalScale;
      
      for (const path of pathStoreState.paths) {
        const chain = chainStoreState.chains.find((c: any) => c.id === path.chainId);
        if (chain) {
          for (const shape of chain.shapes) {
            drawShape(shape);
          }
        }
      }
    }
    
    // Draw rapids in blue
    if (rapidStoreState?.rapids) {
      ctx.strokeStyle = '#0066ff';
      ctx.lineWidth = 1 / totalScale;
      
      for (const rapid of rapidStoreState.rapids) {
        ctx.beginPath();
        ctx.moveTo(rapid.start.x, rapid.start.y);
        ctx.lineTo(rapid.end.x, rapid.end.y);
        ctx.stroke();
      }
    }
    
    // Draw tool head as red cross
    drawToolHead();
    
    ctx.restore();
  }

  // Draw a shape on the canvas
  function drawShape(shape: Shape) {
    ctx.save();
    
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
        const startAngle = arc.startAngle * Math.PI / 180;
        const endAngle = arc.endAngle * Math.PI / 180;
        ctx.beginPath();
        ctx.arc(arc.center.x, arc.center.y, arc.radius, startAngle, endAngle);
        ctx.stroke();
        break;
      case 'polyline':
        const polyline = shape.geometry as any;
        if (polyline.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(polyline.points[0].x, polyline.points[0].y);
          for (let i = 1; i < polyline.points.length; i++) {
            ctx.lineTo(polyline.points[i].x, polyline.points[i].y);
          }
          ctx.stroke();
        }
        break;
      case 'spline':
        // Draw spline using controlPoints if available, otherwise use geometry
        const controlPoints = shape.splineData?.controlPoints;
        if (controlPoints && controlPoints.length > 1) {
          ctx.beginPath();
          ctx.moveTo(controlPoints[0].x, controlPoints[0].y);
          for (let i = 1; i < controlPoints.length; i++) {
            ctx.lineTo(controlPoints[i].x, controlPoints[i].y);
          }
          ctx.stroke();
        } else {
          const splineGeom = shape.geometry as any;
          if (splineGeom.points?.length > 1) {
            ctx.beginPath();
            ctx.moveTo(splineGeom.points[0].x, splineGeom.points[0].y);
            for (let i = 1; i < splineGeom.points.length; i++) {
              ctx.lineTo(splineGeom.points[i].x, splineGeom.points[i].y);
            }
            ctx.stroke();
          }
        }
        break;
      case 'ellipse':
        const ellipse = shape.geometry as any;
        // Draw ellipse approximation using multiple line segments
        const majorRadius = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorRadius = majorRadius * ellipse.minorToMajorRatio;
        const segments = 32;
        
        ctx.beginPath();
        for (let i = 0; i <= segments; i++) {
          const angle = (i * 2 * Math.PI) / segments;
          const x = ellipse.center.x + majorRadius * Math.cos(angle);
          const y = ellipse.center.y + minorRadius * Math.sin(angle);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        break;
    }
    
    ctx.restore();
  }

  // Draw tool head as red cross
  function drawToolHead() {
    if (!toolHeadPosition) return;
    
    ctx.save();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2 / totalScale;
    
    const crossSize = 8 / totalScale;
    
    // Draw cross
    ctx.beginPath();
    ctx.moveTo(toolHeadPosition.x - crossSize, toolHeadPosition.y);
    ctx.lineTo(toolHeadPosition.x + crossSize, toolHeadPosition.y);
    ctx.moveTo(toolHeadPosition.x, toolHeadPosition.y - crossSize);
    ctx.lineTo(toolHeadPosition.x, toolHeadPosition.y + crossSize);
    ctx.stroke();
    
    ctx.restore();
  }

  // Format time in MM:SS format
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Load column widths from localStorage on mount and initialize canvas
  onMount(() => {
    const savedRightWidth = localStorage.getItem('cam-occt-simulate-right-column-width');
    
    if (savedRightWidth) {
      rightColumnWidth = parseInt(savedRightWidth, 10);
    }

    // Initialize canvas
    if (canvas) {
      ctx = canvas.getContext('2d')!;
      resizeCanvas();
      setupStoreSubscriptions();
      initializeSimulation();
    }

    // Add resize listener
    window.addEventListener('resize', resizeCanvas);
  });

  onDestroy(() => {
    // Mark component as destroyed
    isDestroyed = true;
    
    // Cancel animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
    // Remove event listeners
    window.removeEventListener('resize', resizeCanvas);
    
    // Unsubscribe from all stores
    unsubscribers.forEach(fn => fn());
    unsubscribers = [];
  });

  // Save column widths to localStorage
  function saveColumnWidths() {
    localStorage.setItem('cam-occt-simulate-right-column-width', rightColumnWidth.toString());
  }

  // Right column resize handlers
  function handleRightResizeStart(e: MouseEvent) {
    isDraggingRight = true;
    startX = e.clientX;
    startWidth = rightColumnWidth;
    document.addEventListener('mousemove', handleRightResize);
    document.addEventListener('mouseup', handleRightResizeEnd);
    e.preventDefault();
  }

  function handleRightResize(e: MouseEvent) {
    if (!isDraggingRight) return;
    const deltaX = startX - e.clientX; // Reverse delta for right column
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
    rightColumnWidth = newWidth;
  }

  function handleRightResizeEnd() {
    isDraggingRight = false;
    document.removeEventListener('mousemove', handleRightResize);
    document.removeEventListener('mouseup', handleRightResizeEnd);
    saveColumnWidths();
  }

  // Keyboard support for resize handles
  function handleRightKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      rightColumnWidth = Math.min(600, rightColumnWidth + 10);
      saveColumnWidths();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      rightColumnWidth = Math.max(200, rightColumnWidth - 10);
      saveColumnWidths();
      e.preventDefault();
    }
  }
</script>

<div class="simulate-stage">
  <div class="simulate-layout" class:no-select={isDraggingRight}>
    <!-- Center Column - 3D Simulation Viewport -->
    <div class="center-column">
      <div class="simulation-header">
        <h2>3D Cutting Simulation</h2>
        <div class="simulation-controls">
          <button class="control-btn" on:click={playSimulation} disabled={isPlaying && !isPaused}>
            <span>▶️</span> Play
          </button>
          <button class="control-btn" on:click={pauseSimulation} disabled={!isPlaying || isPaused}>
            <span>⏸️</span> Pause
          </button>
          <button class="control-btn" on:click={stopSimulation} disabled={!isPlaying && !isPaused}>
            <span>⏹️</span> Stop  
          </button>
          <button class="control-btn" on:click={resetSimulation}>
            <span>⏮️</span> Reset
          </button>
        </div>
      </div>

      <div class="simulation-viewport" bind:this={canvasContainer}>
        <canvas 
          bind:this={canvas}
          class="simulation-canvas"
        ></canvas>
      </div>

      <div class="simulation-progress">
        <div class="progress-info">
          <span>Progress: <strong>{currentProgress.toFixed(1)}%</strong></span>
          <span>Time: <strong>{formatTime(currentTime)} / {formatTime(totalTime)}</strong></span>
          <span>Current Operation: <strong>{currentOperation}</strong></span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {currentProgress}%"></div>
        </div>
      </div>
    </div>

    <!-- Right Column - Simulation Stats and Controls -->
    <div class="right-column" style="width: {rightColumnWidth}px;">
      <!-- Right resize handle -->
      <button 
        class="resize-handle resize-handle-left" 
        on:mousedown={handleRightResizeStart}
        on:keydown={handleRightKeydown}
        class:dragging={isDraggingRight}
        aria-label="Resize right panel (Arrow keys to adjust)"
        type="button"
      ></button>
      <AccordionPanel title="Simulation Settings" isExpanded={true}>
        <div class="setting-group">
          <label>
            <input type="checkbox" checked disabled>
            Show tool path
          </label>
          <label>
            <input type="checkbox" checked disabled>
            Show pierce points
          </label>
          <label>
            <input type="checkbox" disabled>
            Show lead-in/out
          </label>
          <label>
            <input type="checkbox" disabled>
            Realistic timing
          </label>
        </div>
      </AccordionPanel>

      <AccordionPanel title="Cut Statistics" isExpanded={true}>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Total Length:</span>
            <span class="stat-value">-- mm</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Cut Time:</span>
            <span class="stat-value">-- min</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Pierce Count:</span>
            <span class="stat-value">--</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Rapid Distance:</span>
            <span class="stat-value">-- mm</span>
          </div>
        </div>
      </AccordionPanel>

      <AccordionPanel title="Next Stage" isExpanded={true}>
        <div class="next-stage-content">
          <button 
            class="next-button"
            on:click={handleNext}
          >
            Next: Export G-code
          </button>
          <p class="next-help">
            Simulation complete! Ready to generate and export G-code.
          </p>
        </div>
      </AccordionPanel>
    </div>
  </div>
</div>

<style>
  .simulate-stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #1a1a1a;
    color: white;
  }

  .simulate-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .center-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: #2d2d2d;
  }

  .right-column {
    background-color: #1f1f1f;
    border-left: 1px solid #404040;
    padding: 1rem;
    overflow-y: auto;
    flex-shrink: 0; /* Prevent column from shrinking */
    position: relative; /* For resize handle positioning */
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .simulation-header {
    padding: 1rem 2rem;
    border-bottom: 1px solid #404040;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #252525;
  }

  .simulation-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
  }

  .simulation-controls {
    display: flex;
    gap: 0.5rem;
  }

  .control-btn {
    padding: 0.5rem 1rem;
    background: #404040;
    color: white;
    border: 1px solid #555;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
  }

  .control-btn:hover:not(:disabled) {
    background: #505050;
    border-color: #666;
  }

  .control-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .simulation-viewport {
    flex: 1;
    background: #1a1a1a;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    position: relative;
  }

  .simulation-canvas {
    width: 100%;
    height: 100%;
    background: #2d2d2d;
    border: 1px solid #404040;
  }


  .simulation-progress {
    padding: 1rem 2rem;
    border-top: 1px solid #404040;
    background-color: #252525;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    color: #ccc;
  }

  .progress-bar {
    height: 4px;
    background: #404040;
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #059669);
    transition: width 0.3s ease;
  }

  /* Removed .panel and .panel-title styles - now handled by AccordionPanel component */

  .next-stage-content {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .setting-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ccc;
    cursor: pointer;
  }

  .setting-group input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
  }

  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stat-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #404040;
  }

  .stat-item:last-child {
    border-bottom: none;
  }

  .stat-label {
    color: #aaa;
  }

  .stat-value {
    color: white;
    font-weight: 600;
  }

  /* Removed .next-stage-panel styles - now handled by next-stage-content within AccordionPanel */

  .next-button {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: 0.5rem;
  }

  .next-button:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }

  .next-help {
    margin: 0;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.4;
  }

  /* Resize handle styles */
  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    background: transparent;
    border: none;
    padding: 0;
    z-index: 10;
    transition: background-color 0.2s ease;
  }

  .resize-handle:hover {
    background-color: #3b82f6;
    opacity: 0.3;
  }

  .resize-handle.dragging {
    background-color: #3b82f6;
    opacity: 0.5;
  }

  .resize-handle-left {
    left: -3px; /* Half of width to center on border */
  }

  /* Prevent text selection during resize */
  .simulate-layout.no-select {
    user-select: none;
  }
</style>