import '../../../admin/components/table-controls/TcRenameEntry.js';
import { createGrid, cleanup, tileFor } from './testHost.js';

export const page = './test-page.html';

const cloneFor = (grid, recordId) => tileFor(grid, recordId).querySelector('k-files-tc-rename-entry');

export default {
  'renders the edit icon and Rename… label': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-rename-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1');
    await clone.updateComplete;
    const icon = clone.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'edit'){
      cleanup(container);
      return fail('Expected an edit k-icon');
    }
    if(!clone.shadowRoot.textContent.includes('Rename…')){
      cleanup(container);
      return fail(`Expected label "Rename…", got "${clone.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'stays visible on a directory record — rename applies to folders too': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-rename-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'dir-1');
    await clone.updateComplete;
    if(clone.hidden){
      cleanup(container);
      return fail('Unlike the public/trust toggles, rename should not hide itself on a folder');
    }
    cleanup(container);
    pass('Visible on a directory record');
  },

  'resolves the folder record on a folder tile and the file record on a file tile': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-rename-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const folderClone = cloneFor(grid, 'dir-1');
    const fileClone = cloneFor(grid, 'file-1');
    if(folderClone.record?._type !== 'directory' || fileClone.record?._type !== 'file'){
      cleanup(container);
      return fail('Each clone should resolve the record type belonging to its own tile');
    }
    cleanup(container);
    pass('Resolves the correct record on both tile types');
  },

  'dispatches rename-entry with the folder record when clicked on a folder tile': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-rename-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'dir-1');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('rename-entry', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.record?.id !== 'dir-1'){
      cleanup(container);
      return fail(`Expected rename-entry with the folder record, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches rename-entry for a folder tile');
  },

  'dispatches rename-entry with the file record when clicked on a file tile': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-rename-entry');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('rename-entry', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.record?.id !== 'file-1'){
      cleanup(container);
      return fail(`Expected rename-entry with the file record, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches rename-entry for a file tile');
  },
};
