<script lang="ts">
	import { appState } from '$lib/stores.svelte.js';

	interface Props {
		editedStartX?: number;
		editedStartY?: number;
		editedEndX?: number;
		editedEndY?: number;
		editedOriginX?: number;
		editedOriginY?: number;
		onModifyShape?: (modifications: {
			startX?: number;
			startY?: number;
			endX?: number;
			endY?: number;
			originX?: number;
			originY?: number;
		}) => void;
		onDeleteSelected?: () => void;
		isModifyingShape?: boolean;
	}

	let {
		editedStartX = $bindable(0),
		editedStartY = $bindable(0),
		editedEndX = $bindable(0),
		editedEndY = $bindable(0),
		editedOriginX = $bindable(0),
		editedOriginY = $bindable(0),
		onModifyShape,
		onDeleteSelected,
		isModifyingShape = false
	}: Props = $props();

	function handleModifyShape() {
		if (onModifyShape) {
			onModifyShape({
				startX: editedStartX,
				startY: editedStartY,
				endX: editedEndX,
				endY: editedEndY,
				originX: editedOriginX,
				originY: editedOriginY
			});
		}
	}
</script>

<div class="properties-panel">
	<h3>Shape Properties</h3>
	
	{#if appState.selectedShapeInfo}
		<div class="shape-info">
			<h4>Selected: {appState.selectedShapeInfo.name || 'Shape'} (Index: {appState.selectedShapeInfo.shapeIndex})</h4>
			
			{#if appState.selectedShapeInfo.startPoint && appState.selectedShapeInfo.endPoint}
				<div class="coordinate-group">
					<h5>Start Point</h5>
					<div class="coordinate-inputs">
						<label>
							X: <input type="number" bind:value={editedStartX} step="0.001" />
						</label>
						<label>
							Y: <input type="number" bind:value={editedStartY} step="0.001" />
						</label>
					</div>
				</div>
				
				<div class="coordinate-group">
					<h5>End Point</h5>
					<div class="coordinate-inputs">
						<label>
							X: <input type="number" bind:value={editedEndX} step="0.001" />
						</label>
						<label>
							Y: <input type="number" bind:value={editedEndY} step="0.001" />
						</label>
					</div>
				</div>
			{/if}
			
			<div class="coordinate-group">
				<h5>Origin</h5>
				<div class="coordinate-inputs">
					<label>
						X: <input type="number" bind:value={editedOriginX} step="0.001" />
					</label>
					<label>
						Y: <input type="number" bind:value={editedOriginY} step="0.001" />
					</label>
				</div>
			</div>
			
			<div class="shape-actions">
				<button 
					class="btn btn-primary"
					onclick={handleModifyShape}
					disabled={isModifyingShape}
				>
					{isModifyingShape ? 'Modifying...' : 'Apply Changes'}
				</button>
				
				<button 
					class="btn btn-danger"
					onclick={onDeleteSelected}
					disabled={isModifyingShape}
				>
					Delete Shape
				</button>
			</div>
		</div>
	{:else if appState.hoveredShapeInfo}
		<div class="hover-info">
			<h4>Hovered: {appState.hoveredShapeInfo.name || 'Shape'} (Index: {appState.hoveredShapeInfo.shapeIndex})</h4>
			
			{#if appState.hoveredShapeInfo.startPoint && appState.hoveredShapeInfo.endPoint}
				<div class="coordinate-display">
					<p><strong>Start:</strong> ({appState.hoveredShapeInfo.startPoint.x.toFixed(3)}, {appState.hoveredShapeInfo.startPoint.y.toFixed(3)})</p>
					<p><strong>End:</strong> ({appState.hoveredShapeInfo.endPoint.x.toFixed(3)}, {appState.hoveredShapeInfo.endPoint.y.toFixed(3)})</p>
				</div>
			{/if}
			
			{#if appState.hoveredShapeInfo.origin || appState.hoveredShapeInfo.position}
				{@const origin = appState.hoveredShapeInfo.origin || appState.hoveredShapeInfo.position}
				<p><strong>Origin:</strong> ({origin.x.toFixed(3)}, {origin.y.toFixed(3)})</p>
			{/if}
		</div>
	{:else}
		<div class="no-selection">
			<p>Hover over or click a shape to see its properties</p>
		</div>
	{/if}
</div>

<style>
	.properties-panel {
		background: white;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1rem;
		height: 100%;
		overflow-y: auto;
	}

	.properties-panel h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		color: #333;
		border-bottom: 1px solid var(--border-color);
		padding-bottom: 0.5rem;
	}

	.shape-info h4,
	.hover-info h4 {
		margin: 0 0 1rem 0;
		font-size: 0.9rem;
		color: #555;
	}

	.coordinate-group {
		margin-bottom: 1rem;
	}

	.coordinate-group h5 {
		margin: 0 0 0.5rem 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
	}

	.coordinate-inputs {
		display: flex;
		gap: 0.5rem;
	}

	.coordinate-inputs label {
		flex: 1;
		font-size: 0.8rem;
		color: #666;
	}

	.coordinate-inputs input {
		width: 100%;
		padding: 0.25rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-size: 0.8rem;
		margin-top: 0.25rem;
	}

	.coordinate-display p {
		margin: 0.25rem 0;
		font-size: 0.8rem;
		font-family: monospace;
	}

	.shape-actions {
		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.shape-actions button {
		padding: 0.5rem;
		border: none;
		border-radius: 4px;
		font-size: 0.8rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-primary {
		background: var(--primary-color);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #005a99;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		background: #c82333;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.no-selection {
		text-align: center;
		color: #666;
		font-style: italic;
		padding: 2rem 1rem;
	}
</style>