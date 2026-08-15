import '../../../admin/components/table-controls/TcToggleFilePublic.js';
import { createGrid, cleanup, tileFor } from './testHost.js';

export const page = './test-page.html';

/*
  These clone into every tile via k-card-grid's slot="after" mechanism (see CardGrid.js), so the
  registered template element itself is never what's asserted on — always the clone that actually
  landed in a specific record's own tile, exactly like production.
*/
const cloneFor = (grid, recordId) => tileFor(grid, recordId).querySelector('k-files-tc-toggle-public');

export default {
  'hides itself on a directory record': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-public');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'dir-1');
    await clone.updateComplete;
    if(!clone.hidden){
      cleanup(container);
      return fail('Expected the toggle to hide itself on a folder tile');
    }
    cleanup(container);
    pass('Hidden on a directory record');
  },

  'is visible on a file record': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-public');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1');
    await clone.updateComplete;
    if(clone.hidden){
      cleanup(container);
      return fail('Expected the toggle to be visible on a file tile');
    }
    cleanup(container);
    pass('Visible on a file record');
  },

  'resolves its own record from the tile it landed in': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-public');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const publicClone = cloneFor(grid, 'file-3'); // hero.jpg, public: true
    const privateClone = cloneFor(grid, 'file-1'); // 802.svg, public: false
    if(publicClone.record?.id !== 'file-3' || privateClone.record?.id !== 'file-1'){
      cleanup(container);
      return fail('Each clone should resolve the record belonging to its own tile, not a shared one');
    }
    cleanup(container);
    pass('Each clone resolves its own record independently');
  },

  'shows a green public icon for a public file and title "Make private"': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-public');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-3'); // hero.jpg, public: true
    await clone.updateComplete;
    const icon = clone.shadowRoot.querySelector('k-icon');
    if(icon.getAttribute('name') !== 'public' || !icon.classList.contains('tc-success')){
      cleanup(container);
      return fail(`Expected a public/tc-success icon for a public file, got name="${icon.getAttribute('name')}" class="${icon.className}"`);
    }
    if(clone.title !== 'Make private'){
      cleanup(container);
      return fail(`Expected title "Make private", got "${clone.title}"`);
    }
    cleanup(container);
    pass('Public file shows green public icon');
  },

  'shows a red public_off icon for a private file and title "Make public"': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-public');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1'); // 802.svg, public: false
    await clone.updateComplete;
    const icon = clone.shadowRoot.querySelector('k-icon');
    if(icon.getAttribute('name') !== 'public_off' || !icon.classList.contains('tc-danger')){
      cleanup(container);
      return fail(`Expected a public_off/tc-danger icon for a private file, got name="${icon.getAttribute('name')}" class="${icon.className}"`);
    }
    if(clone.title !== 'Make public'){
      cleanup(container);
      return fail(`Expected title "Make public", got "${clone.title}"`);
    }
    cleanup(container);
    pass('Private file shows red public_off icon');
  },

  'dispatches toggle-public with the id and record of the clicked tile only': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-public');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('toggle-public', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.id !== 'file-1' || detail.record?.id !== 'file-1'){
      cleanup(container);
      return fail(`Expected toggle-public for file-1 only, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches toggle-public scoped to the clicked tile\'s own record');
  },
};
