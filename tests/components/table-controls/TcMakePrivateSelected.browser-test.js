import '../../../admin/components/table-controls/TcMakePrivateSelected.js';
import { createGrid, cleanup, waitForSelectionChange, selectOnly } from './testHost.js';

export const page = './test-page.html';

export default {
  'renders the public_off icon and Make private label': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-make-private-selected');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    const icon = control.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'public_off' || !icon.classList.contains('tc-danger')){
      cleanup(container);
      return fail('Expected a public_off k-icon with tc-danger');
    }
    if(!control.shadowRoot.textContent.includes('Make private')){
      cleanup(container);
      return fail(`Expected label "Make private", got "${control.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'stays disabled when only a folder is selected — files-only action': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-make-private-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    selectOnly(grid, 'dir-1');
    await control.updateComplete;
    if(!control.disabled){
      cleanup(container);
      return fail('A folder-only selection has no files, so make-private should stay disabled');
    }
    cleanup(container);
    pass('Disabled with a folder-only selection');
  },

  'enables and dispatches make-private with only the selected file ids': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-make-private-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    grid.selectAllOnPage();
    await waitForSelectionChange(grid);
    await control.updateComplete;
    let detail = null;
    control.addEventListener('make-private', e => { detail = e.detail; });
    control.click();
    const expectedFileIds = grid.records.filter(r => r._type === 'file').map(r => r.id);
    if(!detail || detail.ids.length !== expectedFileIds.length || !expectedFileIds.every(id => detail.ids.includes(id))){
      cleanup(container);
      return fail(`Expected file-only ids ${JSON.stringify(expectedFileIds)}, got ${JSON.stringify(detail?.ids)}`);
    }
    cleanup(container);
    pass('Dispatches make-private with file ids only, folder excluded');
  },
};
