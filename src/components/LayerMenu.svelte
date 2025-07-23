<script lang="ts">
	import { appState, type LayerInfo } from '$lib/stores.svelte.js';

	interface Props {
		onLayerToggle?: (event: { layerName: string; visible: boolean }) => void;
	}

	let { onLayerToggle }: Props = $props();

	function toggleLayer(layer: LayerInfo) {
		// Update the layer visibility in the store
		appState.drawingLayers = appState.drawingLayers.map(l => 
			l.name === layer.name 
				? { ...l, visible: !l.visible }
				: l
		);
		
		// Call callback for parent to handle
		onLayerToggle?.({ 
			layerName: layer.name, 
			visible: !layer.visible 
		});
	}

	function getLayerIcon(entityTypes: string[]): string {
		// Return an appropriate icon based on the entity types in the layer
		if (entityTypes.includes('SPLINE')) return '🌊';
		if (entityTypes.includes('CIRCLE')) return '○';
		if (entityTypes.includes('ARC')) return '◗';
		if (entityTypes.includes('LINE')) return '─';
		return '📄';
	}
</script>

<div class="layer-menu">
	<div class="layer-menu-header">
		<h3>Layers</h3>
		{#if appState.drawingLayers.length > 0}
			<small>{appState.drawingLayers.length} layer{appState.drawingLayers.length !== 1 ? 's' : ''}</small>
		{/if}
	</div>

	{#if appState.drawingLayers.length === 0}
		<div class="empty-state">
			<p>No layers detected</p>
			<small>Import a DXF file to see layers</small>
		</div>
	{:else}
		<div class="layer-list">
			{#each appState.drawingLayers as layer (layer.name)}
				<div class="layer-item" class:layer-hidden={!layer.visible}>
					<button 
						class="layer-toggle" 
						onclick={() => toggleLayer(layer)}
						title={layer.visible ? 'Hide layer' : 'Show layer'}
					>
						<span class="visibility-icon">
							{layer.visible ? '👁️' : '🙈'}
						</span>
					</button>
					
					<div class="layer-info">
						<div class="layer-name">
							<span class="layer-icon" title="Primary entity types: {layer.entityTypes.join(', ')}">
								{getLayerIcon(layer.entityTypes)}
							</span>
							<span class="name">{layer.name}</span>
						</div>
						
						<div class="layer-details">
							<span class="entity-count">
								{layer.entityCount} entit{layer.entityCount !== 1 ? 'ies' : 'y'}
							</span>
							
							{#if layer.entityTypes.length > 0}
								<div class="entity-types">
									{#each layer.entityTypes as entityType}
										<span class="entity-type-badge">{entityType}</span>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.layer-menu {
		background: white;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.layer-menu-header {
		padding: 1rem;
		border-bottom: 1px solid var(--border-color);
		background: #f8f9fa;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.layer-menu-header h3 {
		margin: 0;
		font-size: 1rem;
		color: #333;
	}

	.layer-menu-header small {
		color: #666;
		font-size: 0.8rem;
	}

	.empty-state {
		padding: 2rem;
		text-align: center;
		color: #666;
	}

	.empty-state p {
		margin: 0 0 0.5rem 0;
		font-weight: 500;
	}

	.empty-state small {
		font-size: 0.8rem;
		color: #999;
	}

	.layer-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.layer-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 0.5rem;
		background: #f9f9f9;
		border: 1px solid #e0e0e0;
		transition: all 0.2s ease;
	}

	.layer-item:hover {
		background: #f0f0f0;
		border-color: #ccc;
	}

	.layer-item.layer-hidden {
		opacity: 0.6;
		background: #f5f5f5;
	}

	.layer-toggle {
		background: none;
		border: none;
		padding: 0.25rem;
		cursor: pointer;
		font-size: 1rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2rem;
		height: 2rem;
		transition: background-color 0.2s ease;
	}

	.layer-toggle:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.layer-info {
		flex: 1;
		min-width: 0;
	}

	.layer-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.layer-icon {
		font-size: 1rem;
		cursor: help;
	}

	.name {
		font-weight: 600;
		color: #333;
		word-break: break-word;
	}

	.layer-details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.entity-count {
		font-size: 0.8rem;
		color: #666;
	}

	.entity-types {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.entity-type-badge {
		font-size: 0.7rem;
		background: #e3f2fd;
		color: #1976d2;
		padding: 0.125rem 0.375rem;
		border-radius: 3px;
		border: 1px solid #bbdefb;
		font-weight: 500;
		text-transform: uppercase;
	}

	/* Custom scrollbar for layer list */
	.layer-list::-webkit-scrollbar {
		width: 6px;
	}

	.layer-list::-webkit-scrollbar-track {
		background: #f1f1f1;
		border-radius: 3px;
	}

	.layer-list::-webkit-scrollbar-thumb {
		background: #ccc;
		border-radius: 3px;
	}

	.layer-list::-webkit-scrollbar-thumb:hover {
		background: #aaa;
	}
</style>