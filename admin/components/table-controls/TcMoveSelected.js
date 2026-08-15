import TableControl from './TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Moving needs a destination picker and a server call — neither belongs on k-table itself — so this
  only reads the table's current selection and hands the records off to whoever's listening
  (FileLibrary) via a bubbling event, same division of labor as GroupDeleteSelected's
  groupRemoveSelected. Folders can be moved same as files (unlike make-public/approve/etc, which are
  file-only fields), so this reads the full, unfiltered selection rather than selectedFiles — hence
  the selectionCount override, so the control isn't stuck disabled when only folders are checked.
*/
export default class TcMoveSelected extends TableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Move Selected';
  }

  get selectionCount(){
    return this.selectedRecords.length;
  }

  handleAction(){
    const records = this.selectedRecords;
    if(!records.length) return;
    this.dispatchEvent(new CustomEvent('move', { detail: { records }, bubbles: true, composed: true }));
  }

  render(){ return html`<slot><k-icon name="drive_file_move"></k-icon>Move…</slot>`; }
}

customElements.define('k-files-tc-move-selected', TcMoveSelected);
