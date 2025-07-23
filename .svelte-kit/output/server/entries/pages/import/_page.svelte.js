import { F as attr_class, D as pop, z as push } from "../../../chunks/index.js";
import "clsx";
function _page($$payload, $$props) {
  push();
  let dragOver = false;
  $$payload.out.push(`<div class="import-page svelte-91crr2"><div class="card text-center"><h1 class="mb-2">Import Drawing</h1> <p class="mb-4">Select a SVG or DXF file to begin creating your CNC program</p> <div${attr_class("drop-zone svelte-91crr2", void 0, { "drag-over": dragOver })} role="button" tabindex="0"><div class="drop-content svelte-91crr2"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="svelte-91crr2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg> <h3 class="svelte-91crr2">Drop files here or click to browse</h3> <p class="svelte-91crr2">Supported formats: SVG, DXF</p></div></div> <input type="file" accept=".svg,.dxf" style="display: none;"/> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div></div>`);
  pop();
}
export {
  _page as default
};
