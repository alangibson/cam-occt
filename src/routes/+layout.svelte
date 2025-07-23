<script lang="ts">
	import { appState, stages } from '$lib/stores.svelte.js';
	import '../styles/global.css';

	function navigateToStage(stageId: string) {
		appState.currentStage = stageId as any;
	}
</script>

<div class="app">
	<header class="tools">
		<nav class="breadcrumb">
			{#each stages as stage, index}
				<button 
					class="stage-button" 
					class:active={appState.currentStage === stage.id}
					onclick={() => navigateToStage(stage.id)}
				>
					<span class="stage-number">{index + 1}</span>
					<span class="stage-name">{stage.name}</span>
				</button>
				{#if index < stages.length - 1}
					<span class="separator">→</span>
				{/if}
			{/each}
		</nav>
	</header>

	<main class="body">
		<slot />
	</main>

	<footer class="footer">
		{#if appState.currentStage === 'modify'}
			<div class="footer-info">
				<div class="zoom-display">
					Zoom: {(appState.viewerZoomLevel * 100).toFixed(0)}%
				</div>
				{#if appState.drawingDimensions}
					<div class="dimensions-display">
						Drawing: {appState.drawingDimensions.width.toFixed(2)} × {appState.drawingDimensions.height.toFixed(2)} {appState.drawingDimensions.units}
					</div>
				{/if}
			</div>
		{/if}
	</footer>
</div>

<style>
	.app {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 100vh;
	}

	.tools {
		background: #f5f5f5;
		border-bottom: 1px solid #ddd;
		padding: 1rem;
	}

	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.stage-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: white;
		border: 1px solid #ddd;
		border-radius: 6px;
		padding: 0.5rem 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.stage-button:hover {
		background: #f8f9fa;
		border-color: #007acc;
	}

	.stage-button.active {
		background: #007acc;
		color: white;
		border-color: #007acc;
	}

	.stage-number {
		background: rgba(0, 0, 0, 0.1);
		border-radius: 50%;
		width: 1.5rem;
		height: 1.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.8rem;
		font-weight: bold;
	}

	.stage-button.active .stage-number {
		background: rgba(255, 255, 255, 0.2);
	}

	.separator {
		color: #666;
		font-size: 1.2rem;
	}

	.body {
		overflow: hidden; /* Prevent scrollbars, let content manage its own overflow */
		min-height: 0; /* Allow flex shrinking */
		display: flex;
		flex-direction: column;
	}

	.footer {
		background: #f5f5f5;
		border-top: 1px solid #ddd;
		min-height: 2rem;
		display: flex;
		align-items: center;
		padding: 0 1rem;
	}
	
	.footer-info {
		display: flex;
		align-items: center;
		gap: 2rem;
		width: 100%;
	}

	.zoom-display, .dimensions-display {
		font-size: 0.9rem;
		color: #666;
		font-family: monospace;
	}
	
	.dimensions-display {
		margin-left: auto; /* Push dimensions to the right */
	}
</style>