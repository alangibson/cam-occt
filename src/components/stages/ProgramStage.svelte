<script lang="ts">
  import CuttingParameters from '../CuttingParameters.svelte';
  import DrawingCanvas from '../DrawingCanvas.svelte';
  import LayersInfo from '../LayersInfo.svelte';
  import { workflowStore } from '../../lib/stores/workflow';
  import { drawingStore } from '../../lib/stores/drawing';
  import { chainStore, setChains, setTolerance } from '../../lib/stores/chains';
  import { partStore, setParts, highlightPart, clearHighlight } from '../../lib/stores/parts';
  import { detectShapeChains } from '../../lib/algorithms/chain-detection';
  import { detectParts, type PartDetectionWarning } from '../../lib/algorithms/part-detection';
  import { analyzeChainTraversal, normalizeChain } from '../../lib/algorithms/chain-normalization';
  import type { CuttingParameters as CuttingParametersType, Shape } from '../../types';
  import type { ShapeChain } from '../../lib/algorithms/chain-detection';
  import type { ChainNormalizationResult } from '../../lib/algorithms/chain-normalization';

  let cuttingParameters: CuttingParametersType = {
    feedRate: 1000,
    pierceHeight: 3.8,
    pierceDelay: 0.5,
    cutHeight: 1.5,
    kerf: 1.5,
    leadInLength: 5,
    leadOutLength: 5
  };

  // Chain detection parameters
  let tolerance = $chainStore.tolerance;
  let isDetectingChains = false;
  let isDetectingParts = false;
  let isNormalizing = false;
  
  // Reactive chain and part data
  $: detectedChains = $chainStore.chains;
  $: detectedParts = $partStore.parts;
  $: partWarnings = $partStore.warnings;
  $: highlightedPartId = $partStore.highlightedPartId;
  
  // Chain normalization analysis
  let chainNormalizationResults: ChainNormalizationResult[] = [];
  
  // Chain selection state
  let selectedChainId: string | null = null;
  $: selectedChain = selectedChainId ? detectedChains.find(chain => chain.id === selectedChainId) : null;
  $: selectedChainAnalysis = selectedChainId ? chainNormalizationResults.find(result => result.chainId === selectedChainId) : null;
  
  // Auto-analyze chains for traversal issues when chains change
  $: {
    if (detectedChains.length > 0) {
      chainNormalizationResults = analyzeChainTraversal(detectedChains);
    } else {
      chainNormalizationResults = [];
      selectedChainId = null;
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
    workflowStore.completeStage('program');
    workflowStore.setStage('simulate');
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
      const normalizedChains = detectedChains.map(chain => normalizeChain(chain));
      
      // Flatten normalized chains back to shapes
      const normalizedShapes = normalizedChains.flatMap(chain => chain.shapes);
      
      // Update the drawing store with normalized shapes
      drawingStore.replaceAllShapes(normalizedShapes);
      
      // Re-detect chains after normalization to update the chain store
      const newChains = detectShapeChains(normalizedShapes, { tolerance });
      setChains(newChains);
      
      console.log(`Normalized chains. Re-detected ${newChains.length} chains.`);
      
    } catch (error) {
      console.error('Error during chain normalization:', error);
    } finally {
      isNormalizing = false;
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
      
      const partResult = await detectParts(detectedChains, tolerance);
      
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
    
    // Single circle is always closed
    if (chain.shapes.length === 1 && chain.shapes[0].type === 'circle') {
      return true;
    }
    
    // Check if first and last points connect
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
      default:
        return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }
  }

  // Chain selection functions
  function handleChainClick(chainId: string) {
    if (selectedChainId === chainId) {
      selectedChainId = null;
    } else {
      selectedChainId = chainId;
    }
  }

  // Auto-complete program stage (user can adjust parameters and continue)
  workflowStore.completeStage('program');
</script>

<div class="program-stage">
  <div class="program-layout">
    <!-- Left Column -->
    <div class="left-column">
      <!-- <div class="panel">
        <h3 class="panel-title">Cutting Parameters</h3>
        <CuttingParameters bind:parameters={cuttingParameters} units="mm" />
      </div> -->

      <div class="panel">
        <LayersInfo />
      </div>

      <div class="panel">
        <h3 class="panel-title">Parts</h3>
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
      </div>

      <div class="panel">
        <h3 class="panel-title">Chains</h3>
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
      </div>

      <div class="panel next-stage-panel">
        <button 
          class="next-button"
          on:click={handleNext}
        >
          Next: Simulate Cutting
        </button>
        <p class="next-help">
          Review your tool paths and simulate the cutting process.
        </p>
      </div>
    </div>

    <!-- Center Column -->
    <div class="center-column">
      <div class="canvas-header">
        <div class="chain-detection-toolbar">
          <div class="toolbar-section">
            <label class="input-label">
              Tolerance (units):
              <input 
                type="number" 
                bind:value={tolerance} 
                min="0.001" 
                max="10" 
                step="0.001"
                class="tolerance-input"
              />
            </label>
            
            <button 
              class="detect-chains-button"
              on:click={handleDetectChains}
              disabled={isDetectingChains}
            >
              {isDetectingChains ? 'Detecting...' : 'Detect Chains'}
            </button>
            
            <button 
              class="normalize-button"
              on:click={handleNormalizeChains}
              disabled={isNormalizing || detectedChains.length === 0}
            >
              {isNormalizing ? 'Normalizing...' : 'Normalize Chains'}
            </button>
            
            <button 
              class="detect-parts-button"
              on:click={handleDetectParts}
              disabled={isDetectingParts || detectedChains.length === 0}
            >
              {isDetectingParts ? 'Detecting...' : 'Detect Parts'}
            </button>
          </div>

          {#if detectedChains.length > 0 || detectedParts.length > 0}
            <div class="toolbar-results">
              {#if detectedChains.length > 0}
                <span class="chain-summary-inline">
                  {detectedChains.length} chains with {detectedChains.reduce((sum, chain) => sum + chain.shapes.length, 0)} connected shapes
                </span>
              {/if}
              {#if detectedParts.length > 0}
                <span class="part-summary-inline">
                  {detectedParts.length} parts detected
                </span>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      <div class="canvas-container">
        <DrawingCanvas 
          respectLayerVisibility={false} 
          treatChainsAsEntities={true}
          onChainClick={handleChainClick}
        />
      </div>
    </div>

    <!-- Right Column -->
    <div class="right-column">
      {#if selectedChain && selectedChainAnalysis}
        <div class="panel chain-detail-panel">
          <h3 class="panel-title">Chain Details</h3>
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
        </div>
      {/if}

      {#if partWarnings.length > 0}
        <div class="panel warning-panel">
          <h3 class="panel-title">Part Detection Warnings</h3>
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
        </div>
      {/if}

      {#if chainTraversalIssues.length > 0}
        <div class="panel traversal-warning-panel">
          <h3 class="panel-title">Chain Traversal Issues</h3>
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
        </div>
      {/if}

      
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
    width: 280px;
    background-color: #f5f5f5;
    border-right: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .center-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    background-color: white;
  }

  .right-column {
    width: 280px;
    background-color: #f5f5f5;
    border-left: 1px solid #e5e7eb;
    padding: 1rem;
    overflow-y: auto;
  }

  .panel {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
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
  }

  .next-stage-panel {
    margin-top: auto;
    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    color: white;
    border: none;
  }

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


  .input-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
  }

  .tolerance-input {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background-color: white;
    transition: border-color 0.2s ease;
  }

  .tolerance-input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

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

  .toolbar-results {
    display: flex;
    align-items: center;
  }

  .chain-summary-inline {
    font-size: 0.875rem;
    color: #4b5563;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    background-color: #f0f9ff;
    border: 1px solid #0ea5e9;
    border-radius: 0.375rem;
  }

  .part-summary-inline {
    font-size: 0.875rem;
    color: #4b5563;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    background-color: #f0fdf4;
    border: 1px solid #22c55e;
    border-radius: 0.375rem;
    margin-left: 0.5rem;
  }

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

  /* Parts list styles */
  .panel-title {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    padding-bottom: 0.5rem;
  }

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

  /* Warning styles */
  .warning-panel {
    border-left: 4px solid #f59e0b;
  }

  .warning-panel .panel-title {
    color: #f59e0b;
  }

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

  /* Chain traversal warning styles */
  .traversal-warning-panel {
    border-left: 4px solid #dc2626;
  }

  .traversal-warning-panel .panel-title {
    color: #dc2626;
  }

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

  /* Chain detail panel styles */
  .chain-detail-panel {
    border-left: 4px solid #3b82f6;
  }

  .chain-detail-panel .panel-title {
    color: #3b82f6;
  }

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
</style>