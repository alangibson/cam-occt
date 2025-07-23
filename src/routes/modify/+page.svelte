<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { appState, type LayerInfo } from '$lib/stores.svelte.js';
	import { ThreeViewer } from '$lib/three-viewer.js';
	import { DxfToOpenCascadeConverter } from '$lib/dxf-to-opencascade.js';
	import { OpenCascadeToThreeJSConverter } from '$lib/opencascade-to-threejs.js';
	import OpenCascadeService from '$lib/opencascade-service.js';
	import { ShapeModifier } from '$lib/shape-modifier.js';
	import LayerMenu from '$lib/../components/LayerMenu.svelte';
	import ShapePropertiesPanel from '$lib/../components/ShapePropertiesPanel.svelte';
	import ViewerControls from '$lib/../components/ViewerControls.svelte';
	import type { UnitType } from '../types/index.js';
	import * as THREE from 'three';
	
	// State using runes
	let viewerContainer = $state<HTMLElement>();
	let viewer = $state<ThreeViewer | null>(null);
	let loading = $state(false);
	let errorMessage = $state('');
	let loadingStep = $state('');
	let unitsLocked = $state(false);
	
	// Editable shape properties
	let editedStartX = $state(0);
	let editedStartY = $state(0);
	let editedEndX = $state(0);
	let editedEndY = $state(0);
	let editedOriginX = $state(0);
	let editedOriginY = $state(0);
	
	// Shape modifier instance
	let shapeModifier = $state<ShapeModifier>();
	let isModifyingShape = $state(false);
	
	// Previous values for comparison
	let previousValues = $state({
		startX: 0, startY: 0, endX: 0, endY: 0, originX: 0, originY: 0
	});
	
	// Derived state for tracking changes
	let hasChanges = $derived(() => {
		return editedStartX !== previousValues.startX ||
			   editedStartY !== previousValues.startY ||
			   editedEndX !== previousValues.endX ||
			   editedEndY !== previousValues.endY ||
			   editedOriginX !== previousValues.originX ||
			   editedOriginY !== previousValues.originY;
	});
	
	// Update editable values when selection changes
	$effect(() => {
		if (appState.selectedShapeInfo) {
			if (appState.selectedShapeInfo.startPoint && appState.selectedShapeInfo.endPoint) {
				editedStartX = parseFloat(appState.selectedShapeInfo.startPoint.x.toFixed(3));
				editedStartY = parseFloat(appState.selectedShapeInfo.startPoint.y.toFixed(3));
				editedEndX = parseFloat(appState.selectedShapeInfo.endPoint.x.toFixed(3));
				editedEndY = parseFloat(appState.selectedShapeInfo.endPoint.y.toFixed(3));
			}
			
			const origin = appState.selectedShapeInfo.origin || appState.selectedShapeInfo.position;
			if (origin) {
				editedOriginX = parseFloat(origin.x.toFixed(3));
				editedOriginY = parseFloat(origin.y.toFixed(3));
			}
			
			// Update previous values
			previousValues = { 
				startX: editedStartX, 
				startY: editedStartY, 
				endX: editedEndX, 
				endY: editedEndY, 
				originX: editedOriginX, 
				originY: editedOriginY 
			};
		}
	});
	
	async function loadFile() {
		if (!appState.project.importedFile || !viewer) return;
		
		try {
			loading = true;
			errorMessage = '';
			unitsLocked = true;
			
			loadingStep = 'Initializing OpenCascade...';
			const oc = await OpenCascadeService.getInstance().initialize();
			
			loadingStep = 'Parsing DXF file...';
			const fileContent = await appState.project.importedFile.text();
			
			const converter = new DxfToOpenCascadeConverter();
			const parseResult = await converter.parseDxfToOpenCascade(fileContent);
			const openCascadeShapes = parseResult.shapes;
			
			loadingStep = 'Converting to 3D visualization...';
			const threeConverter = new OpenCascadeToThreeJSConverter();
			const threeJsGeometries = await threeConverter.convertShapesToThreeJS(openCascadeShapes);
			
			appState.project = {
				...appState.project,
				geometry: openCascadeShapes
			};
			
			loadingStep = 'Rendering geometry...';
			await viewer.clearScene();
			await viewer.addMultipleGeometries(threeJsGeometries);
			
			updateDrawingDimensions();
			updateLayerInformation(threeJsGeometries);
			
		} catch (error) {
			console.error('Error loading file:', error);
			errorMessage = `Failed to load file: ${error.message}`;
		} finally {
			loading = false;
			loadingStep = '';
		}
	}
	
	async function handleModifyShape(modifications: {
		startX?: number;
		startY?: number;
		endX?: number;
		endY?: number;
		originX?: number;
		originY?: number;
	}) {
		if (!appState.selectedShapeInfo || !shapeModifier || isModifyingShape) return;
		
		try {
			isModifyingShape = true;
			
			// Transform flat coordinate parameters into nested objects expected by ShapeModifier
			const shapeModifications: any = {};
			
			if (modifications.startX !== undefined || modifications.startY !== undefined) {
				shapeModifications.startPoint = {
					x: modifications.startX ?? 0,
					y: modifications.startY ?? 0,
					z: 0
				};
			}
			
			if (modifications.endX !== undefined || modifications.endY !== undefined) {
				shapeModifications.endPoint = {
					x: modifications.endX ?? 0,
					y: modifications.endY ?? 0,
					z: 0
				};
			}
			
			if (modifications.originX !== undefined || modifications.originY !== undefined) {
				shapeModifications.origin = {
					x: modifications.originX ?? 0,
					y: modifications.originY ?? 0,
					z: 0
				};
			}
			
			console.log('🔄 Handling shape modification:', shapeModifications);
			
			const updatedShapes = shapeModifier.modifyShape(
				appState.project.geometry || [],
				appState.selectedShapeInfo.shapeIndex,
				shapeModifications
			);
			
			appState.project = {
				...appState.project,
				geometry: updatedShapes
			};
			
			await refreshVisualization(updatedShapes);
			
			// Update previous values
			previousValues = {
				startX: modifications.startX ?? previousValues.startX,
				startY: modifications.startY ?? previousValues.startY,
				endX: modifications.endX ?? previousValues.endX,
				endY: modifications.endY ?? previousValues.endY,
				originX: modifications.originX ?? previousValues.originX,
				originY: modifications.originY ?? previousValues.originY
			};
			
		} catch (error) {
			console.error('Error modifying shape:', error);
			errorMessage = `Failed to modify shape: ${error.message}`;
		} finally {
			isModifyingShape = false;
		}
	}
	
	async function handleDeleteSelected() {
		if (!appState.selectedShapeInfo || !shapeModifier) return;
		
		try {
			const updatedShapes = shapeModifier.deleteShape(
				appState.project.geometry || [],
				appState.selectedShapeInfo.shapeIndex
			);
			
			appState.project = {
				...appState.project,
				geometry: updatedShapes
			};
			
			await refreshVisualization(updatedShapes);
			
		} catch (error) {
			console.error('Error deleting shape:', error);
			errorMessage = `Failed to delete shape: ${error.message}`;
		}
	}
	
	async function refreshVisualization(shapes: any[]) {
		if (!viewer) return;
		
		try {
			loadingStep = 'Refreshing visualization...';
			
			const oc = await OpenCascadeService.getInstance().initialize();
			const threeConverter = new OpenCascadeToThreeJSConverter();
			const threeJsGeometries = await threeConverter.convertShapesToThreeJS(shapes);
			
			await viewer.clearScene();
			await viewer.addMultipleGeometries(threeJsGeometries);
			
			updateDrawingDimensions();
			updateLayerInformation(threeJsGeometries);
			
			// Restore layer visibility settings after refresh
			appState.drawingLayers.forEach(layer => {
				if (!layer.visible) {
					viewer.toggleLayerVisibility(layer.name, false);
				}
			});
			
		} catch (error) {
			console.error('Error refreshing visualization:', error);
			errorMessage = `Failed to refresh visualization: ${error.message}`;
		} finally {
			loadingStep = '';
		}
	}
	
	function updateDrawingDimensions() {
		if (viewer) {
			const dimensions = viewer.getDrawingDimensions();
			appState.drawingDimensions = dimensions;
		} else {
			appState.drawingDimensions = null;
		}
	}
	
	function updateLayerInformation(threeJsGeometries: any[]) {
		const layerMap: Map<string, {entityCount: number, entityTypes: Set<string>}> = new Map();
		
		threeJsGeometries.forEach(geom => {
			const layerName = geom.layer || '0';
			const entityType = geom.type || 'UNKNOWN';
			
			if (!layerMap.has(layerName)) {
				layerMap.set(layerName, {
					entityCount: 0,
					entityTypes: new Set()
				});
			}
			
			const layerData = layerMap.get(layerName)!;
			layerData.entityCount++;
			layerData.entityTypes.add(entityType);
		});
		
		const currentVisibilityMap = new Map(appState.drawingLayers.map((layer: LayerInfo) => [layer.name, layer.visible]));
		
		const layers: LayerInfo[] = Array.from(layerMap.entries()).map(([name, data]) => ({
			name,
			entityCount: data.entityCount,
			visible: currentVisibilityMap.get(name) ?? true,
			entityTypes: Array.from(data.entityTypes).sort()
		})).sort((a, b) => a.name.localeCompare(b.name));
		
		appState.drawingLayers = layers;
	}
	
	function handleLayerToggle(event: { layerName: string, visible: boolean }) {
		if (viewer) {
			viewer.toggleLayerVisibility(event.layerName, event.visible);
		}
	}
	
	function handleUnitsChange(units: UnitType) {
		if (viewer) {
			// Note: updateUnits method not implemented in ThreeViewer yet
			// viewer.updateUnits(units);
			updateDrawingDimensions();
		}
	}
	
	function handleResetZoom() {
		if (viewer) {
			// Note: resetZoom method not implemented in ThreeViewer yet
			// viewer.resetZoom();
		}
	}
	
	function handleFitToView() {
		if (viewer) {
			// Note: fitToView method not implemented in ThreeViewer yet
			// viewer.fitToView();
		}
	}
	
	onMount(async () => {
		if (browser && viewerContainer) {
			// Initialize shape modifier
			shapeModifier = new ShapeModifier();
			await shapeModifier.initialize();
			
			viewer = new ThreeViewer(
				viewerContainer,
				(zoom: number) => {
					console.log('🔄 Zoom callback:', zoom);
					appState.viewerZoomLevel = zoom;
				},
				(shapeInfo: any) => {
					console.log('🖱️ Hover callback:', shapeInfo);
					appState.hoveredShapeInfo = shapeInfo;
				},
				(shapeInfo: any) => {
					console.log('👆 Select callback:', shapeInfo);
					appState.selectedShapeInfo = shapeInfo;
				}
			);
			
			// Load file if available
			if (appState.project.importedFile) {
				await loadFile();
			}
		}
	});
	
	onDestroy(() => {
		if (viewer) {
			viewer.dispose();
		}
	});
</script>

<div class="modify-page">
	<div class="layout">
		<div class="sidebar-left">
			<ViewerControls 
				{loading}
				{errorMessage}
				{loadingStep}
				{unitsLocked}
				onUnitsChange={handleUnitsChange}
				onResetZoom={handleResetZoom}
				onFitToView={handleFitToView}
			/>
			
			<LayerMenu onLayerToggle={handleLayerToggle} />
		</div>
		
		<div class="viewer-container">
			<div bind:this={viewerContainer} class="three-viewer"></div>
		</div>
		
		<div class="sidebar-right">
			<ShapePropertiesPanel 
				bind:editedStartX
				bind:editedStartY
				bind:editedEndX
				bind:editedEndY
				bind:editedOriginX
				bind:editedOriginY
				onModifyShape={handleModifyShape}
				onDeleteSelected={handleDeleteSelected}
				{isModifyingShape}
			/>
		</div>
	</div>
</div>

<style>
	.modify-page {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.layout {
		display: grid;
		grid-template-columns: 250px 1fr 300px;
		grid-template-areas: "left viewer right";
		height: 100%;
		gap: 1rem;
		padding: 1rem;
	}

	.sidebar-left {
		grid-area: left;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: hidden;
	}

	.viewer-container {
		grid-area: viewer;
		position: relative;
		overflow: hidden;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		background: #f8f9fa;
	}

	.three-viewer {
		width: 100%;
		height: 100%;
		border-radius: inherit;
	}

	.sidebar-right {
		grid-area: right;
		overflow: hidden;
	}

	/* Responsive layout */
	@media (max-width: 1200px) {
		.layout {
			grid-template-columns: 200px 1fr 250px;
		}
	}

	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr auto;
			grid-template-areas:
				"left"
				"viewer"
				"right";
		}
		
		.sidebar-left {
			flex-direction: row;
			overflow-x: auto;
		}
	}
</style>