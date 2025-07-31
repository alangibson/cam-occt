<script lang="ts">
  import DrawingCanvas from '../DrawingCanvas.svelte';
  import LayersInfo from '../LayersInfo.svelte';
  import AccordionPanel from '../AccordionPanel.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { drawingStore } from '../../lib/stores/drawing';
  import { chainStore, setChains, setTolerance, selectChain } from '../../lib/stores/chains';
  import { partStore, setParts, highlightPart, clearHighlight } from '../../lib/stores/parts';
  import { detectShapeChains } from '../../lib/algorithms/chain-detection';
  import { detectParts, type PartDetectionWarning } from '../../lib/algorithms/part-detection';
  import { analyzeChainTraversal, normalizeChain } from '../../lib/algorithms/chain-normalization';
  import { tessellationStore, type TessellationPoint } from '../../lib/stores/tessellation';
  import { tessellateShape } from '../../lib/utils/tessellation';
  import { overlayStore, generateChainEndpoints } from '../../lib/stores/overlay';
  import { optimizeStartPoints } from '../../lib/algorithms/optimize-start-points';
  import type { Shape } from '../../types';
  import type { ShapeChain } from '../../lib/algorithms/chain-detection';
  import type { ChainNormalizationResult } from '../../lib/algorithms/chain-normalization';
  import type { AlgorithmParameters } from '../../types/algorithm-parameters';
  import { DEFAULT_ALGORITHM_PARAMETERS } from '../../types/algorithm-parameters';
  import { evaluateNURBS } from '../../lib/geometry/nurbs';
  import { onMount } from 'svelte';

  // Resizable columns state
  let leftColumnWidth = 280; // Default width in pixels
  let rightColumnWidth = 280; // Default width in pixels
  let isDraggingLeft = false;
  let isDraggingRight = false;
  let startX = 0;
  let startWidth = 0;

  // Chain detection parameters
  let tolerance = $chainStore.tolerance;
  let isDetectingChains = false;
  let isDetectingParts = false;
  let isNormalizing = false;
  let isOptimizingStarts = false;
  let isTessellating = false;

  // Algorithm parameters
  let algorithmParams: AlgorithmParameters = { ...DEFAULT_ALGORITHM_PARAMETERS };
  
  // Keep tolerance input synchronized with chain detection parameters
  $: {
    algorithmParams.chainDetection.tolerance = tolerance;
  }
  
  // Reactive chain and part data
  $: detectedChains = $chainStore.chains;
  $: detectedParts = $partStore.parts;
  $: partWarnings = $partStore.warnings;
  $: highlightedPartId = $partStore.highlightedPartId;

  // Update Prepare stage overlay when chains are detected (but not during normalization, and only when on prepare stage)
  $: if ($workflowStore.currentStage === 'prepare' && !isNormalizing && detectedChains.length > 0) {
    const chainEndpoints = generateChainEndpoints(detectedChains);
    overlayStore.setChainEndpoints('prepare', chainEndpoints);
  } else if ($workflowStore.currentStage === 'prepare' && !isNormalizing) {
    overlayStore.clearChainEndpoints('prepare');
  }

  // Update Prepare stage overlay when tessellation changes (only when on prepare stage)
  $: if ($workflowStore.currentStage === 'prepare' && $tessellationStore.isActive && $tessellationStore.points.length > 0) {
    // Convert tessellation store points to overlay format
    const tessellationPoints = $tessellationStore.points.map(point => ({
      x: point.x,
      y: point.y,
      shapeId: `${point.chainId}-${point.shapeIndex}`, // Create shapeId from chain and shape index
      chainId: point.chainId
    }));
    overlayStore.setTessellationPoints('prepare', tessellationPoints);
  } else if ($workflowStore.currentStage === 'prepare') {
    overlayStore.clearTessellationPoints('prepare');
  }
  
  // Chain normalization analysis
  let chainNormalizationResults: ChainNormalizationResult[] = [];
  
  // Chain selection state
  $: selectedChainId = $chainStore.selectedChainId;
  $: selectedChain = selectedChainId ? detectedChains.find(chain => chain.id === selectedChainId) : null;
  $: selectedChainAnalysis = selectedChainId ? chainNormalizationResults.find(result => result.chainId === selectedChainId) : null;
  
  // Tessellation state
  $: tessellationActive = $tessellationStore.isActive;
  
  // Auto-analyze chains for traversal issues when chains change
  $: {
    if (detectedChains.length > 0) {
      chainNormalizationResults = analyzeChainTraversal(detectedChains, algorithmParams.chainNormalization);
    } else {
      chainNormalizationResults = [];
      selectChain(null);
    }
  }
  
  // Collect all issues from chain normalization
  $: chainTraversalIssues = chainNormalizationResults.flatMap(result => 
    result.issues.map(issue => ({
      ...issue,
      chainCanTraverse: result.canTraverse,
      chainDescription: result.description
    }))
  );

  function handleNext() {
    workflowStore.completeStage('prepare');
    workflowStore.setStage('program');
  }

  function handleDetectChains() {
    isDetectingChains = true;
    
    try {
      // Get current drawing shapes from drawing store
      const currentDrawing = $drawingStore.drawing;
      if (!currentDrawing || !currentDrawing.shapes) {
        console.warn('No drawing available for chain detection');
        setChains([]);
        return;
      }

      // Update tolerance in store
      setTolerance(tolerance);
      
      // Detect chains and update store
      const chains = detectShapeChains(currentDrawing.shapes, { tolerance });
      setChains(chains);
      
      console.log(`Detected ${chains.length} chains with ${chains.reduce((sum, chain) => sum + chain.shapes.length, 0)} total shapes`);
    } catch (error) {
      console.error('Error detecting chains:', error);
      setChains([]);
    } finally {
      isDetectingChains = false;
    }
  }

  async function handleNormalizeChains() {
    const currentDrawing = $drawingStore.drawing;
    if (!currentDrawing || !currentDrawing.shapes) {
      console.warn('No drawing available to normalize');
      return;
    }

    if (detectedChains.length === 0) {
      console.warn('No chains detected. Please detect chains first.');
      return;
    }

    isNormalizing = true;
    
    try {
      // Normalize all chains
      const normalizedChains = detectedChains.map(chain => normalizeChain(chain, algorithmParams.chainNormalization));
      
      // Flatten normalized chains back to shapes
      const normalizedShapes = normalizedChains.flatMap(chain => chain.shapes);
      
      // Update the drawing store with normalized shapes
      drawingStore.replaceAllShapes(normalizedShapes);
      
      // Re-detect chains after normalization to update the chain store
      const newChains = detectShapeChains(normalizedShapes, { tolerance });
      setChains(newChains);
      
      // Force update of overlay after a short delay to ensure drawing is updated (only when on prepare stage)
      setTimeout(() => {
        if ($workflowStore.currentStage === 'prepare') {
          if (newChains.length > 0) {
            const chainEndpoints = generateChainEndpoints(newChains);
            overlayStore.setChainEndpoints('prepare', chainEndpoints);
            console.log(`Updated overlay with ${chainEndpoints.length} chain endpoints after normalization.`);
          } else {
            overlayStore.clearChainEndpoints('prepare');
          }
        }
        isNormalizing = false; // Reset flag after overlay is updated
      }, 50); // Small delay to ensure all stores are updated
      
      console.log(`Normalized chains. Re-detected ${newChains.length} chains.`);
      
    } catch (error) {
      console.error('Error during chain normalization:', error);
      isNormalizing = false; // Reset flag on error
    }
  }

  async function handleOptimizeStarts() {
    const currentDrawing = $drawingStore.drawing;
    if (!currentDrawing || !currentDrawing.shapes) {
      console.warn('No drawing available to optimize');
      return;
    }

    if (detectedChains.length === 0) {
      console.warn('No chains detected. Please detect chains first.');
      return;
    }

    isOptimizingStarts = true;
    
    try {
      // Optimize start points for all chains
      const optimizedShapes = optimizeStartPoints(detectedChains, tolerance);
      
      // Update the drawing store with optimized shapes
      drawingStore.replaceAllShapes(optimizedShapes);
      
      // Re-detect chains after optimization to update the chain store
      const newChains = detectShapeChains(optimizedShapes, { tolerance });
      setChains(newChains);
      
      // Force update of overlay after a short delay to ensure drawing is updated (only when on prepare stage)
      setTimeout(() => {
        if ($workflowStore.currentStage === 'prepare') {
          if (newChains.length > 0) {
            const chainEndpoints = generateChainEndpoints(newChains);
            overlayStore.setChainEndpoints('prepare', chainEndpoints);
            console.log(`Updated overlay with ${chainEndpoints.length} chain endpoints after optimization.`);
          } else {
            overlayStore.clearChainEndpoints('prepare');
          }
        }
        isOptimizingStarts = false; // Reset flag after overlay is updated
      }, 50); // Small delay to ensure all stores are updated
      
      console.log(`Optimized start points. Re-detected ${newChains.length} chains.`);
      
    } catch (error) {
      console.error('Error during start point optimization:', error);
      isOptimizingStarts = false; // Reset flag on error
    }
  }

  async function handleTessellateChains() {
    if (detectedChains.length === 0) {
      console.warn('No chains detected. Please detect chains first.');
      return;
    }
    
    isTessellating = true;
    
    try {
      if (tessellationActive) {
        // Clear existing tessellation
        tessellationStore.clearTessellation();
      } else {
        // Generate tessellation points
        const tessellationPoints: TessellationPoint[] = [];
        
        for (const chain of detectedChains) {
          for (let shapeIndex = 0; shapeIndex < chain.shapes.length; shapeIndex++) {
            const shape = chain.shapes[shapeIndex];
            const shapePoints = tessellateShape(shape, algorithmParams.partDetection);
            
            for (let pointIndex = 0; pointIndex < shapePoints.length; pointIndex++) {
              const point = shapePoints[pointIndex];
              tessellationPoints.push({
                x: point.x,
                y: point.y,
                chainId: chain.id,
                shapeIndex,
                pointIndex
              });
            }
          }
        }
        
        tessellationStore.setTessellation(tessellationPoints);
        console.log(`Generated ${tessellationPoints.length} tessellation points for ${detectedChains.length} chains`);
      }
    } catch (error) {
      console.error('Error tessellating chains:', error);
    } finally {
      isTessellating = false;
    }
  }
  
  async function handleDetectParts() {
    if (detectedChains.length === 0) {
      console.warn('No chains detected. Please detect chains first.');
      return;
    }
    
    isDetectingParts = true;
    
    try {
      // Add warnings for open chains first
      const openChainWarnings: PartDetectionWarning[] = [];
      for (const chain of detectedChains) {
        if (!isChainClosed(chain)) {
          const firstShape = chain.shapes[0];
          const lastShape = chain.shapes[chain.shapes.length - 1];
          const firstStart = getShapeStartPoint(firstShape);
          const lastEnd = getShapeEndPoint(lastShape);
          
          if (firstStart && lastEnd) {
            openChainWarnings.push({
              type: 'overlapping_boundary',
              chainId: chain.id,
              message: `Chain ${chain.id} is open. Start: (${firstStart.x.toFixed(2)}, ${firstStart.y.toFixed(2)}), End: (${lastEnd.x.toFixed(2)}, ${lastEnd.y.toFixed(2)})`
            });
          }
        }
      }
      
      const partResult = await detectParts(detectedChains, tolerance, algorithmParams.partDetection);
      
      // Combine open chain warnings with part detection warnings
      const allWarnings = [...openChainWarnings, ...partResult.warnings];
      setParts(partResult.parts, allWarnings);
      
      console.log(`Detected ${partResult.parts.length} parts with ${allWarnings.length} warnings`);
    } catch (error) {
      console.error('Error detecting parts:', error);
      setParts([], []);
    } finally {
      isDetectingParts = false;
    }
  }

  // Part highlighting functions
  function handlePartClick(partId: string) {
    if (highlightedPartId === partId) {
      clearHighlight();
    } else {
      highlightPart(partId);
    }
  }

  // Chain analysis functions
  function isChainClosed(chain: ShapeChain): boolean {
    if (!chain || chain.shapes.length === 0) return false;
    
    // Single shape chains - check if the shape itself is closed
    if (chain.shapes.length === 1) {
      const shape = chain.shapes[0];
      
      // Single circle is always closed
      if (shape.type === 'circle') {
        return true;
      }
      
      // Single full ellipse is always closed
      if (shape.type === 'ellipse') {
        const ellipse = shape.geometry as any;
        // Full ellipses are closed, ellipse arcs are open
        return !(typeof ellipse.startParam === 'number' && typeof ellipse.endParam === 'number');
      }
      
      // Single closed polyline
      if (shape.type === 'polyline') {
        const polyline = shape.geometry as any;
        // Use the explicit closed flag from DXF parsing if available
        if (typeof polyline.closed === 'boolean') {
          return polyline.closed;
        }
      }
    }
    
    // Multi-shape chains - check if first and last points connect
    const firstShape = chain.shapes[0];
    const lastShape = chain.shapes[chain.shapes.length - 1];
    
    const firstStart = getShapeStartPoint(firstShape);
    const lastEnd = getShapeEndPoint(lastShape);
    
    if (!firstStart || !lastEnd) return false;
    
    const distance = Math.sqrt(
      Math.pow(firstStart.x - lastEnd.x, 2) + Math.pow(firstStart.y - lastEnd.y, 2)
    );
    
    // Use ONLY the user-set tolerance
    return distance < tolerance;
  }

  function getShapeStartPoint(shape: Shape): {x: number, y: number} | null {
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
        
        // Calculate major and minor axis lengths
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
        
        // Calculate rotation angle of major axis
        const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
        
        if (typeof ellipse.startParam === 'number') {
          // Ellipse arc - return actual start point
          const startX = majorAxisLength * Math.cos(ellipse.startParam);
          const startY = minorAxisLength * Math.sin(ellipse.startParam);
          const rotatedStartX = startX * Math.cos(majorAxisAngle) - startY * Math.sin(majorAxisAngle);
          const rotatedStartY = startX * Math.sin(majorAxisAngle) + startY * Math.cos(majorAxisAngle);
          
          return {
            x: ellipse.center.x + rotatedStartX,
            y: ellipse.center.y + rotatedStartY
          };
        } else {
          // Full ellipse - return rightmost point (0 radians)
          const startX = majorAxisLength;
          const startY = 0;
          const rotatedStartX = startX * Math.cos(majorAxisAngle) - startY * Math.sin(majorAxisAngle);
          const rotatedStartY = startX * Math.sin(majorAxisAngle) + startY * Math.cos(majorAxisAngle);
          
          return {
            x: ellipse.center.x + rotatedStartX,
            y: ellipse.center.y + rotatedStartY
          };
        }
      case 'spline':
        const spline = shape.geometry as any;
        try {
          // Use proper NURBS evaluation at parameter t=0
          return evaluateNURBS(0, spline);
        } catch (error) {
          // Fallback to fit points or control points if NURBS evaluation fails
          if (spline.fitPoints && spline.fitPoints.length > 0) {
            return spline.fitPoints[0];
          }
          return spline.controlPoints && spline.controlPoints.length > 0 ? spline.controlPoints[0] : null;
        }
      default:
        return null;
    }
  }

  function getShapeEndPoint(shape: Shape): {x: number, y: number} | null {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        return line.end;
      case 'polyline':
        const polyline = shape.geometry as any;
        const points = polyline.points;
        return points.length > 0 ? points[points.length - 1] : null;
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
        
        // Calculate major and minor axis lengths
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
        
        // Calculate rotation angle of major axis
        const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
        
        if (typeof ellipse.endParam === 'number') {
          // Ellipse arc - return actual end point
          const endX = majorAxisLength * Math.cos(ellipse.endParam);
          const endY = minorAxisLength * Math.sin(ellipse.endParam);
          const rotatedEndX = endX * Math.cos(majorAxisAngle) - endY * Math.sin(majorAxisAngle);
          const rotatedEndY = endX * Math.sin(majorAxisAngle) + endY * Math.cos(majorAxisAngle);
          
          return {
            x: ellipse.center.x + rotatedEndX,
            y: ellipse.center.y + rotatedEndY
          };
        } else {
          // Full ellipse - return rightmost point (same as start for closed shape)
          const endX = majorAxisLength;
          const endY = 0;
          const rotatedEndX = endX * Math.cos(majorAxisAngle) - endY * Math.sin(majorAxisAngle);
          const rotatedEndY = endX * Math.sin(majorAxisAngle) + endY * Math.cos(majorAxisAngle);
          
          return {
            x: ellipse.center.x + rotatedEndX,
            y: ellipse.center.y + rotatedEndY
          };
        }
      case 'spline':
        const spline = shape.geometry as any;
        try {
          // Use proper NURBS evaluation at parameter t=1
          return evaluateNURBS(1, spline);
        } catch (error) {
          // Fallback to fit points or control points if NURBS evaluation fails
          if (spline.fitPoints && spline.fitPoints.length > 0) {
            return spline.fitPoints[spline.fitPoints.length - 1];
          }
          return spline.controlPoints && spline.controlPoints.length > 0 ? spline.controlPoints[spline.controlPoints.length - 1] : null;
        }
      default:
        return null;
    }
  }

  function calculateChainBoundingBox(chain: ShapeChain): {minX: number, maxX: number, minY: number, maxY: number} {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    for (const shape of chain.shapes) {
      const shapeBounds = getShapeBoundingBox(shape);
      minX = Math.min(minX, shapeBounds.minX);
      maxX = Math.max(maxX, shapeBounds.maxX);
      minY = Math.min(minY, shapeBounds.minY);
      maxY = Math.max(maxY, shapeBounds.maxY);
    }
    
    return { minX, maxX, minY, maxY };
  }

  function getShapeBoundingBox(shape: Shape): {minX: number, maxX: number, minY: number, maxY: number} {
    switch (shape.type) {
      case 'line':
        const line = shape.geometry as any;
        return {
          minX: Math.min(line.start.x, line.end.x),
          maxX: Math.max(line.start.x, line.end.x),
          minY: Math.min(line.start.y, line.end.y),
          maxY: Math.max(line.start.y, line.end.y)
        };
      case 'circle':
        const circle = shape.geometry as any;
        return {
          minX: circle.center.x - circle.radius,
          maxX: circle.center.x + circle.radius,
          minY: circle.center.y - circle.radius,
          maxY: circle.center.y + circle.radius
        };
      case 'arc':
        const arc = shape.geometry as any;
        return {
          minX: arc.center.x - arc.radius,
          maxX: arc.center.x + arc.radius,
          minY: arc.center.y - arc.radius,
          maxY: arc.center.y + arc.radius
        };
      case 'polyline':
        const polyline = shape.geometry as any;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const point of polyline.points || []) {
          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        }
        return { minX, maxX, minY, maxY };
      case 'ellipse':
        const ellipse = shape.geometry as any;
        
        // Calculate major and minor axis lengths
        const majorAxisLength = Math.sqrt(
          ellipse.majorAxisEndpoint.x * ellipse.majorAxisEndpoint.x + 
          ellipse.majorAxisEndpoint.y * ellipse.majorAxisEndpoint.y
        );
        const minorAxisLength = majorAxisLength * ellipse.minorToMajorRatio;
        
        // Calculate rotation angle of major axis
        const majorAxisAngle = Math.atan2(ellipse.majorAxisEndpoint.y, ellipse.majorAxisEndpoint.x);
        
        // For a rotated ellipse, we need to find the actual bounding box
        // This requires finding the extrema of the parametric ellipse equations
        const cos_angle = Math.cos(majorAxisAngle);
        const sin_angle = Math.sin(majorAxisAngle);
        
        // Calculate the bounding box dimensions
        const halfWidth = Math.sqrt(
          majorAxisLength * majorAxisLength * cos_angle * cos_angle +
          minorAxisLength * minorAxisLength * sin_angle * sin_angle
        );
        const halfHeight = Math.sqrt(
          majorAxisLength * majorAxisLength * sin_angle * sin_angle +
          minorAxisLength * minorAxisLength * cos_angle * cos_angle
        );
        
        return {
          minX: ellipse.center.x - halfWidth,
          maxX: ellipse.center.x + halfWidth,
          minY: ellipse.center.y - halfHeight,
          maxY: ellipse.center.y + halfHeight
        };
      default:
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
  }

  // Chain selection functions
  function handleChainClick(chainId: string) {
    // Always select the clicked chain (normal selection logic)
    selectChain(chainId);
  }
  
  // Tessellation is now handled by the imported tessellateShape function

  // Auto-complete prepare stage when chains or parts are detected
  $: if (detectedChains.length > 0 || detectedParts.length > 0) {
    workflowStore.completeStage('prepare');
  }

  // Load column widths from localStorage on mount
  onMount(() => {
    const savedLeftWidth = localStorage.getItem('cam-occt-prepare-left-column-width');
    const savedRightWidth = localStorage.getItem('cam-occt-prepare-right-column-width');
    
    if (savedLeftWidth) {
      leftColumnWidth = parseInt(savedLeftWidth, 10);
    }
    if (savedRightWidth) {
      rightColumnWidth = parseInt(savedRightWidth, 10);
    }
  });

  // Save column widths to localStorage
  function saveColumnWidths() {
    localStorage.setItem('cam-occt-prepare-left-column-width', leftColumnWidth.toString());
    localStorage.setItem('cam-occt-prepare-right-column-width', rightColumnWidth.toString());
  }

  // Left column resize handlers
  function handleLeftResizeStart(e: MouseEvent) {
    isDraggingLeft = true;
    startX = e.clientX;
    startWidth = leftColumnWidth;
    document.addEventListener('mousemove', handleLeftResize);
    document.addEventListener('mouseup', handleLeftResizeEnd);
    e.preventDefault();
  }

  function handleLeftResize(e: MouseEvent) {
    if (!isDraggingLeft) return;
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(200, Math.min(600, startWidth + deltaX)); // Min 200px, max 600px
    leftColumnWidth = newWidth;
  }

  function handleLeftResizeEnd() {
    isDraggingLeft = false;
    document.removeEventListener('mousemove', handleLeftResize);
    document.removeEventListener('mouseup', handleLeftResizeEnd);
    saveColumnWidths();
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
  function handleLeftKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      leftColumnWidth = Math.max(200, leftColumnWidth - 10);
      saveColumnWidths();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      leftColumnWidth = Math.min(600, leftColumnWidth + 10);
      saveColumnWidths();
      e.preventDefault();
    }
  }

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

<div class="program-stage">
  <div class="program-layout" class:no-select={isDraggingLeft || isDraggingRight}>
    <!-- Left Column -->
    <div class="left-column" style="width: {leftColumnWidth}px;">
      <!-- Left resize handle -->
      <button 
        class="resize-handle resize-handle-right" 
        on:mousedown={handleLeftResizeStart}
        on:keydown={handleLeftKeydown}
        class:dragging={isDraggingLeft}
        aria-label="Resize left panel (Arrow keys to adjust)"
        type="button"
      ></button>

      <AccordionPanel title="Layers" isExpanded={true}>
        <LayersInfo />
      </AccordionPanel>

      <AccordionPanel title="Parts{detectedParts.length > 0 ? ` (${detectedParts.length} parts detected)` : ''}" isExpanded={true}>
        {#if detectedParts.length > 0}
          <div class="parts-list">
            {#each detectedParts as part, index}
              <div 
                class="part-item {highlightedPartId === part.id ? 'highlighted' : ''}"
                on:click={() => handlePartClick(part.id)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && handlePartClick(part.id)}
              >
                <div class="part-header">
                  <span class="part-name">Part {index + 1}</span>
                  <span class="part-info">{part.holes.length} holes</span>
                </div>
                <div class="part-details">
                  <div class="shell-info">
                    <span class="shell-label">Shell:</span>
                    <span class="chain-ref">{part.shell.chain.shapes.length} shapes</span>
                  </div>
                  {#if part.holes.length > 0}
                    <div class="holes-info">
                      <span class="holes-label">Holes:</span>
                      {#each part.holes as hole, holeIndex}
                        <div class="hole-item">
                          <span class="hole-ref">Hole {holeIndex + 1}: {hole.chain.shapes.length} shapes</span>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <p>No parts detected yet. Click "Detect Parts" to analyze chains.</p>
          </div>
        {/if}
      </AccordionPanel>

      <AccordionPanel title="Chains{detectedChains.length > 0 ? ` (${detectedChains.length} chains with ${detectedChains.reduce((sum, chain) => sum + chain.shapes.length, 0)} connected shapes)` : ''}" isExpanded={true}>
        {#if detectedChains.length > 0}
          <div class="chain-summary">
            {#each chainNormalizationResults as result}
              <div class="chain-summary-item {selectedChainId === result.chainId ? 'selected' : ''}" 
                role="button"
                tabindex="0"
                on:click={() => handleChainClick(result.chainId)}
                on:keydown={(e) => e.key === 'Enter' && handleChainClick(result.chainId)}
              >
                <div class="chain-header">
                  <span class="chain-id">{result.chainId}</span>
                  <span class="traversal-status {result.canTraverse ? 'can-traverse' : 'cannot-traverse'}">
                    {result.canTraverse ? '✓' : '✗'}
                  </span>
                </div>
                <div class="chain-description">{result.description}</div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <p>No chains detected yet. Click "Detect Chains" to analyze shapes.</p>
          </div>
        {/if}
      </AccordionPanel>

      <AccordionPanel title="Next Stage" isExpanded={true}>
        <div class="next-stage-content">
          <button 
            class="next-button"
            on:click={handleNext}
          >
            Next: Program Cuts
          </button>
          <p class="next-help">
            Set cutting parameters and generate tool paths.
          </p>
        </div>
      </AccordionPanel>
    </div>

    <!-- Center Column -->
    <div class="center-column">
      <div class="canvas-header">
        <div class="chain-detection-toolbar">
          <div class="toolbar-section">
            <button 
              class="detect-chains-button"
              on:click={handleDetectChains}
              disabled={isDetectingChains}
            >
              {isDetectingChains ? 'Detecting...' : 'Detect Chains'}
            </button>
            
            <div class="toolbar-separator" aria-hidden="true">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            
            <button 
              class="normalize-button"
              on:click={handleNormalizeChains}
              disabled={isNormalizing || detectedChains.length === 0}
            >
              {isNormalizing ? 'Normalizing...' : 'Normalize Chains'}
            </button>
            
            <div class="toolbar-separator" aria-hidden="true">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            
            <button 
              class="optimize-starts-button"
              on:click={handleOptimizeStarts}
              disabled={isOptimizingStarts || detectedChains.length === 0}
            >
              {isOptimizingStarts ? 'Optimizing...' : 'Optimize Starts'}
            </button>
            
            <div class="toolbar-separator" aria-hidden="true">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            
            <button 
              class="tessellate-button"
              on:click={handleTessellateChains}
              disabled={isTessellating || detectedChains.length === 0}
            >
              {isTessellating ? 'Tessellating...' : tessellationActive ? 'Clear Tessellation' : 'Tessellate Chains'}
            </button>
            
            <div class="toolbar-separator" aria-hidden="true">
              <svg width="8" height="12" viewBox="0 0 8 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L6 6L1 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            
            <button 
              class="detect-parts-button"
              on:click={handleDetectParts}
              disabled={isDetectingParts || detectedChains.length === 0}
            >
              {isDetectingParts ? 'Detecting...' : 'Detect Parts'}
            </button>
          </div>
          

          <!-- Toolbar notices moved to accordion panel titles -->
        </div>
      </div>
      <div class="canvas-container">
        <DrawingCanvas 
          respectLayerVisibility={false} 
          treatChainsAsEntities={true}
          onChainClick={handleChainClick}
          disableDragging={true}
          currentStage="prepare"
        />
      </div>
    </div>

    <!-- Right Column -->
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
      {#if selectedChain && selectedChainAnalysis}
        <AccordionPanel title="Chain Details" isExpanded={true}>
          <div class="chain-detail">
            <div class="chain-detail-header">
              <span class="chain-id">{selectedChain.id}</span>
              <span class="traversal-status {selectedChainAnalysis.canTraverse ? 'can-traverse' : 'cannot-traverse'}">
                {selectedChainAnalysis.canTraverse ? '✓ Traversable' : '✗ Not Traversable'}
              </span>
            </div>
            <div class="chain-properties">
              <div class="property">
                <span class="property-label">Shapes:</span>
                <span class="property-value">{selectedChain.shapes.length}</span>
              </div>
              <div class="property">
                <span class="property-label">Status:</span>
                <span class="property-value {isChainClosed(selectedChain) ? 'closed' : 'open'}">
                  {isChainClosed(selectedChain) ? 'Closed' : 'Open'}
                </span>
              </div>
              <div class="property">
                <span class="property-label">Issues:</span>
                <span class="property-value">{selectedChainAnalysis.issues.length}</span>
              </div>
            </div>
            <div class="chain-shapes-list">
              <h4 class="shapes-title">Shapes in Chain:</h4>
              {#each selectedChain.shapes as shape, index}
                <div class="shape-item">
                  <span class="shape-index">{index + 1}.</span>
                  <span class="shape-type">{shape.type}</span>
                  <span class="shape-id">({shape.id})</span>
                </div>
              {/each}
            </div>
            {#if selectedChainAnalysis.issues.length > 0}
              <div class="chain-issues">
                <h4 class="issues-title">Issues:</h4>
                {#each selectedChainAnalysis.issues as issue}
                  <div class="issue-item">
                    <span class="issue-type">{issue.type.replace('_', ' ')}</span>
                    <span class="issue-description">{issue.description}</span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </AccordionPanel>
      {/if}

      {#if partWarnings.length > 0}
        <AccordionPanel title="Part Detection Warnings" isExpanded={true}>
          <div class="warnings-list">
            {#each partWarnings as warning}
              <div class="warning-item">
                <div class="warning-icon">⚠️</div>
                <div class="warning-content">
                  <div class="warning-type">{warning.type.replace('_', ' ')}</div>
                  <div class="warning-message">{warning.message}</div>
                  <div class="warning-chain">Chain ID: {warning.chainId}</div>
                </div>
              </div>
            {/each}
          </div>
        </AccordionPanel>
      {/if}

      {#if chainTraversalIssues.length > 0}
        <AccordionPanel title="Chain Traversal Issues" isExpanded={true}>
          <div class="traversal-info">
            <p class="traversal-description">
              Chains should be traversable from start to end, with each shape connecting end-to-start with the next shape.
              Issues found:
            </p>
          </div>
          <div class="warnings-list">
            {#each chainTraversalIssues as issue}
              <div class="warning-item traversal-warning">
                <div class="warning-icon">🔗</div>
                <div class="warning-content">
                  <div class="warning-type">{issue.type.replace('_', ' ')}</div>
                  <div class="warning-message">{issue.description}</div>
                  <div class="warning-details">
                    <div class="warning-chain">Chain ID: {issue.chainId}</div>
                    <div class="warning-shapes">Shapes: {issue.shapeIndex1 + 1} and {issue.shapeIndex2 + 1}</div>
                    <div class="warning-point">Point: ({issue.point1.x.toFixed(3)}, {issue.point1.y.toFixed(3)})</div>
                  </div>
                  <div class="traversal-status">
                    Can traverse: {issue.chainCanTraverse ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </AccordionPanel>
      {/if}

      <!-- Algorithm Parameters -->
      <AccordionPanel title="Algorithm Parameters" isExpanded={false}>
        <!-- Chain Detection Parameters -->
        <details class="param-group-details">
          <summary class="param-group-summary">Chain Detection</summary>
          <div class="param-group-content">
            <label class="param-label">
              Connection Tolerance:
              <input 
                type="number" 
                bind:value={algorithmParams.chainDetection.tolerance} 
                min="0.001" 
                max="10" 
                step="0.001"
                class="param-input"
                title="Distance tolerance for connecting shapes into chains."
              />
              <div class="param-description">
                Maximum distance between shape endpoints to be considered connected. 
                Higher values will connect shapes that are further apart, potentially creating longer chains. 
                Lower values require more precise endpoint alignment.
              </div>
            </label>
          </div>
        </details>

        <!-- Chain Normalization Parameters -->
        <details class="param-group-details">
          <summary class="param-group-summary">Chain Normalization</summary>
          <div class="param-group-content">
            <label class="param-label">
              Traversal Tolerance:
              <input 
                type="number" 
                bind:value={algorithmParams.chainNormalization.traversalTolerance} 
                min="0.001" 
                max="1.0" 
                step="0.001"
                class="param-input"
                title="Tolerance for floating point comparison in traversal analysis."
              />
              <div class="param-description">
                Precision tolerance for checking if shape endpoints align during chain traversal analysis. 
                Smaller values require more precise alignment between consecutive shapes. 
                Used to determine if chains can be traversed end-to-start without gaps.
              </div>
            </label>
            
            <label class="param-label">
              Max Traversal Attempts:
              <input 
                type="number" 
                bind:value={algorithmParams.chainNormalization.maxTraversalAttempts} 
                min="1" 
                max="10" 
                step="1"
                class="param-input"
                title="Maximum number of traversal attempts per chain."
              />
              <div class="param-description">
                Limits how many different starting points the algorithm tries when analyzing chain traversal. 
                Higher values are more thorough but slower for complex chains. 
                Lower values improve performance but may miss valid traversal paths.
              </div>
            </label>
          </div>
        </details>

        <!-- Part Detection Parameters -->
        <details class="param-group-details">
          <summary class="param-group-summary">Part Detection</summary>
          <div class="param-group-content">
            <div class="param-grid">
              <label class="param-label">
                Circle Points:
                <input 
                  type="number" 
                  bind:value={algorithmParams.partDetection.circleTessellationPoints} 
                  min="8" 
                  max="128" 
                  step="1"
                  class="param-input"
                  title="Number of points to tessellate circles into. Higher = better precision but slower."
                />
                <div class="param-description">
                  Number of straight line segments used to approximate circles for geometric operations. 
                  Higher values provide better accuracy for containment detection but slower performance. 
                  Increase for complex files with precision issues.
                </div>
              </label>
              
              <label class="param-label">
                Min Arc Points:
                <input 
                  type="number" 
                  bind:value={algorithmParams.partDetection.minArcTessellationPoints} 
                  min="4" 
                  max="64" 
                  step="1"
                  class="param-input"
                  title="Minimum number of points for arc tessellation."
                />
                <div class="param-description">
                  Minimum number of points for arc tessellation, regardless of arc length. 
                  Ensures even very small arcs have adequate geometric representation. 
                  Higher values improve precision for tiny arc segments.
                </div>
              </label>
              
              <label class="param-label">
                Arc Precision:
                <input 
                  type="number" 
                  bind:value={algorithmParams.partDetection.arcTessellationDensity} 
                  min="0.01" 
                  max="0.5" 
                  step="0.01"
                  class="param-input"
                  title="Arc tessellation density factor. Smaller = more points."
                />
                <div class="param-description">
                  Controls how finely arcs are divided into line segments (radians per point). 
                  Smaller values create more points and better precision. 
                  Larger values use fewer points for faster processing but less accuracy.
                </div>
              </label>
              
              <label class="param-label">
                Decimal Precision:
                <input 
                  type="number" 
                  bind:value={algorithmParams.partDetection.decimalPrecision} 
                  min="1" 
                  max="6" 
                  step="1"
                  class="param-input"
                  title="Decimal precision for coordinate rounding."
                />
                <div class="param-description">
                  Number of decimal places for coordinate rounding to avoid floating-point errors. 
                  Higher values preserve more precision but may cause numerical instability. 
                  Lower values improve robustness but may lose fine geometric details.
                </div>
              </label>
            </div>
          </div>
        </details>
      </AccordionPanel>

      
      <!-- Hidden for now -->
      <!-- <div class="panel">
        <h3 class="panel-title">Tool Path Information</h3>
        <p class="placeholder-text">
          Tool path generation and optimization features will be implemented here.
        </p>
        <ul class="info-list">
          <li>Total cutting length: <strong>--</strong></li>
          <li>Estimated cut time: <strong>--</strong></li>
          <li>Number of pierces: <strong>--</strong></li>
          <li>Tool path optimization: <strong>Enabled</strong></li>
        </ul>
      </div> -->
    </div>
  </div>
</div>

<style>
  .program-stage {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #f8f9fa;
  }

  .program-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .left-column {
    background-color: #f5f5f5;
    border-right: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0; /* Allow flex child to shrink */
    flex-shrink: 0; /* Prevent column from shrinking */
    position: relative; /* For resize handle positioning */
  }

  .center-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: white;
  }

  .right-column {
    background-color: #f5f5f5;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0; /* Allow flex child to shrink */
    flex-shrink: 0; /* Prevent column from shrinking */
    position: relative; /* For resize handle positioning */
  }

  /* Removed .panel styles - now handled by AccordionPanel component */

  .next-stage-content {
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .canvas-header {
    padding: 1rem 2rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #fafafa;
  }

  .canvas-container {
    flex: 1;
    position: relative;
    background-color: white;
    overflow: hidden; /* Prevent canvas from growing container */
    min-height: 0; /* Allow flexbox to shrink */
  }

  /* Removed .next-stage-panel - now handled by next-stage-content within AccordionPanel */

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


  /* .input-label removed - tolerance input removed from toolbar */

  /* .tolerance-input removed - moved to Algorithm Parameters */

  /* .tolerance-input:focus removed - moved to Algorithm Parameters */

  .detect-chains-button {
    padding: 0.75rem 1rem;
    background-color: #4f46e5;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .detect-chains-button:hover:not(:disabled) {
    background-color: #4338ca;
  }

  .detect-chains-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }


  /* Toolbar styles */
  .chain-detection-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .toolbar-separator {
    color: #d1d5db;
    margin: 0 0.25rem;
  }

  /* .toolbar-results removed - notices moved to accordion titles */

  /* .chain-summary-inline removed - moved to accordion title */

  /* .part-summary-inline removed - moved to accordion title */

  .detect-parts-button {
    padding: 0.75rem 1rem;
    background-color: #22c55e;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .detect-parts-button:hover:not(:disabled) {
    background-color: #16a34a;
  }

  .detect-parts-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  .normalize-button {
    padding: 0.75rem 1rem;
    background-color: #f59e0b;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .normalize-button:hover:not(:disabled) {
    background-color: #d97706;
  }

  .normalize-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  .optimize-starts-button {
    padding: 0.75rem 1rem;
    background-color: #10b981;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .optimize-starts-button:hover:not(:disabled) {
    background-color: #059669;
  }

  .optimize-starts-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  .tessellate-button {
    padding: 0.75rem 1rem;
    background-color: #8b5cf6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 0.875rem;
  }

  .tessellate-button:hover:not(:disabled) {
    background-color: #7c3aed;
  }

  .tessellate-button:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }

  /* Parts list styles - .panel-title now handled by AccordionPanel component */

  .parts-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .part-item {
    padding: 0.75rem;
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .part-item:hover {
    background-color: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .part-item.highlighted {
    background-color: #eff6ff;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .part-item.highlighted:hover {
    background-color: #dbeafe;
    border-color: #2563eb;
  }

  .part-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .part-name {
    font-weight: 600;
    color: #1e40af;
    font-size: 0.875rem;
  }

  .part-info {
    font-size: 0.75rem;
    color: #6b7280;
    background-color: #e5e7eb;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .part-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
  }

  .shell-info, .holes-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .shell-label, .holes-label {
    font-weight: 500;
    color: #374151;
  }

  .chain-ref, .hole-ref {
    color: #6b7280;
    margin-left: 0.5rem;
  }

  .hole-item {
    margin-left: 0.5rem;
  }

  /* Warning styles - panel styles now handled by AccordionPanel component */

  .warnings-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .warning-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: #fffbeb;
    border: 1px solid #fed7aa;
    border-radius: 0.375rem;
  }

  .warning-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .warning-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .warning-type {
    font-weight: 600;
    color: #f59e0b;
    font-size: 0.875rem;
    text-transform: capitalize;
  }

  .warning-message {
    color: #78716c;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .warning-chain {
    color: #a8a29e;
    font-size: 0.75rem;
    font-family: monospace;
  }

  /* Chain traversal warning styles - panel styles now handled by AccordionPanel component */

  .traversal-info {
    margin-bottom: 1rem;
  }

  .traversal-description {
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.4;
    margin: 0;
  }

  .traversal-warning {
    background-color: #fef2f2;
    border-color: #fecaca;
  }

  .warning-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }

  .warning-shapes, .warning-point {
    color: #6b7280;
    font-size: 0.75rem;
    font-family: monospace;
  }

  .traversal-status {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    margin-top: 0.5rem;
    display: inline-block;
    width: fit-content;
  }

  .traversal-warning .traversal-status {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
  }

  /* Chain summary styles */
  .chain-summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .chain-summary-item {
    padding: 0.75rem;
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  }

  .chain-summary-item:hover {
    background-color: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .chain-summary-item.selected {
    background-color: #eff6ff;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .chain-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .chain-id {
    font-weight: 600;
    color: #1e40af;
    font-size: 0.875rem;
    font-family: monospace;
  }

  .traversal-status.can-traverse {
    color: #16a34a;
    font-weight: bold;
  }

  .traversal-status.cannot-traverse {
    color: #dc2626;
    font-weight: bold;
  }

  .chain-description {
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.4;
  }

  /* Empty state styles */
  .empty-state {
    padding: 1rem;
    text-align: center;
    color: #6b7280;
    font-style: italic;
    background-color: #f9fafb;
    border: 1px dashed #d1d5db;
    border-radius: 0.375rem;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  /* Chain detail panel styles - panel styles now handled by AccordionPanel component */

  .chain-detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .chain-detail-header .chain-id {
    font-weight: 600;
    color: #1e40af;
    font-size: 1rem;
    font-family: monospace;
  }

  .chain-detail-header .traversal-status {
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
  }

  .chain-properties {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .property {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .property-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .property-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
  }

  .property-value.closed {
    color: #059669; /* Green for closed chains */
  }

  .property-value.open {
    color: #dc2626; /* Red for open chains */
  }

  .shapes-title, .issues-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.5rem 0;
  }

  .chain-shapes-list {
    margin-bottom: 1rem;
  }

  .shape-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
  }

  .shape-index {
    font-weight: 600;
    color: #6b7280;
    min-width: 1.5rem;
  }

  .shape-type {
    font-weight: 500;
    color: #374151;
    text-transform: capitalize;
  }

  .shape-id {
    color: #6b7280;
    font-family: monospace;
  }

  .chain-issues {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    padding: 0.75rem;
  }

  .issue-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .issue-item:last-child {
    margin-bottom: 0;
  }

  .issue-type {
    font-size: 0.75rem;
    font-weight: 600;
    color: #dc2626;
    text-transform: capitalize;
  }

  .issue-description {
    font-size: 0.75rem;
    color: #6b7280;
    line-height: 1.4;
  }

  /* Algorithm parameters styles - panel styles now handled by AccordionPanel component */

  .param-group-details {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    margin-bottom: 0.75rem;
    overflow: hidden;
  }

  .param-group-details:last-child {
    margin-bottom: 0;
  }

  .param-group-summary {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    background-color: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
    transition: background-color 0.2s ease;
  }

  .param-group-summary:hover {
    background-color: #e2e8f0;
  }

  .param-group-content {
    padding: 0.75rem;
    background-color: white;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .param-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .param-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
  }

  .param-input {
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    background-color: white;
    transition: border-color 0.2s ease;
    width: 100%;
  }

  .param-input:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }

  .param-description {
    font-size: 0.7rem;
    color: #6b7280;
    line-height: 1.3;
    margin-top: 0.25rem;
    font-style: italic;
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

  .resize-handle-right {
    right: -3px; /* Half of width to center on border */
  }

  .resize-handle-left {
    left: -3px; /* Half of width to center on border */
  }

  /* Prevent text selection during resize */
  .program-layout.no-select {
    user-select: none;
  }

  @media (max-width: 1200px) {
    .left-column,
    .right-column {
      width: 240px;
    }
  }

  @media (max-width: 768px) {
    .program-layout {
      flex-direction: column;
    }

    .left-column,
    .right-column {
      width: 100%;
      height: auto;
      max-height: 200px;
    }

    .center-column {
      flex: 1;
      min-height: 400px;
    }
  }
</style>