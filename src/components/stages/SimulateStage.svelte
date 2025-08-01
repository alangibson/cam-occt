<script lang="ts">
  import AccordionPanel from '../AccordionPanel.svelte';
  import DrawingCanvasContainer from '../DrawingCanvasContainer.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { pathStore } from '../../lib/stores/paths';
  import { rapidStore } from '../../lib/stores/rapids';
  import { chainStore } from '../../lib/stores/chains';
  import { operationsStore } from '../../lib/stores/operations';
  import { drawingStore } from '../../lib/stores/drawing';
  import { toolStore } from '../../lib/stores/tools';
  import { uiStore } from '../../lib/stores/ui';
  import { overlayStore } from '../../lib/stores/overlay';
  import { onMount, onDestroy } from 'svelte';
  import type { Shape, Point2D } from '../../types';
  import type { ShapeChain } from '../../lib/algorithms/chain-detection';
  import type { Path } from '../../lib/stores/paths';
  import type { Rapid } from '../../lib/algorithms/optimize-cut-order';
  import { getPhysicalScaleFactor } from '../../lib/utils/units';
  import { evaluateNURBS, sampleNURBS } from '../../lib/geometry/nurbs';
  import { calculateLeads, type LeadInConfig, type LeadOutConfig } from '../../lib/algorithms/lead-calculation';
  import type { DetectedPart } from '../../lib/algorithms/part-detection';
  import { LeadType } from '../../lib/types/direction';

  // Resizable columns state
  let rightColumnWidth = 280; // Default width in pixels
  let isDraggingRight = false;
  let startX = 0;
  let startWidth = 0;

  // Simulation state
  let animationFrame: number | null = null;
  let isDestroyed = false;
  
  // Simulation state
  let isPlaying = false;
  let isPaused = false;
  let currentTime = 0;
  let totalTime = 0;
  let currentProgress = 0;
  let currentOperation = 'Ready';
  let lastFrameTime = 0;
  
  // Tool head position and animation data
  let toolHeadPosition: Point2D = { x: 0, y: 0 };
  
  // Animation data
  let animationSteps: Array<{
    type: 'rapid' | 'cut';
    path: Path | null;
    rapid: Rapid | null;
    startTime: number;
    endTime: number;
    distance: number;
    rapidRate?: number; // For rapid movements
  }> = [];

  // Store subscriptions
  let pathStoreState: any;
  let rapidStoreState: any;
  let chainStoreState: any;
  let operationsState: any;
  let drawingState: any;
  let toolStoreState: any;
  
  // Unsubscribe functions
  let unsubscribers: Array<() => void> = [];

  function handleNext() {
    workflowStore.completeStage('simulate');
    workflowStore.setStage('export');
  }

  // Update tool head overlay when position changes
  $: if (toolHeadPosition) {
    overlayStore.setToolHead('simulate', toolHeadPosition);
  }

  // Setup store subscriptions
  function setupStoreSubscriptions() {
    // Clear any existing subscriptions
    unsubscribers.forEach(fn => fn());
    unsubscribers = [];
    
    unsubscribers.push(
      pathStore.subscribe(state => {
        pathStoreState = state;
      })
    );
    
    unsubscribers.push(
      rapidStore.subscribe(state => {
        rapidStoreState = state;
      })
    );
    
    unsubscribers.push(
      chainStore.subscribe(state => {
        chainStoreState = state;
      })
    );
    
    unsubscribers.push(
      operationsStore.subscribe(state => {
        operationsState = state;
      })
    );
    
    unsubscribers.push(
      drawingStore.subscribe(state => {
        drawingState = state;
      })
    );
    
    unsubscribers.push(
      toolStore.subscribe(state => {
        toolStoreState = state;
      })
    );
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
    
    // Process paths and rapids in sequence
    // Note: The optimization algorithm generates rapids to connect between paths
    // Rapids array should have one rapid before each path (rapids.length == paths.length)
    for (let i = 0; i < orderedPaths.length; i++) {
      const path = orderedPaths[i];
      
      // Add rapid before this path if it exists
      // Rapids are generated to move from previous position to this path's start
      if (i < rapids.length) {
        const rapid = rapids[i];
        const rapidDistance = Math.sqrt(
          Math.pow(rapid.end.x - rapid.start.x, 2) + 
          Math.pow(rapid.end.y - rapid.start.y, 2)
        );
        const rapidRate = getRapidRateForPath(path); // Get rapid rate from path's tool
        const rapidTime = (rapidDistance / rapidRate) * 60; // Convert to seconds
        
        animationSteps.push({
          type: 'rapid',
          path: null,
          rapid,
          startTime: currentTime,
          endTime: currentTime + rapidTime,
          distance: rapidDistance,
          rapidRate: rapidRate
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

  // Get rapid rate for a path based on its tool
  function getRapidRateForPath(path: Path): number {
    if (!toolStoreState || !path.toolId) {
      return 3000; // Default rapid rate if no tool specified
    }
    
    const tool = toolStoreState.find((t: any) => t.id === path.toolId);
    return tool?.rapidRate || 3000; // Use tool's rapid rate or default
  }

  // Get starting point of a path, accounting for lead-in
  function getPathStartPoint(path: Path): Point2D {
    const chain = chainStoreState?.chains?.find((c: any) => c.id === path.chainId);
    if (!chain || chain.shapes.length === 0) return { x: 0, y: 0 };
    
    // Check if path has lead-in
    if (path.leadInType && path.leadInType !== 'none' && path.leadInLength && path.leadInLength > 0) {
      try {
        // Find the part that contains this chain
        const part = findPartForChain(path.chainId);
        
        const leadInConfig: LeadInConfig = {
          type: path.leadInType,
          length: path.leadInLength,
          flipSide: path.leadInFlipSide || false
        };
        const leadOutConfig: LeadOutConfig = {
          type: path.leadOutType || LeadType.NONE,
          length: path.leadOutLength || 0,
          flipSide: path.leadOutFlipSide || false
        };
        
        const leadResult = calculateLeads(chain, leadInConfig, leadOutConfig, path.cutDirection, part);
        
        if (leadResult.leadIn && leadResult.leadIn.points.length > 0) {
          // Return the first point of the lead-in (start of lead-in)
          return leadResult.leadIn.points[0];
        }
      } catch (error) {
        console.warn('Failed to calculate lead-in for path:', path.name, error);
      }
    }
    
    // Fallback to chain start point
    const firstShape = chain.shapes[0];
    // Simplified shape start point calculation
    const line = firstShape.geometry as any;
    return line.start || line.center || { x: 0, y: 0 };
  }
  
  // Get ending point of a path, accounting for lead-out
  function getPathEndPoint(path: Path): Point2D {
    const chain = chainStoreState?.chains?.find((c: any) => c.id === path.chainId);
    if (!chain || chain.shapes.length === 0) return { x: 0, y: 0 };
    
    // Check if path has lead-out
    if (path.leadOutType && path.leadOutType !== 'none' && path.leadOutLength && path.leadOutLength > 0) {
      try {
        // Find the part that contains this chain
        const part = findPartForChain(path.chainId);
        
        const leadInConfig: LeadInConfig = {
          type: path.leadInType || LeadType.NONE,
          length: path.leadInLength || 0,
          flipSide: path.leadInFlipSide || false
        };
        const leadOutConfig: LeadOutConfig = {
          type: path.leadOutType,
          length: path.leadOutLength,
          flipSide: path.leadOutFlipSide || false
        };
        
        const leadResult = calculateLeads(chain, leadInConfig, leadOutConfig, path.cutDirection, part);
        
        if (leadResult.leadOut && leadResult.leadOut.points.length > 0) {
          // Return the last point of the lead-out (end of lead-out)
          return leadResult.leadOut.points[leadResult.leadOut.points.length - 1];
        }
      } catch (error) {
        console.warn('Failed to calculate lead-out for path:', path.name, error);
      }
    }
    
    // Fallback to chain end point
    const lastShape = chain.shapes[chain.shapes.length - 1];
    // Simplified shape end point calculation
    const line = lastShape.geometry as any;
    return line.end || line.center || { x: 0, y: 0 };
  }
  
  // Helper function to find the part that contains a given chain
  function findPartForChain(chainId: string): DetectedPart | undefined {
    // We need to get parts from somewhere - this might need to be added to the store subscriptions
    // For now, return undefined (will use fallback behavior)
    return undefined;
  }

  // Calculate total distance of a path, including lead-in and lead-out
  function getPathDistance(path: Path): number {
    const chain = chainStoreState?.chains?.find((c: any) => c.id === path.chainId);
    if (!chain) return 0;
    
    // Calculate chain distance
    let chainDistance = 0;
    for (const shape of chain.shapes) {
      chainDistance += getShapeLength(shape);
    }
    
    // Add lead distances if present
    let leadInDistance = 0;
    let leadOutDistance = 0;
    
    try {
      if ((path.leadInType && path.leadInType !== 'none' && path.leadInLength && path.leadInLength > 0) ||
          (path.leadOutType && path.leadOutType !== 'none' && path.leadOutLength && path.leadOutLength > 0)) {
        
        const part = findPartForChain(path.chainId);
        
        const leadInConfig: LeadInConfig = {
          type: path.leadInType || LeadType.NONE,
          length: path.leadInLength || 0,
          flipSide: path.leadInFlipSide || false
        };
        const leadOutConfig: LeadOutConfig = {
          type: path.leadOutType || LeadType.NONE,
          length: path.leadOutLength || 0,
          flipSide: path.leadOutFlipSide || false
        };
        
        const leadResult = calculateLeads(chain, leadInConfig, leadOutConfig, path.cutDirection, part);
        
        if (leadResult.leadIn && leadResult.leadIn.points.length > 1) {
          leadInDistance = calculatePolylineLength(leadResult.leadIn.points);
        }
        if (leadResult.leadOut && leadResult.leadOut.points.length > 1) {
          leadOutDistance = calculatePolylineLength(leadResult.leadOut.points);
        }
      }
    } catch (error) {
      console.warn('Failed to calculate lead distances for path:', path.name, error);
    }
    
    return leadInDistance + chainDistance + leadOutDistance;
  }

  // Calculate length of a shape (simplified but functional)
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
        const angleRange = Math.abs(arc.endAngle - arc.startAngle); // Angles are in radians
        return angleRange * arc.radius; // Arc length = radius * angle (in radians)
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
        const spline = shape.geometry as any;
        try {
          // Calculate arc length by sampling the NURBS curve
          const samples = sampleNURBS(spline, 100); // Use 100 samples for accurate length
          let splineLength = 0;
          for (let i = 0; i < samples.length - 1; i++) {
            const p1 = samples[i];
            const p2 = samples[i + 1];
            splineLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
          }
          return splineLength;
        } catch (error) {
          // Fallback: calculate distance between fit points or control points
          if (spline.fitPoints && spline.fitPoints.length > 1) {
            let fallbackLength = 0;
            for (let i = 0; i < spline.fitPoints.length - 1; i++) {
              const p1 = spline.fitPoints[i];
              const p2 = spline.fitPoints[i + 1];
              fallbackLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            }
            return fallbackLength;
          } else if (spline.controlPoints && spline.controlPoints.length > 1) {
            let fallbackLength = 0;
            for (let i = 0; i < spline.controlPoints.length - 1; i++) {
              const p1 = spline.controlPoints[i];
              const p2 = spline.controlPoints[i + 1];
              fallbackLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            }
            return fallbackLength;
          }
          return 100; // Final fallback
        }
      case 'ellipse':
        const ellipse = shape.geometry as any;
        // Calculate major and minor axis lengths
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
        
        // Check if it's a full ellipse or elliptical arc
        if (typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number') {
          // It's an elliptical arc - use Ramanujan's approximation for the arc portion
          const paramSpan = Math.abs(ellipse.endParam - ellipse.startParam);
          const fullEllipsePerimeter = Math.PI * (3 * (majorAxisLength + minorAxisLength) - 
            Math.sqrt((3 * majorAxisLength + minorAxisLength) * (majorAxisLength + 3 * minorAxisLength)));
          return fullEllipsePerimeter * (paramSpan / (2 * Math.PI));
        } else {
          // It's a full ellipse - use Ramanujan's approximation for ellipse perimeter
          return Math.PI * (3 * (majorAxisLength + minorAxisLength) - 
            Math.sqrt((3 * majorAxisLength + minorAxisLength) * (majorAxisLength + 3 * minorAxisLength)));
        }
      default:
        return 100; // Default fallback
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
    } else {
      toolHeadPosition = { x: 0, y: 0 };
    }
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
      workflowStore.completeStage('simulate');
      return;
    }
    
    // Update tool head position and current operation
    updateToolHeadPosition();
    
    // Update progress
    currentProgress = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;
    
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
      const rapidRate = currentStep.rapidRate || 3000;
      currentOperation = `Rapid Movement (${rapidRate} units/min)`;
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

  // Update tool head position along a cutting path, including lead-in and lead-out
  function updateToolHeadOnPath(path: Path, progress: number) {
    const chain = chainStoreState?.chains?.find((c: any) => c.id === path.chainId);
    if (!chain || chain.shapes.length === 0) return;
    
    // Get lead geometry if available
    let leadInGeometry: Point2D[] = [];
    let leadOutGeometry: Point2D[] = [];
    
    try {
      if ((path.leadInType && path.leadInType !== 'none' && path.leadInLength && path.leadInLength > 0) ||
          (path.leadOutType && path.leadOutType !== 'none' && path.leadOutLength && path.leadOutLength > 0)) {
        
        const part = findPartForChain(path.chainId);
        
        const leadInConfig: LeadInConfig = {
          type: path.leadInType || LeadType.NONE,
          length: path.leadInLength || 0,
          flipSide: path.leadInFlipSide || false
        };
        const leadOutConfig: LeadOutConfig = {
          type: path.leadOutType || LeadType.NONE,
          length: path.leadOutLength || 0,
          flipSide: path.leadOutFlipSide || false
        };
        
        const leadResult = calculateLeads(chain, leadInConfig, leadOutConfig, path.cutDirection, part);
        
        if (leadResult.leadIn && leadResult.leadIn.points.length > 1) {
          leadInGeometry = leadResult.leadIn.points;
        }
        if (leadResult.leadOut && leadResult.leadOut.points.length > 1) {
          leadOutGeometry = leadResult.leadOut.points;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate leads for simulation:', path.name, error);
    }
    
    // Calculate lengths
    const leadInLength = calculatePolylineLength(leadInGeometry);
    const chainLength = getChainDistance(chain);
    const leadOutLength = calculatePolylineLength(leadOutGeometry);
    const totalLength = leadInLength + chainLength + leadOutLength;
    
    const targetDistance = totalLength * progress;
    
    // Determine which section we're in
    if (targetDistance <= leadInLength && leadInGeometry.length > 1) {
      // We're in the lead-in
      const leadInProgress = leadInLength > 0 ? targetDistance / leadInLength : 0;
      toolHeadPosition = getPositionOnPolyline(leadInGeometry, leadInProgress);
    } else if (targetDistance <= leadInLength + chainLength) {
      // We're in the main chain
      const chainTargetDistance = targetDistance - leadInLength;
      const chainProgress = chainLength > 0 ? chainTargetDistance / chainLength : 0;
      toolHeadPosition = getPositionOnChain(chain, chainProgress, path.cutDirection);
    } else {
      // We're in the lead-out
      const leadOutTargetDistance = targetDistance - leadInLength - chainLength;
      const leadOutProgress = leadOutLength > 0 ? leadOutTargetDistance / leadOutLength : 0;
      toolHeadPosition = getPositionOnPolyline(leadOutGeometry, leadOutProgress);
    }
  }
  
  // Calculate the length of a polyline (for leads)
  function calculatePolylineLength(points: Point2D[]): number {
    if (points.length < 2) return 0;
    
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      length += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }
    return length;
  }
  
  // Get position along a polyline (for leads)
  function getPositionOnPolyline(points: Point2D[], progress: number): Point2D {
    if (points.length === 0) return { x: 0, y: 0 };
    if (points.length === 1) return points[0];
    
    progress = Math.max(0, Math.min(1, progress));
    
    const totalLength = calculatePolylineLength(points);
    const targetDistance = totalLength * progress;
    
    let currentDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const segmentLength = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      
      if (currentDistance + segmentLength >= targetDistance) {
        const segmentProgress = segmentLength > 0 ? (targetDistance - currentDistance) / segmentLength : 0;
        return {
          x: p1.x + (p2.x - p1.x) * segmentProgress,
          y: p1.y + (p2.y - p1.y) * segmentProgress
        };
      }
      currentDistance += segmentLength;
    }
    
    return points[points.length - 1];
  }
  
  // Get position along a chain (original chain geometry)
  function getPositionOnChain(chain: ShapeChain, progress: number, cutDirection: 'clockwise' | 'counterclockwise' | 'none' = 'counterclockwise'): Point2D {
    const totalLength = getChainDistance(chain);
    const targetDistance = totalLength * progress;
    
    // Determine shape order based on cut direction
    const shapes = cutDirection === 'counterclockwise' ? [...chain.shapes].reverse() : chain.shapes;
    
    let currentDistance = 0;
    for (const shape of shapes) {
      const shapeLength = getShapeLength(shape);
      if (currentDistance + shapeLength >= targetDistance) {
        // Tool head is on this shape
        const shapeProgress = shapeLength > 0 ? (targetDistance - currentDistance) / shapeLength : 0;
        // For counterclockwise cuts, reverse the shape progress as well
        const adjustedProgress = cutDirection === 'counterclockwise' ? 1.0 - shapeProgress : shapeProgress;
        return getPositionOnShape(shape, adjustedProgress, cutDirection);
      }
      currentDistance += shapeLength;
    }
    
    // Fallback to last shape end
    if (shapes.length > 0) {
      const lastShape = shapes[shapes.length - 1];
      const fallbackProgress = cutDirection === 'counterclockwise' ? 0.0 : 1.0;
      return getPositionOnShape(lastShape, fallbackProgress, cutDirection);
    }
    
    return { x: 0, y: 0 };
  }
  
  // Calculate total distance of a chain
  function getChainDistance(chain: ShapeChain): number {
    let totalDistance = 0;
    for (const shape of chain.shapes) {
      totalDistance += getShapeLength(shape);
    }
    return totalDistance;
  }

  // Get position along a shape at given progress (0-1) - simplified
  function getPositionOnShape(shape: Shape, progress: number, cutDirection: 'clockwise' | 'counterclockwise' | 'none' = 'counterclockwise'): Point2D {
    progress = Math.max(0, Math.min(1, progress)); // Clamp to 0-1
    
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        
        // Respect cut direction for lines
        if (cutDirection === 'clockwise') {
          // Reverse direction: go from end to start
          return {
            x: line.end.x + (line.start.x - line.end.x) * progress,
            y: line.end.y + (line.start.y - line.end.y) * progress
          };
        } else {
          // Default/counterclockwise: go from start to end
          return {
            x: line.start.x + (line.end.x - line.start.x) * progress,
            y: line.start.y + (line.end.y - line.start.y) * progress
          };
        }
      case 'circle':
        const circle = shape.geometry as any;
        let circleAngle: number;
        
        if (cutDirection === 'clockwise') {
          // For clockwise, start at 0 (3 o'clock) and go negative
          circleAngle = -progress * 2 * Math.PI;
        } else {
          // For counterclockwise (default), start at 0 and go positive
          circleAngle = progress * 2 * Math.PI;
        }
        
        return {
          x: circle.center.x + circle.radius * Math.cos(circleAngle),
          y: circle.center.y + circle.radius * Math.sin(circleAngle)
        };
      case 'arc':
        const arc = shape.geometry as any;
        let arcAngle: number;
        
        if (cutDirection === 'clockwise') {
          // For clockwise, go from endAngle to startAngle
          arcAngle = arc.endAngle + (arc.startAngle - arc.endAngle) * progress;
        } else {
          // For counterclockwise (default), go from startAngle to endAngle
          arcAngle = arc.startAngle + (arc.endAngle - arc.startAngle) * progress;
        }
        
        return {
          x: arc.center.x + arc.radius * Math.cos(arcAngle),
          y: arc.center.y + arc.radius * Math.sin(arcAngle)
        };
      case 'polyline':
        const polyline = shape.geometry as any;
        if (polyline.points.length < 2) return polyline.points[0] || { x: 0, y: 0 };
        
        // Respect cut direction for polylines
        const points = cutDirection === 'clockwise' ? [...polyline.points].reverse() : polyline.points;
        
        // Find which segment we're on
        const totalLength = getShapeLength(shape);
        const targetDistance = totalLength * progress;
        
        let currentDistance = 0;
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
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
        return points[points.length - 1];
      case 'spline':
        const splineGeom = shape.geometry as any;
        try {
          // Use NURBS evaluation to get position at progress along curve
          return evaluateNURBS(progress, splineGeom);
        } catch (error) {
          // Fallback: interpolate between fit points or control points
          if (splineGeom.fitPoints && splineGeom.fitPoints.length > 1) {
            const totalLength = getShapeLength(shape);
            const targetDistance = totalLength * progress;
            
            let currentDistance = 0;
            for (let i = 0; i < splineGeom.fitPoints.length - 1; i++) {
              const p1 = splineGeom.fitPoints[i];
              const p2 = splineGeom.fitPoints[i + 1];
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
            return splineGeom.fitPoints[splineGeom.fitPoints.length - 1];
          } else if (splineGeom.controlPoints && splineGeom.controlPoints.length > 1) {
            // Simple linear interpolation through control points as final fallback
            const index = Math.floor(progress * (splineGeom.controlPoints.length - 1));
            const localProgress = (progress * (splineGeom.controlPoints.length - 1)) - index;
            const p1 = splineGeom.controlPoints[index];
            const p2 = splineGeom.controlPoints[Math.min(index + 1, splineGeom.controlPoints.length - 1)];
            return {
              x: p1.x + (p2.x - p1.x) * localProgress,
              y: p1.y + (p2.y - p1.y) * localProgress
            };
          }
          return { x: 0, y: 0 }; // Final fallback
        }
      case 'ellipse':
        const ellipse = shape.geometry as any;
        // Calculate major and minor axis lengths
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
        const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
        
        let param: number;
        if (typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number') {
          // It's an elliptical arc
          if (cutDirection === 'clockwise') {
            // For clockwise, reverse the progress
            param = ellipse.endParam - (ellipse.endParam - ellipse.startParam) * progress;
          } else {
            param = ellipse.startParam + (ellipse.endParam - ellipse.startParam) * progress;
          }
        } else {
          // It's a full ellipse
          if (cutDirection === 'clockwise') {
            // For clockwise, start at 0 and go negative
            param = -progress * 2 * Math.PI;
          } else {
            // For counterclockwise (default), start at 0 and go positive
            param = progress * 2 * Math.PI;
          }
        }
        
        // Calculate point on canonical ellipse (axes aligned)
        const canonicalX = majorAxisLength * Math.cos(param);
        const canonicalY = minorAxisLength * Math.sin(param);
        
        // Rotate by major axis angle and translate to center
        const cos = Math.cos(majorAxisAngle);
        const sin = Math.sin(majorAxisAngle);
        
        return {
          x: ellipse.center.x + canonicalX * cos - canonicalY * sin,
          y: ellipse.center.y + canonicalX * sin + canonicalY * cos
        };
      default:
        return { x: 0, y: 0 };
    }
  }

  // Tool head drawing will be added as an overlay to the shared canvas
  // This removes the need for custom drawing functions

  // Format time in MM:SS format
  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Load column widths from localStorage on mount
  onMount(() => {
    const savedRightWidth = localStorage.getItem('cam-occt-simulate-right-column-width');
    
    if (savedRightWidth) {
      rightColumnWidth = parseInt(savedRightWidth, 10);
    }

    // Initialize simulation
    setupStoreSubscriptions();
    initializeSimulation();
  });

  onDestroy(() => {
    // Mark component as destroyed
    isDestroyed = true;
    
    // Cancel animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
    
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

      <div class="simulation-viewport">
        <DrawingCanvasContainer 
          currentStage="simulate"
          disableDragging={true}
          respectLayerVisibility={false}
          treatChainsAsEntities={true}
          interactionMode="paths"
        />
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