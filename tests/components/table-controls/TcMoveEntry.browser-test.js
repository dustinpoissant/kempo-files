import '../../../admin/components/table-controls/TcMoveEntry.js';
import { createGrid, cleanup, tileFor } from './testHost.js';

export const page = './test-page.html';

const cloneFor = (grid, recordId) => tileFor(grid, recordId).querySelector('k-files-tc-move-entry');

export default {
  'renders the drive_file_move icon and Move… label': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-move-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1');
    await clone.updateComplete;
    const icon = clone.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'drive_file_move'){
      cleanup(container);
      return fail('Expected a drive_file_move k-icon');
    }
    if(!clone.shadowRoot.textContent.includes('Move…')){
      cleanup(container);
      return fail(`Expected label "Move…", got "${clone.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'stays visible on a directory record — move applies to folders too': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-move-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'dir-1');
    await clone.updateComplete;
    if(clone.hidden){
      cleanup(container);
      return fail('Unlike the public/trust toggles, move should not hide itself on a folder');
    }
    cleanup(container);
    pass('Visible on a directory record');
  },

  'dispatches move-entry with the folder record when clicked on a folder tile': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-move-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'dir-1');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('move-entry', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.record?.id !== 'dir-1'){
      cleanup(container);
      return fail(`Expected move-entry with the folder record, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches move-entry for a folder tile');
  },

  'dispatches move-entry with the file record when clicked on a file tile': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-move-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-3');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('move-entry', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.record?.id !== 'file-3'){
      cleanup(container);
      return fail(`Expected move-entry with the file record, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches move-entry for a file tile');
  },
};
