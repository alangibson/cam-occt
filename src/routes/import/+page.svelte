<script lang="ts">
	import { appState } from '$lib/stores.svelte.js';

	let fileInput = $state<HTMLInputElement>();
	let selectedFile = $state<File | null>(null);
	let dragOver = $state(false);

	function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			selectedFile = target.files[0];
			loadFile(selectedFile);
		}
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
		
		if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
			selectedFile = event.dataTransfer.files[0];
			loadFile(selectedFile);
		}
	}

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		dragOver = false;
	}

	function loadFile(file: File) {
		const allowedTypes = ['.svg', '.dxf'];
		const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
		
		if (!allowedTypes.includes(fileExtension)) {
			alert('Please select a SVG or DXF file');
			return;
		}

		appState.project = {
			...appState.project,
			importedFile: file,
			name: file.name.replace(/\.[^/.]+$/, "")
		};

		// Move to next stage
		appState.currentStage = 'modify';
	}

	function openFileDialog() {
		fileInput?.click();
	}
</script>

<div class="import-page">
	<div class="card text-center">
		<h1 class="mb-2">Import Drawing</h1>
		<p class="mb-4">Select a SVG or DXF file to begin creating your CNC program</p>
		
		<div 
			class="drop-zone"
			class:drag-over={dragOver}
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			role="button"
			tabindex="0"
			onclick={openFileDialog}
			onkeydown={(e) => e.key === 'Enter' && openFileDialog()}
		>
			<div class="drop-content">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
					<polyline points="14,2 14,8 20,8"></polyline>
					<line x1="16" y1="13" x2="8" y2="13"></line>
					<line x1="16" y1="17" x2="8" y2="17"></line>
					<polyline points="10,9 9,9 8,9"></polyline>
				</svg>
				<h3>Drop files here or click to browse</h3>
				<p>Supported formats: SVG, DXF</p>
			</div>
		</div>

		<input
			bind:this={fileInput}
			type="file"
			accept=".svg,.dxf"
			onchange={handleFileSelect}
			style="display: none;"
		/>

		{#if selectedFile}
			<div class="file-info">
				<p><strong>Selected:</strong> {selectedFile.name}</p>
				<p><strong>Size:</strong> {(selectedFile.size / 1024).toFixed(1)} KB</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.import-page {
		max-width: 600px;
		margin: 0 auto;
	}

	.drop-zone {
		border: 2px dashed var(--border-color);
		border-radius: 8px;
		padding: 3rem 2rem;
		cursor: pointer;
		transition: all 0.2s;
		background: #fafafa;
	}

	.drop-zone:hover,
	.drop-zone.drag-over {
		border-color: var(--primary-color);
		background: #f0f8ff;
	}

	.drop-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		color: #666;
	}

	.drop-content svg {
		color: var(--primary-color);
	}

	.drop-content h3 {
		margin: 0;
		font-size: 1.2rem;
		color: var(--text-color);
	}

	.drop-content p {
		margin: 0;
		font-size: 0.9rem;
	}

	.file-info {
		margin-top: 1rem;
		padding: 1rem;
		background: #f8f9fa;
		border-radius: 6px;
		text-align: left;
	}

	.file-info p {
		margin: 0.25rem 0;
	}
</style>