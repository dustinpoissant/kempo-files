import '../../../admin/components/table-controls/TcSelectionCount.js';
import { createGrid, cleanup, waitForSelectionChange, selectOnly } from './testHost.js';

export const page = './test-page.html';

export default {
  'shows "0 selected" and stays visible with nothing checked': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-selection-count');
    const { container } = await createGrid({ topControls: [control] });
    await control.updateComplete;
    if(control.hidden){
      cleanup(container);
      return fail('Should stay visible at zero to avoid the bar shifting when the first item is checked');
    }
    // shadowRoot.textContent also picks up the injected <style> tag's own CSS text in this
    // environment, so a substring check (not exact equality) is what actually reflects rendering.
    if(control.count !== 0 || !control.shadowRoot.textContent.includes('0 selected')){
      cleanup(container);
      return fail(`Expected count 0 and rendered text including "0 selected", got count ${control.count}`);
    }
    cleanup(container);
    pass('Shows "0 selected" and stays visible');
  },

  'counts folders and files together, not files only': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-selection-count');
    const { container, grid } = await createGrid({ topControls: [control] });
    grid.selectAllOnPage();
    await waitForSelectionChange(grid);
    await control.updateComplete;
    if(control.count !== grid.records.length || !control.shadowRoot.textContent.includes(`${grid.records.length} selected`)){
      cleanup(container);
      return fail(`Expected count ${grid.records.length} (folder included), got count ${control.count}`);
    }
    cleanup(container);
    pass('Counts every record type in the selection');
  },

  'updates live as the selection changes': async ({ pass, fail }) => {
    const control = document.createElement('k-files-tc-selection-count');
    const { container, grid } = await createGrid({ topControls: [control] });
    selectOnly(grid, 'dir-1');
    await control.updateComplete;
    if(control.count !== 1 || !control.shadowRoot.textContent.includes('1 selected')){
      cleanup(container);
      return fail(`Expected count 1 after selecting one record, got count ${control.count}`);
    }
    cleanup(container);
    pass('Reflects a single-record selection');
  },
};
