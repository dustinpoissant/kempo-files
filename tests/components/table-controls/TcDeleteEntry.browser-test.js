import '../../../admin/components/table-controls/TcDeleteEntry.js';
import { createGrid, cleanup, tileFor } from './testHost.js';

export const page = './test-page.html';

const cloneFor = (grid, recordId) => tileFor(grid, recordId).querySelector('k-files-tc-delete-entry');

export default {
  'renders the delete icon and Delete… label': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-delete-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1');
    await clone.updateComplete;
    const icon = clone.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'delete'){
      cleanup(container);
      return fail('Expected a delete k-icon');
    }
    if(!clone.shadowRoot.textContent.includes('Delete…')){
      cleanup(container);
      return fail(`Expected label "Delete…", got "${clone.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'stays visible on a directory record — delete applies to folders too': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-delete-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'dir-1');
    await clone.updateComplete;
    if(clone.hidden){
      cleanup(container);
      return fail('Unlike the public/trust toggles, delete should not hide itself on a folder');
    }
    cleanup(container);
    pass('Visible on a directory record');
  },

  'dispatches delete-entry with the folder record when clicked on a folder tile': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-delete-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'dir-1');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('delete-entry', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.record?.id !== 'dir-1'){
      cleanup(container);
      return fail(`Expected delete-entry with the folder record, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches delete-entry for a folder tile');
  },

  'dispatches delete-entry with the file record when clicked on a file tile': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-delete-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-2');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('delete-entry', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.record?.id !== 'file-2'){
      cleanup(container);
      return fail(`Expected delete-entry with the file record, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches delete-entry for a file tile');
  },
};
