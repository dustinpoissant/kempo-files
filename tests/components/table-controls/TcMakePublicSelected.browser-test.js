import '../../../admin/components/table-controls/TcMakePublicSelected.js';
import { createGrid, cleanup, waitForSelectionChange, selectOnly } from './testHost.js';

export const page = './test-page.html';

export default {
  'renders the public icon and Make public label': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-make-public-selected');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    const icon = control.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'public' || !icon.classList.contains('tc-success')){
      cleanup(container);
      return fail('Expected a public k-icon with tc-success');
    }
    if(!control.shadowRoot.textContent.includes('Make public')){
      cleanup(container);
      return fail(`Expected label "Make public", got "${control.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'stays disabled when only a folder is selected — files-only action': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-make-public-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    selectOnly(grid, 'dir-1');
    await control.updateComplete;
    if(!control.disabled){
      cleanup(container);
      return fail('A folder-only selection has no files, so make-public should stay disabled');
    }
    cleanup(container);
    pass('Disabled with a folder-only selection');
  },

  'enables and dispatches make-public with only the selected file ids': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-make-public-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    grid.selectAllOnPage();
    await waitForSelectionChange(grid);
    await control.updateComplete;
    if(control.disabled){
      cleanup(container);
      return fail('Expected control to be enabled once files are selected');
    }
    let detail = null;
    control.addEventListener('make-public', e => { detail = e.detail; });
    control.click();
    const expectedFileIds = grid.records.filter(r => r._type === 'file').map(r => r.id);
    if(!detail || !Array.isArray(detail.ids)){
      cleanup(container);
      return fail(`Expected a make-public event with an ids array, got ${JSON.stringify(detail)}`);
    }
    const sameIds = detail.ids.length === expectedFileIds.length && expectedFileIds.every(id => detail.ids.includes(id));
    if(!sameIds){
      cleanup(container);
      return fail(`Expected file-only ids ${JSON.stringify(expectedFileIds)}, got ${JSON.stringify(detail.ids)}`);
    }
    cleanup(container);
    pass('Dispatches make-public with file ids only, folder excluded');
  },
};
