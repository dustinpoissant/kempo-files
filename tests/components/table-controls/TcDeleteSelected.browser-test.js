import '../../../admin/components/table-controls/TcDeleteSelected.js';
import { createGrid, cleanup, selectOnly } from './testHost.js';

export const page = './test-page.html';

export default {
  'renders the delete icon and Delete label': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-delete-selected');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    const icon = control.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'delete'){
      cleanup(container);
      return fail('Expected a delete k-icon');
    }
    if(!control.shadowRoot.textContent.includes('Delete')){
      cleanup(container);
      return fail(`Expected label "Delete", got "${control.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'enables when only a folder is selected — folders can be deleted too': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-delete-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    selectOnly(grid, 'dir-1');
    await control.updateComplete;
    if(control.disabled){
      cleanup(container);
      return fail('Expected control to be enabled with only a folder selected, unlike the files-only actions');
    }
    cleanup(container);
    pass('Enabled with a folder-only selection');
  },

  'dispatches delete with the selected folder record': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-delete-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    selectOnly(grid, 'dir-1');
    await control.updateComplete;
    let detail = null;
    control.addEventListener('delete', e => { detail = e.detail; });
    control.click();
    if(!detail || detail.records.length !== 1 || detail.records[0].id !== 'dir-1'){
      cleanup(container);
      return fail(`Expected delete event with just the folder record, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches delete with the folder record');
  },
};
