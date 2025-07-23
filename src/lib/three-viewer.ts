import * as THREE from 'three';
import type { UnitType } from '../types/index.js';
import { SelectionManager } from './selection-manager.js';
import type { SelectableObject, SelectionCallbacks } from './selection-manager.js';

export class ThreeViewer {
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private container: HTMLElement;
	private baseLineWidth: number = 1;
	private currentZoomPercent: number = 100; // Zoom as percentage (100% = 1:1 scale)
	private lineObjects: THREE.Line[] = [];
	private isPanning: boolean = false;
	private lastMousePosition: { x: number; y: number } = { x: 0, y: 0 };
	private currentUnits: UnitType = 'mm';
	private fileUnits: UnitType | null = null; // Units from DXF file
	private geometryGroup: THREE.Group | null = null; // Reference to main geometry
	private originalBounds: { width: number; height: number } | null = null; // Original unscaled bounds
	private onZoomChange?: (zoomLevel: number) => void;
	private onShapeHover?: (shapeInfo: any) => void;
	private onShapeSelect?: (shapeInfo: any) => void;
	private raycaster: THREE.Raycaster;
	private mouse: THREE.Vector2;
	private originalMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();
	private selectedMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();
	private hoveredMaterials: Map<THREE.Object3D, THREE.Material | THREE.Material[]> = new Map();
	private selectionManager: SelectionManager;
	private startPointMarker: THREE.Mesh | null = null;
	private endPointMarker: THREE.Mesh | null = null;
	private originPointMarker: THREE.Mesh | null = null;

	constructor(container: HTMLElement, onZoomChange?: (zoomLevel: number) => void, onShapeHover?: (shapeInfo: any) => void, onShapeSelect?: (shapeInfo: any) => void) {
		this.container = container;
		this.onZoomChange = onZoomChange;
		this.onShapeHover = onShapeHover;
		this.onShapeSelect = onShapeSelect;
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 10000); // Increased far plane for large geometries
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.raycaster = new THREE.Raycaster();
		this.raycaster.params.Line.threshold = 2.0; // Precise threshold for accurate line detection
		this.mouse = new THREE.Vector2();
		
		// Initialize selection manager
		this.selectionManager = new SelectionManager({
			onShapeSelect: (event) => this.handleShapeSelect(event),
			onShapeHover: (shapeInfo) => this.handleShapeHover(shapeInfo),
			onCalculateShapeInfo: (object, intersection) => this.calculateShapeInfo(object, intersection),
			onHighlightObject: (object, highlight, type) => this.handleHighlightObject(object, highlight, type),
			onAddPointMarkers: (shapeInfo) => this.handleAddPointMarkers(shapeInfo),
			onClearPointMarkers: () => this.clearPointMarkers()
		});
		
		this.init();
	}

	private init() {
		// Set up renderer
		this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
		this.renderer.setClearColor(0xf0f0f0);
		this.container.appendChild(this.renderer.domElement);

		// Set up camera
		this.camera.position.set(0, 0, 5);
		this.camera.lookAt(0, 0, 0);

		// Add basic lighting
		const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		directionalLight.position.set(10, 10, 5);
		this.scene.add(directionalLight);

		// Handle resize
		window.addEventListener('resize', () => this.handleResize());
		
		// Handle dynamic resizing with ResizeObserver for better console detection
		if (window.ResizeObserver) {
			const resizeObserver = new ResizeObserver(() => {
				this.handleResize();
			});
			resizeObserver.observe(this.container);
		}
		
		// Add zoom and pan controls
		this.setupZoomControls();
		this.setupPanControls();
		
		// Add mouse hover detection
		this.setupHoverControls();
		
		// Add click selection
		this.setupClickControls();
		
		// Start render loop
		this.animate();
	}

	// SelectionManager callback handlers
	private handleShapeSelect(event: any) {
		if (event) {
			this.onShapeSelect?.(event.shapeInfo);
		} else {
			this.onShapeSelect?.(null);
		}
	}

	private handleShapeHover(shapeInfo: any) {
		this.onShapeHover?.(shapeInfo);
	}

	private handleHighlightObject(object: SelectableObject, highlight: boolean, type: 'hover' | 'selection') {
		if (type === 'selection') {
			this.highlightSelectedObject(object, highlight);
		} else {
			this.highlightHoveredObject(object, highlight);
		}
	}

	private handleAddPointMarkers(shapeInfo: any) {
		if (shapeInfo.startPoint && shapeInfo.endPoint) {
			this.addPointMarkers(shapeInfo.startPoint, shapeInfo.endPoint, shapeInfo.origin);
		}
	}

	private handleResize() {
		const width = this.container.clientWidth;
		const height = this.container.clientHeight;
		
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	}

	private setupZoomControls() {
		this.container.addEventListener('wheel', (event) => {
			event.preventDefault();
			
			// Calculate zoom in 5% increments
			const zoomIncrement = 5;
			const direction = event.deltaY > 0 ? -1 : 1;
			const newZoomPercent = Math.max(5, Math.min(500, this.currentZoomPercent + (direction * zoomIncrement)));
			
			this.setZoomPercent(newZoomPercent);
		});
	}

	public setZoomPercent(zoomPercent: number) {
		// Validate and clamp zoom to acceptable range
		this.currentZoomPercent = Math.max(5, Math.min(500, zoomPercent));
		
		// Set camera distance to achieve the desired zoom percentage
		if (this.geometryGroup && this.originalBounds) {
			this.setCameraDistanceForZoom(this.currentZoomPercent);
		}
		
		// Update line widths
		this.updateLineWidths();
		
		// Notify listeners
		if (this.onZoomChange) {
			this.onZoomChange(this.currentZoomPercent / 100);
		}
	}
	
	private setCameraDistanceForZoom(zoomPercent: number) {
		if (!this.geometryGroup || !this.originalBounds) return;
		
		// CRITICAL: At 100% zoom, 1 Three.js unit must appear as the correct number of pixels
		// for the current unit type. This ensures true 1:1 scale.
		
		const targetPixelsPerUnit = this.getPixelsPerUnit(this.currentUnits) * (zoomPercent / 100);
		const fov = this.camera.fov * Math.PI / 180;
		const viewportHeight = this.container.clientHeight;
		
		// For a perspective camera, the relationship between distance and apparent size is:
		// apparentSize = (objectSize / distance) * (viewportHeight / (2 * tan(fov/2)))
		// 
		// We want: apparentSize = objectSize * targetPixelsPerUnit
		// So: objectSize * targetPixelsPerUnit = (objectSize / distance) * (viewportHeight / (2 * tan(fov/2)))
		// Solving for distance: distance = viewportHeight / (2 * tan(fov/2) * targetPixelsPerUnit)
		
		const distance = viewportHeight / (2 * Math.tan(fov / 2) * targetPixelsPerUnit);
		
		// Set camera position maintaining the geometry center as target
		const box = new THREE.Box3().setFromObject(this.geometryGroup);
		const center = box.getCenter(new THREE.Vector3());
		
		// Position camera at calculated distance from center, looking down from positive Z
		this.camera.position.set(center.x, center.y, center.z + distance);
		this.camera.lookAt(center);
		
		console.log(`Zoom ${zoomPercent}%: ${targetPixelsPerUnit.toFixed(2)} px/unit, distance: ${distance.toFixed(1)}`);
	}
	

	private updateLineWidths() {
		// Calculate scaled line width based on zoom level
		const scaledLineWidth = Math.max(0.5, Math.min(5, this.baseLineWidth * (this.currentZoomPercent / 100)));
		
		for (const lineObject of this.lineObjects) {
			if (lineObject.material instanceof THREE.LineBasicMaterial) {
				// Note: linewidth in WebGL is limited and may not work consistently
				// For better cross-browser support, consider using THREE.Line2 or custom shader
				lineObject.material.linewidth = scaledLineWidth;
			}
		}
	}

	private animate() {
		requestAnimationFrame(() => this.animate());
		this.renderer.render(this.scene, this.camera);
	}

	public addGeometry(geometry: THREE.BufferGeometry, isLineGeometry: boolean = false, entityType?: string, layer?: string, shapeIndex?: number) {
		let object: THREE.Object3D;
		
		if (isLineGeometry) {
			const material = new THREE.LineBasicMaterial({ 
				color: 0x007acc,
				linewidth: this.baseLineWidth
			});
			object = new THREE.Line(geometry, material);
			
			// Track line objects for width scaling
			this.lineObjects.push(object as THREE.Line);
		} else {
			const material = new THREE.MeshPhongMaterial({ 
				color: 0x007acc,
				wireframe: false,
				side: THREE.DoubleSide
			});
			object = new THREE.Mesh(geometry, material);
		}
		
		// Store original DXF entity type, layer, and shape index as user data
		object.userData = {
			originalEntityType: entityType || (isLineGeometry ? 'LINE' : 'MESH'),
			layer: layer || '0',
			shapeIndex: shapeIndex
		};
		
		this.scene.add(object);
		return object;
	}

	public addMultipleGeometries(geometries: {geometry: THREE.BufferGeometry, isLine: boolean, type?: string, layer?: string, insertTransform?: any, shapeIndex?: number, center?: any, radius?: number, startAngle?: number, endAngle?: number}[], fileUnits?: UnitType, preserveZoom: boolean = false) {
		// Store file units - this determines if units can be changed
		if (fileUnits) {
			this.fileUnits = fileUnits;
			this.currentUnits = fileUnits; // Set display units to match file units
		}
		
		// Create geometry group
		const group = new THREE.Group();
		
		// Group INSERT entities by their insertHandle to create transform groups
		const insertGroups = new Map<string, THREE.Group>();
		const regularObjects: THREE.Object3D[] = [];
		
		for (const {geometry, isLine, type, layer, insertTransform, shapeIndex, center, radius, startAngle, endAngle} of geometries) {
			const object = this.addGeometry(geometry, isLine, type, layer, shapeIndex);
			this.scene.remove(object); // Remove from scene, we'll add to group instead
			
			// Add additional metadata to userData
			if (object.userData) {
				object.userData.center = center;
				object.userData.radius = radius;
				object.userData.startAngle = startAngle;
				object.userData.endAngle = endAngle;
			}
			
			if (insertTransform) {
				// This is an INSERT entity - group by insertHandle
				const insertHandle = insertTransform.insertHandle;
				
				if (!insertGroups.has(insertHandle)) {
					// Create new INSERT group with transformations
					const insertGroup = new THREE.Group();
					insertGroup.name = `INSERT_${insertTransform.blockName}_${insertHandle}`;
					
					// First, create an inner group to apply the block base point offset
					const blockOffsetGroup = new THREE.Group();
					if (insertTransform.blockBasePoint) {
						// Apply negative of block base point to move block entities to origin
						blockOffsetGroup.position.set(
							-insertTransform.blockBasePoint.x,
							-insertTransform.blockBasePoint.y,
							-insertTransform.blockBasePoint.z
						);
					}
					insertGroup.add(blockOffsetGroup);
					
					// Apply INSERT transformations to the outer group
					insertGroup.position.set(
						insertTransform.translation.x,
						insertTransform.translation.y,
						insertTransform.translation.z
					);
					insertGroup.scale.set(
						insertTransform.scale.x,
						insertTransform.scale.y,
						insertTransform.scale.z
					);
					insertGroup.rotation.z = insertTransform.rotation * Math.PI / 180; // Convert degrees to radians
					
					// Store the block offset group for adding entities to it
					insertGroups.set(insertHandle, blockOffsetGroup);
					group.add(insertGroup);
				}
				
				// Add object to the INSERT group
				insertGroups.get(insertHandle)!.add(object);
			} else {
				// Regular entity - add directly to main group
				regularObjects.push(object);
				group.add(object);
			}
		}
		
		this.scene.add(group);
		this.geometryGroup = group;
		
		console.log(`Created ${insertGroups.size} INSERT groups and ${regularObjects.length} regular objects`);
		
		// Store original bounds
		const box = new THREE.Box3().setFromObject(group);
		const size = box.getSize(new THREE.Vector3());
		this.originalBounds = {
			width: Math.abs(size.x),
			height: Math.abs(size.y)
		};
		
		// Position camera and set zoom
		this.positionCameraForGeometry();
		
		// Set zoom level - only reset to 100% for new files
		if (!preserveZoom) {
			this.setZoomPercent(100);
		} else {
			// Preserve current zoom and update camera distance
			this.setCameraDistanceForZoom(this.currentZoomPercent);
		}
		
		return group;
	}
	

	public setUnits(units: UnitType) {
		// Always allow unit changes - user can override DXF file units
		this.currentUnits = units;
		
		// Update camera position to maintain current zoom percentage with new units
		if (this.geometryGroup && this.originalBounds) {
			this.setCameraDistanceForZoom(this.currentZoomPercent);
		}
		
		return true;
	}
	
	public canChangeUnits(): boolean {
		return true; // Always allow unit changes
	}
	
	public getFileUnits(): UnitType | null {
		return this.fileUnits;
	}
	
	public getDrawingDimensions(): { width: number; height: number; units: string } | null {
		if (!this.originalBounds) return null;
		
		// Return raw DXF coordinate values with current display unit label
		// This shows the DXF coordinate system reinterpreted as the selected units
		const width = this.originalBounds.width;
		const height = this.originalBounds.height;
		
		return {
			width,
			height,
			units: this.currentUnits
		};
	}


	private getPixelsPerUnit(units: UnitType): number {
		const SCREEN_DPI = 96; // Standard screen DPI
		const MM_PER_INCH = 25.4;
		
		switch (units) {
			case 'mm':
				return SCREEN_DPI / MM_PER_INCH; // ~3.78 pixels per mm
			case 'inches':
				return SCREEN_DPI; // 96 pixels per inch
			default:
				throw new Error(`Unsupported unit type: ${units}`);
		}
	}
	
	private setupPanControls() {
		this.container.addEventListener('mousedown', (event) => {
			if (event.button === 2) { // Right mouse button
				event.preventDefault(); // Prevent context menu
				this.isPanning = true;
				this.lastMousePosition = { x: event.clientX, y: event.clientY };
				this.container.style.cursor = 'grabbing';
			}
		});

		this.container.addEventListener('mousemove', (event) => {
			if (this.isPanning) {
				const deltaX = event.clientX - this.lastMousePosition.x;
				const deltaY = event.clientY - this.lastMousePosition.y;

				// Calculate pan speed based on camera distance and zoom level
				const distance = this.camera.position.length();
				const panSpeed = distance * 0.001;

				// Apply pan movement to camera position
				const right = new THREE.Vector3();
				const up = new THREE.Vector3();
				
				this.camera.getWorldDirection(new THREE.Vector3());
				right.setFromMatrixColumn(this.camera.matrix, 0);
				up.setFromMatrixColumn(this.camera.matrix, 1);

				const panVector = new THREE.Vector3();
				panVector.addScaledVector(right, -deltaX * panSpeed);
				panVector.addScaledVector(up, deltaY * panSpeed);

				this.camera.position.add(panVector);

				this.lastMousePosition = { x: event.clientX, y: event.clientY };
			}
		});

		this.container.addEventListener('mouseup', (event) => {
			if (event.button === 2) { // Right mouse button
				this.isPanning = false;
				this.container.style.cursor = 'default';
			}
		});

		this.container.addEventListener('mouseleave', () => {
			this.isPanning = false;
			this.container.style.cursor = 'default';
		});

		// Disable context menu on right click
		this.container.addEventListener('contextmenu', (event) => {
			event.preventDefault();
		});

		// Set initial cursor
		this.container.style.cursor = 'default';
	}
	
	private positionCameraForGeometry() {
		if (!this.geometryGroup) return;
		
		// Calculate bounds of scaled geometry
		const box = new THREE.Box3().setFromObject(this.geometryGroup);
		const center = box.getCenter(new THREE.Vector3());
		const size = box.getSize(new THREE.Vector3());
		
		if (size.length() > 0) {
			// Position camera at reasonable distance to see the scaled geometry
			const maxDimension = Math.max(size.x, size.y, size.z);
			const distance = maxDimension * 1.5; // Conservative distance for better view
			
			console.log(`Positioning camera: center(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}), distance=${distance.toFixed(1)}`);
			
			this.camera.position.set(center.x, center.y, center.z + distance);
			this.camera.lookAt(center);
		}
	}

	private setupHoverControls() {
		this.container.addEventListener('mousemove', (event) => {
			// Skip hover during panning
			if (this.isPanning) return;

			// Calculate mouse position in normalized device coordinates (-1 to +1)
			const rect = this.container.getBoundingClientRect();
			this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

			this.updateHover();
		});

		this.container.addEventListener('mouseleave', () => {
			// Clear hover when mouse leaves the container
			this.selectionManager.handleHoverEnd();
		});
	}

	private setupClickControls() {
		this.container.addEventListener('click', (event) => {
			// Ignore right clicks (used for panning by OrbitControls)
			if (event.button !== 0) return;
			
			// Don't trigger selection during panning
			if (this.isPanning) return;

			// Calculate mouse position in normalized device coordinates (-1 to +1)
			const rect = this.container.getBoundingClientRect();
			this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
			this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

			// Update the picking ray
			this.raycaster.setFromCamera(this.mouse, this.camera);

			// Find intersections - prioritize objects from geometry group
			const intersectableObjects: THREE.Object3D[] = [];
			
			// First, try objects from geometry group (if it exists)
			if (this.geometryGroup) {
				this.geometryGroup.traverse((child) => {
					if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
						// Ensure object is in a selectable state
						if (child.visible && child.userData && typeof child.userData.shapeIndex === 'number') {
							intersectableObjects.push(child);
						}
					}
				});
			}
			
			// If no geometry group or no objects found, try entire scene
			if (intersectableObjects.length === 0) {
				this.scene.traverse((child) => {
					if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
						if (child.visible && child.userData && typeof child.userData.shapeIndex === 'number') {
							intersectableObjects.push(child);
						}
					}
				});
			}

			const intersects = this.raycaster.intersectObjects(intersectableObjects, true); // recursive = true

			if (intersects.length > 0) {
				const clickedObject = intersects[0].object as SelectableObject;
				
				// Use SelectionManager for click handling
				this.selectionManager.handleClick(clickedObject, intersects[0]);
			} else {
				// Try with more aggressive raycasting for lines
				const originalThreshold = this.raycaster.params.Line.threshold;
				this.raycaster.params.Line.threshold = 5.0; // Very generous threshold
				
				const fallbackIntersects = this.raycaster.intersectObjects(intersectableObjects, true);
				this.raycaster.params.Line.threshold = originalThreshold;
				
				if (fallbackIntersects.length > 0) {
					// Found with fallback
					const clickedObject = fallbackIntersects[0].object as SelectableObject;
					this.selectionManager.handleClick(clickedObject, fallbackIntersects[0]);
				} else {
					// Clicked empty space - unpin selection
					this.selectionManager.handleClickEmpty();
				}
			}
		});
	}

	private updateHover() {
		// Update the picking ray with the camera and mouse position
		this.raycaster.setFromCamera(this.mouse, this.camera);

		// Find intersections - prioritize objects from geometry group
		const intersectableObjects: THREE.Object3D[] = [];
		
		// First, try objects from geometry group (if it exists)
		if (this.geometryGroup) {
			this.geometryGroup.traverse((child) => {
				if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
					// Ensure object is in a selectable state
					if (child.visible && child.userData && typeof child.userData.shapeIndex === 'number') {
						intersectableObjects.push(child);
					}
				}
			});
		}
		
		// If no geometry group or no objects found, try entire scene
		if (intersectableObjects.length === 0) {
			this.scene.traverse((child) => {
				if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
					if (child.visible && child.userData && typeof child.userData.shapeIndex === 'number') {
						intersectableObjects.push(child);
					}
				}
			});
		}
		

		const intersects = this.raycaster.intersectObjects(intersectableObjects, true);

		if (intersects.length > 0) {
			const intersectedObject = intersects[0].object as SelectableObject;
			this.selectionManager.handleHover(intersectedObject, intersects[0]);
		} else {
			// For hover, use a more restrictive threshold than click (hover should be more precise)
			const originalThreshold = this.raycaster.params.Line.threshold;
			this.raycaster.params.Line.threshold = 2.0; // Precise threshold for fallback
			
			const fallbackIntersects = this.raycaster.intersectObjects(intersectableObjects, true);
			this.raycaster.params.Line.threshold = originalThreshold;
			
			if (fallbackIntersects.length > 0) {
				const intersectedObject = fallbackIntersects[0].object as SelectableObject;
				this.selectionManager.handleHover(intersectedObject, fallbackIntersects[0]);
			} else {
				// Mouse left all objects
				this.selectionManager.handleHoverEnd();
			}
		}
	}


	private clearPointMarkers() {
		if (this.startPointMarker) {
			// Remove from geometry group first, then scene as fallback
			if (this.geometryGroup) {
				this.geometryGroup.remove(this.startPointMarker);
			}
			this.scene.remove(this.startPointMarker);
			this.startPointMarker = null;
		}
		if (this.endPointMarker) {
			// Remove from geometry group first, then scene as fallback
			if (this.geometryGroup) {
				this.geometryGroup.remove(this.endPointMarker);
			}
			this.scene.remove(this.endPointMarker);
			this.endPointMarker = null;
		}
		if (this.originPointMarker) {
			// Remove from geometry group first, then scene as fallback
			if (this.geometryGroup) {
				this.geometryGroup.remove(this.originPointMarker);
			}
			this.scene.remove(this.originPointMarker);
			this.originPointMarker = null;
		}
	}

	private highlightObject(object: THREE.Object3D, highlight: boolean) {
		if (highlight) {
			// Store original material
			if (!this.originalMaterials.has(object)) {
				const material = (object as THREE.Mesh | THREE.Line).material;
				this.originalMaterials.set(object, material);
			}
			
			// Apply orange highlight material
			const highlightMaterial = new THREE.LineBasicMaterial({ 
				color: 0xff8800, // Orange
				linewidth: 3
			});
			
			(object as THREE.Mesh | THREE.Line).material = highlightMaterial;
		} else {
			// Restore original material
			const originalMaterial = this.originalMaterials.get(object);
			if (originalMaterial) {
				(object as THREE.Mesh | THREE.Line).material = originalMaterial;
				this.originalMaterials.delete(object);
			}
		}
	}

	private highlightSelectedObject(object: THREE.Object3D, highlight: boolean) {
		if (highlight) {
			// Store original material for selected object
			if (!this.selectedMaterials.has(object)) {
				const material = (object as THREE.Mesh | THREE.Line).material;
				this.selectedMaterials.set(object, material);
			}
			
			// Apply orange selection material (same as hover for consistency)
			const selectionMaterial = new THREE.LineBasicMaterial({ 
				color: 0xff8800, // Orange (same as hover)
				linewidth: 3
			});
			
			(object as THREE.Mesh | THREE.Line).material = selectionMaterial;
		} else {
			// Restore original material
			const originalMaterial = this.selectedMaterials.get(object);
			if (originalMaterial) {
				(object as THREE.Mesh | THREE.Line).material = originalMaterial;
				this.selectedMaterials.delete(object);
			}
		}
	}

	private highlightHoveredObject(object: THREE.Object3D, highlight: boolean) {
		if (highlight) {
			// Store original material for hovered object (if not already stored by selection)
			if (!this.hoveredMaterials.has(object) && !this.selectedMaterials.has(object)) {
				const material = (object as THREE.Mesh | THREE.Line).material;
				this.hoveredMaterials.set(object, material);
			}
			
			// Check if this shape is selected by comparing shape indices (not object references)
			const hoveredShapeIndex = object.userData?.shapeIndex;
			const selectedShapeIndex = this.selectionManager.getSelectionState().selectedObject?.userData?.shapeIndex;
			const isSelectedShape = hoveredShapeIndex !== undefined && hoveredShapeIndex === selectedShapeIndex;
			
			// Apply hover material - purple for combined hover+selection, blue for hover-only
			const hoverMaterial = new THREE.LineBasicMaterial({ 
				color: isSelectedShape ? 0xff44ff : 0x4488ff, // Purple if selected+hovered, blue if just hovered
				linewidth: isSelectedShape ? 4 : 2 // Thicker line if selected+hovered
			});
			
			(object as THREE.Mesh | THREE.Line).material = hoverMaterial;
		} else {
			// When hover ends, check if this shape is still selected by shape index
			const hoveredShapeIndex = object.userData?.shapeIndex;
			const selectedShapeIndex = this.selectionManager.getSelectionState().selectedObject?.userData?.shapeIndex;
			const isSelectedShape = hoveredShapeIndex !== undefined && hoveredShapeIndex === selectedShapeIndex;
			
			if (isSelectedShape) {
				// Shape is still selected, restore selection highlighting
				const selectionMaterial = new THREE.LineBasicMaterial({ 
					color: 0xff8800, // Orange selection color
					linewidth: 3
				});
				(object as THREE.Mesh | THREE.Line).material = selectionMaterial;
			} else {
				// Shape is not selected, restore original material
				const originalMaterial = this.hoveredMaterials.get(object);
				if (originalMaterial) {
					(object as THREE.Mesh | THREE.Line).material = originalMaterial;
				}
			}
			// Always clean up hover materials storage
			this.hoveredMaterials.delete(object);
		}
	}

	private addPointMarkers(startPoint: any, endPoint: any, origin?: any) {
		// Clear existing markers
		this.clearPointMarkers();
		
		// Create small sphere geometry for markers
		// Size is relative to DXF coordinate system, so it scales with geometry
		const markerGeometry = new THREE.SphereGeometry(0.5, 8, 6);
		
		// Create start point marker (green)
		const startMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green
		this.startPointMarker = new THREE.Mesh(markerGeometry, startMaterial);
		
		// Create end point marker (red)
		const endMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
		this.endPointMarker = new THREE.Mesh(markerGeometry, endMaterial);
		
		// Create origin point marker (blue)
		if (origin) {
			const originMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue
			this.originPointMarker = new THREE.Mesh(markerGeometry, originMaterial);
		}
		
		// Add markers to geometry group 
		if (this.geometryGroup) {
			// Since we're no longer scaling the geometry group, we can use world coordinates directly
			this.startPointMarker.position.set(startPoint.x, startPoint.y, startPoint.z);
			this.endPointMarker.position.set(endPoint.x, endPoint.y, endPoint.z);
			
			this.geometryGroup.add(this.startPointMarker);
			this.geometryGroup.add(this.endPointMarker);
			
			if (this.originPointMarker && origin) {
				this.originPointMarker.position.set(origin.x, origin.y, origin.z);
				this.geometryGroup.add(this.originPointMarker);
			}
		} else {
			// Fallback: add to scene if no geometry group
			this.startPointMarker.position.set(startPoint.x, startPoint.y, startPoint.z);
			this.endPointMarker.position.set(endPoint.x, endPoint.y, endPoint.z);
			this.scene.add(this.startPointMarker);
			this.scene.add(this.endPointMarker);
			
			if (this.originPointMarker && origin) {
				this.originPointMarker.position.set(origin.x, origin.y, origin.z);
				this.scene.add(this.originPointMarker);
			}
		}
	}

	private calculateShapeInfo(object: THREE.Object3D, intersection: THREE.Intersection): any {
		// Calculate the actual origin based on shape type
		let origin = null;
		let startPoint = null;
		let endPoint = null;
		
		const shapeType = object.userData?.originalEntityType || (object instanceof THREE.Line ? 'LINE' : 'MESH');
		
		if (object instanceof THREE.Line) {
			const geometry = object.geometry;
			if (geometry instanceof THREE.BufferGeometry) {
				const positions = geometry.attributes.position;
				if (positions.count >= 2) {
					// Get first and last points in local coordinates
					const localStartPoint = new THREE.Vector3(
						positions.getX(0),
						positions.getY(0),
						positions.getZ(0)
					);
					const localEndPoint = new THREE.Vector3(
						positions.getX(positions.count - 1),
						positions.getY(positions.count - 1),
						positions.getZ(positions.count - 1)
					);
					
					// Transform to world coordinates using the object's world matrix
					const worldStartPoint = localStartPoint.clone();
					const worldEndPoint = localEndPoint.clone();
					object.localToWorld(worldStartPoint);
					object.localToWorld(worldEndPoint);
					
					startPoint = {
						x: worldStartPoint.x,
						y: worldStartPoint.y,
						z: worldStartPoint.z
					};
					endPoint = {
						x: worldEndPoint.x,
						y: worldEndPoint.y,
						z: worldEndPoint.z
					};
					
					// For lines, origin is the start point
					if (shapeType === 'LINE') {
						origin = { ...startPoint };
					}
				}
			}
		}
		
		// Handle circle and arc origins
		if (shapeType === 'CIRCLE' || shapeType === 'ARC') {
			// For circles and arcs, check if we have center data in userData
			if (object.userData?.center) {
				// Use the stored center from DXF data
				const worldCenter = new THREE.Vector3(
					object.userData.center.x,
					object.userData.center.y,
					object.userData.center.z || 0
				);
				// If the object has transforms, apply them to get world coordinates
				if (object.parent) {
					object.parent.localToWorld(worldCenter);
				}
				origin = {
					x: worldCenter.x,
					y: worldCenter.y,
					z: worldCenter.z
				};
			} else {
				// Fallback: try to calculate center from geometry
				// For a circle drawn as a line loop, the center is the average of all points
				if (object instanceof THREE.Line && object.geometry instanceof THREE.BufferGeometry) {
					const positions = object.geometry.attributes.position;
					let centerX = 0, centerY = 0, centerZ = 0;
					const count = positions.count;
					
					for (let i = 0; i < count; i++) {
						centerX += positions.getX(i);
						centerY += positions.getY(i);
						centerZ += positions.getZ(i);
					}
					
					const localCenter = new THREE.Vector3(
						centerX / count,
						centerY / count,
						centerZ / count
					);
					
					const worldCenter = localCenter.clone();
					object.localToWorld(worldCenter);
					
					origin = {
						x: worldCenter.x,
						y: worldCenter.y,
						z: worldCenter.z
					};
				}
			}
		}
		
		// Default fallback for other shapes - use bounding box center
		if (!origin) {
			const box = new THREE.Box3().setFromObject(object);
			const center = box.getCenter(new THREE.Vector3());
			origin = {
				x: center.x,
				y: center.y,
				z: center.z
			};
		}
		
		return {
			origin, // Shape's actual origin point
			position: { // Keep this for backward compatibility, but it's the intersection point
				x: intersection.point.x.toFixed(3),
				y: intersection.point.y.toFixed(3),
				z: intersection.point.z.toFixed(3)
			},
			startPoint,
			endPoint,
			type: shapeType,
			layer: object.userData?.layer || '0',
			shapeIndex: object.userData?.shapeIndex
		};
	}

	public clearScene(resetZoom: boolean = true) {
		// Clear selection state
		this.selectionManager.clearAll();
		
		// Clear line objects tracking array
		this.lineObjects = [];
		
		// Clear materials tracking
		this.originalMaterials.clear();
		this.selectedMaterials.clear();
		this.hoveredMaterials.clear();
		
		// Clear geometry references
		this.geometryGroup = null;
		this.fileUnits = null;
		this.originalBounds = null;
		
		// Only reset zoom when loading new files, not during refresh operations
		if (resetZoom) {
			this.currentZoomPercent = 100;
		}
		
		while(this.scene.children.length > 2) { // Keep lights
			this.scene.remove(this.scene.children[2]);
		}
	}

	public getCamera() {
		return this.camera;
	}

	public getCurrentZoomPercent(): number {
		return this.currentZoomPercent;
	}
	
	public getCurrentZoomLevel(): number {
		// For backward compatibility, return zoom as 0-1 scale
		return this.currentZoomPercent / 100;
	}

	public toggleLayerVisibility(layerName: string, visible: boolean) {
		// Traverse all objects in the scene and toggle visibility based on layer
		this.scene.traverse((object) => {
			if ((object instanceof THREE.Mesh || object instanceof THREE.Line) && 
			    object.userData && object.userData.layer === layerName) {
				object.visible = visible;
			}
		});
		
		console.log(`Layer "${layerName}" visibility set to: ${visible}`);
	}

	public reSelectShapeByIndex(shapeIndex: number) {
		if (!this.geometryGroup) return;
		
		// Find object with matching shape index
		let foundObject: SelectableObject | null = null;
		this.geometryGroup.traverse((child) => {
			if (child.userData?.shapeIndex === shapeIndex) {
				foundObject = child as SelectableObject;
			}
		});
		
		if (foundObject) {
			// Create a mock intersection for selection
			const mockIntersection = {
				point: new THREE.Vector3(),
				object: foundObject
			} as THREE.Intersection;
			
			// Re-apply selection as pinned (since this is programmatic selection)
			this.selectionManager.handleClick(foundObject, mockIntersection);
		}
	}

	public getScene(): THREE.Scene {
		return this.scene;
	}

	public dispose() {
		this.renderer.dispose();
		this.container.removeChild(this.renderer.domElement);
	}
}