import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';
import { CardRecordMixin } from './CardRecordMixin.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Works for a file or a folder — see TcRenameEntry for why this uses CardRecordMixin, not
  CardControlMixin. Dispatches move-entry with the record; FileLibrary decides whether that means
  moveFile or moveDirectory.
*/
export default class TcMoveEntry extends CardRecordMixin(ButtonControl) {
  handleAction(){
    const record = this.record;
    if(!record) return;
    this.dispatchEvent(new CustomEvent('move-entry', { detail: { record }, bubbles: true, composed: true }));
  }

  render(){
    return html`<slot><k-icon name="drive_file_move"></k-icon> Move…</slot>`;
  }
}

customElements.define('k-files-tc-move-entry', TcMoveEntry);
