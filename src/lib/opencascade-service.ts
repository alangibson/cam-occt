import type { OpenCascadeInstance } from 'opencascade.js';

class OpenCascadeService {
	private static instance: OpenCascadeService;
	private oc: OpenCascadeInstance | null = null;
	private initialized = false;
	private initPromise: Promise<OpenCascadeInstance> | null = null;

	private constructor() {}

	static getInstance(): OpenCascadeService {
		if (!OpenCascadeService.instance) {
			OpenCascadeService.instance = new OpenCascadeService();
		}
		return OpenCascadeService.instance;
	}

	async initialize(): Promise<OpenCascadeInstance> {
		if (this.initialized && this.oc) {
			return this.oc;
		}

		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = this.loadOpenCascade();
		return this.initPromise;
	}

	private async loadOpenCascade(): Promise<OpenCascadeInstance> {
		try {
			// Check if we're in a browser environment
			if (typeof window === 'undefined') {
				throw new Error('OpenCascade.js can only be initialized in the browser');
			}

			console.log('Initializing OpenCascade.js...');
			
			// Dynamic import to avoid SSR issues
			const { default: initOpenCascade } = await import('opencascade.js');
			this.oc = await initOpenCascade();
			this.initialized = true;
			console.log('OpenCascade.js initialized successfully');
			return this.oc;
		} catch (error) {
			console.error('Failed to initialize OpenCascade.js:', error);
			throw new Error(`OpenCascade initialization failed: ${(error as Error).message}`);
		}
	}

	getOC(): OpenCascadeInstance | null {
		return this.oc;
	}

	isInitialized(): boolean {
		return this.initialized;
	}
}

export default OpenCascadeService;