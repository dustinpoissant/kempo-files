import TableControl from './TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Named to match kempo-ui's own kc-tc-delete-selected (a different tag, k-files-tc-delete-selected,
  so there's no collision) — deliberately parallel, not reused, because deleting a kempo-files entry
  needs a confirm dialog and a server call, not k-table's own client-side-only deleteSelected().
  Folders can be deleted same as files, so — like TcMoveSelected — this reads the full, unfiltered
  selection (selectedRecords) and overrides selectionCount so it isn't stuck disabled when only
  folders are checked.
*/
export default class TcDeleteSelected extends TableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Delete Selected';
  }

  get selectionCount(){
    return this.selectedRecords.length;
  }

  handleAction(){
    const records = this.selectedRecords;
    if(!records.length) return;
    this.dispatchEvent(new CustomEvent('delete', { detail: { records }, bubbles: true, composed: true }));
  }

  render(){ return html`<slot><k-icon name="delete"></k-icon>Delete</slot>`; }
}

customElements.define('k-files-tc-delete-selected', TcDeleteSelected);
