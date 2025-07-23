export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.BS-PDpNV.js",app:"_app/immutable/entry/app.D_ktBkHS.js",imports:["_app/immutable/entry/start.BS-PDpNV.js","_app/immutable/chunks/DHqXLbFk.js","_app/immutable/chunks/D7MHo5Fi.js","_app/immutable/chunks/DZGQKL0P.js","_app/immutable/entry/app.D_ktBkHS.js","_app/immutable/chunks/C1FmrZbK.js","_app/immutable/chunks/DZGQKL0P.js","_app/immutable/chunks/CWj6FrbW.js","_app/immutable/chunks/D7MHo5Fi.js","_app/immutable/chunks/Fj0hnEDm.js","_app/immutable/chunks/BSx0-f7u.js","_app/immutable/chunks/BmPMW8co.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js')),
			__memo(() => import('./nodes/4.js')),
			__memo(() => import('./nodes/5.js')),
			__memo(() => import('./nodes/6.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/export",
				pattern: /^\/export\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/import",
				pattern: /^\/import\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/modify",
				pattern: /^\/modify\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/program",
				pattern: /^\/program\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
