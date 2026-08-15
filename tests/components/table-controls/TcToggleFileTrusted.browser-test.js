import '../../../admin/components/table-controls/TcToggleFileTrusted.js';
import { createGrid, cleanup, tileFor } from './testHost.js';

export const page = './test-page.html';

const cloneFor = (grid, recordId) => tileFor(grid, recordId).querySelector('k-files-tc-toggle-trusted');

export default {
  'hides itself on a directory record': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-trusted');
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

  'shows a green check_circle icon for a trusted file and title "Withdraw approval"': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-trusted');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-2'); // analytics.js, trusted: true
    await clone.updateComplete;
    const icon = clone.shadowRoot.querySelector('k-icon');
    if(icon.getAttribute('name') !== 'check_circle' || !icon.classList.contains('tc-success')){
      cleanup(container);
      return fail(`Expected a check_circle/tc-success icon for a trusted file, got name="${icon.getAttribute('name')}" class="${icon.className}"`);
    }
    if(clone.title !== 'Withdraw approval'){
      cleanup(container);
      return fail(`Expected title "Withdraw approval", got "${clone.title}"`);
    }
    cleanup(container);
    pass('Trusted file shows green check_circle icon');
  },

  'shows a red cancel icon for an unreviewed file and title "Approve to run in the browser"': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-trusted');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-1'); // 802.svg, trusted: false
    await clone.updateComplete;
    const icon = clone.shadowRoot.querySelector('k-icon');
    if(icon.getAttribute('name') !== 'cancel' || !icon.classList.contains('tc-danger')){
      cleanup(container);
      return fail(`Expected a cancel/tc-danger icon for an unreviewed file, got name="${icon.getAttribute('name')}" class="${icon.className}"`);
    }
    if(clone.title !== 'Approve to run in the browser'){
      cleanup(container);
      return fail(`Expected title "Approve to run in the browser", got "${clone.title}"`);
    }
    cleanup(container);
    pass('Unreviewed file shows red cancel icon');
  },

  'dispatches toggle-trusted with the id and record of the clicked tile only': async ({ pass, fail }) => {
    const template = document.createElement('k-files-tc-toggle-trusted');
    const { container, grid } = await createGrid({ afterControls: [template] });
    const clone = cloneFor(grid, 'file-2');
    await clone.updateComplete;
    let detail = null;
    clone.addEventListener('toggle-trusted', e => { detail = e.detail; });
    clone.click();
    if(!detail || detail.id !== 'file-2' || detail.record?.id !== 'file-2'){
      cleanup(container);
      return fail(`Expected toggle-trusted for file-2 only, got ${JSON.stringify(detail)}`);
    }
    cleanup(container);
    pass('Dispatches toggle-trusted scoped to the clicked tile\'s own record');
  },
};
