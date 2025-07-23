<script lang="ts">
	import { appState } from '$lib/stores.svelte.js';
	import type { Material, CutPath } from '../../types/index.js';

	let selectedMaterial = $state<Material>({
		name: 'Mild Steel',
		thickness: 3.0,
		feedRate: 2000,
		cutHeight: 1.5
	});

	let materials: Material[] = [
		{ name: 'Mild Steel', thickness: 3.0, feedRate: 2000, cutHeight: 1.5 },
		{ name: 'Stainless Steel', thickness: 3.0, feedRate: 1500, cutHeight: 2.0 },
		{ name: 'Aluminum', thickness: 3.0, feedRate: 3000, cutHeight: 1.0 }
	];

	function createCutPaths() {
		// In a real implementation, this would analyze the geometry
		// and create cut paths using OpenCascade.js
		const cutPath: CutPath = {
			id: 'path-1',
			geometry: null, // Would contain OpenCascade geometry
			feedRate: selectedMaterial.feedRate,
			cutHeight: selectedMaterial.cutHeight
		};

		appState.project = {
			...appState.project,
			cutPaths: [cutPath],
			material: selectedMaterial
		};
	}
</script>

<div class="program-page">
	<h2>Program Cutting Operations</h2>
	
	<div class="content">
		<div class="settings-panel">
			<div class="card">
				<h3>Material Settings</h3>
				
				<div class="form-group">
					<label for="material">Material Type:</label>
					<select id="material" bind:value={selectedMaterial}>
						{#each materials as material}
							<option value={material}>{material.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="thickness">Thickness (mm):</label>
					<input id="thickness" type="number" bind:value={selectedMaterial.thickness} min="0.1" step="0.1" />
				</div>

				<div class="form-group">
					<label for="feedRate">Feed Rate (mm/min):</label>
					<input id="feedRate" type="number" bind:value={selectedMaterial.feedRate} min="100" step="100" />
				</div>

				<div class="form-group">
					<label for="cutHeight">Cut Height (mm):</label>
					<input id="cutHeight" type="number" bind:value={selectedMaterial.cutHeight} min="0.5" step="0.1" />
				</div>

				<button class="btn" onclick={createCutPaths}>
					Generate Cut Paths
				</button>
			</div>
		</div>

		<div class="preview-panel">
			<div class="card">
				<h3>Cut Path Preview</h3>
				
				{#if appState.project.cutPaths.length > 0}
					<div class="cut-paths-list">
						{#each appState.project.cutPaths as cutPath, index}
							<div class="cut-path-item">
								<h4>Path {index + 1}</h4>
								<p>Feed Rate: {cutPath.feedRate} mm/min</p>
								<p>Cut Height: {cutPath.cutHeight} mm</p>
							</div>
						{/each}
					</div>
				{:else}
					<p class="no-paths">No cut paths generated yet. Configure material settings and click "Generate Cut Paths".</p>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	.program-page {
		max-width: 1200px;
		margin: 0 auto;
	}

	.program-page h2 {
		margin-bottom: 2rem;
	}

	.content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: bold;
	}

	.form-group input,
	.form-group select {
		width: 100%;
		padding: 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-size: 1rem;
	}

	.cut-paths-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.cut-path-item {
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
		border: 1px solid var(--border-color);
	}

	.cut-path-item h4 {
		margin: 0 0 0.5rem 0;
		color: var(--primary-color);
	}

	.cut-path-item p {
		margin: 0.25rem 0;
		font-size: 0.9rem;
	}

	.no-paths {
		text-align: center;
		color: #666;
		font-style: italic;
		padding: 2rem;
	}
</style>