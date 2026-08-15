import '../../../admin/components/table-controls/TcRejectSelected.js';
import { createGrid, cleanup, waitForSelectionChange, selectOnly } from './testHost.js';

export const page = './test-page.html';

export default {
  'renders the cancel icon and Reject label': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-reject-selected');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    const icon = control.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'cancel' || !icon.classList.contains('tc-danger')){
      cleanup(container);
      return fail('Expected a cancel k-icon with tc-danger');
    }
    if(!control.shadowRoot.textContent.includes('Reject')){
      cleanup(container);
      return fail(`Expected label "Reject", got "${control.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'stays disabled when only a folder is selected — files-only action': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-reject-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    selectOnly(grid, 'dir-1');
    await control.updateComplete;
    if(!control.disabled){
      cleanup(container);
      return fail('A folder-only selection has no files, so reject should stay disabled');
    }
    cleanup(container);
    pass('Disabled with a folder-only selection');
  },

  'enables and dispatches reject with only the selected file ids': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-reject-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    grid.selectAllOnPage();
    await waitForSelectionChange(grid);
    await control.updateComplete;
    let detail = null;
    control.addEventListener('reject', e => { detail = e.detail; });
    control.click();
    const expectedFileIds = grid.records.filter(r => r._type === 'file').map(r => r.id);
    if(!detail || detail.ids.length !== expectedFileIds.length || !expectedFileIds.every(id => detail.ids.includes(id))){
      cleanup(container);
      return fail(`Expected file-only ids ${JSON.stringify(expectedFileIds)}, got ${JSON.stringify(detail?.ids)}`);
    }
    cleanup(container);
    pass('Dispatches reject with file ids only, folder excluded');
  },
};
