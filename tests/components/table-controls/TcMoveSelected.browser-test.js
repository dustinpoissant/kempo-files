import '../../../admin/components/table-controls/TcMoveSelected.js';
import { createGrid, cleanup, waitForSelectionChange } from './testHost.js';

export const page = './test-page.html';

export default {
  'renders the drive_file_move icon and Move label': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-move-selected');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    const icon = control.shadowRoot.querySelector('k-icon');
    if(!icon || icon.getAttribute('name') !== 'drive_file_move'){
      cleanup(container);
      return fail('Expected a drive_file_move k-icon in the shadow root');
    }
    if(!control.shadowRoot.textContent.includes('Move…')){
      cleanup(container);
      return fail(`Expected label "Move…", got "${control.shadowRoot.textContent}"`);
    }
    cleanup(container);
    pass('Renders icon and label');
  },

  'is disabled when nothing is selected': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-move-selected');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    if(!control.disabled){
      cleanup(container);
      return fail('Expected control to be disabled with an empty selection');
    }
    cleanup(container);
    pass('Disabled with nothing selected');
  },

  'enables once a folder alone is selected (selectionCount counts all records, not just files)': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-move-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    grid.selectAllOnPage(); // selects everything on the page, folder included
    await waitForSelectionChange(grid);
    await control.updateComplete;
    if(control.disabled){
      cleanup(container);
      return fail('Expected control to be enabled once records (including the folder) are selected');
    }
    cleanup(container);
    pass('Enabled once a mixed file/folder selection exists');
  },

  'dispatches move with every selected record on click': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-move-selected');
    const { container, grid } = await createGrid({ topControls: [control] });
    grid.selectAllOnPage();
    await waitForSelectionChange(grid);
    await control.updateComplete;
    let detail = null;
    control.addEventListener('move', e => { detail = e.detail; });
    control.click();
    if(!detail || !Array.isArray(detail.records)){
      cleanup(container);
      return fail(`Expected a move event with a records array, got ${JSON.stringify(detail)}`);
    }
    if(detail.records.length !== grid.records.length){
      cleanup(container);
      return fail(`Expected all ${grid.records.length} records in the event detail, got ${detail.records.length}`);
    }
    cleanup(container);
    pass('Dispatches move with the full selection, files and folders alike');
  },

  'does nothing on click while disabled': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-move-selected');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    let fired = false;
    control.addEventListener('move', () => { fired = true; });
    control.click();
    if(fired){
      cleanup(container);
      return fail('move should not fire while the control is disabled');
    }
    cleanup(container);
    pass('No event dispatched while disabled');
  },
};
