import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';
import { CardRecordMixin } from './CardRecordMixin.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Works for a file or a folder — see TcRenameEntry for why this uses CardRecordMixin, not
  CardControlMixin. Dispatches delete-entry with the record; FileLibrary decides whether that means
  removeFile or removeDirectory (a non-empty folder is refused server-side rather than emptied).
*/
export default class TcDeleteEntry extends CardRecordMixin(ButtonControl) {
  handleAction(){
    const record = this.record;
    if(!record) return;
    this.dispatchEvent(new CustomEvent('delete-entry', { detail: { record }, bubbles: true, composed: true }));
  }

  render(){
    return html`<slot><k-icon name="delete"></k-icon> Delete…</slot>`;
  }
}

customElements.define('k-files-tc-delete-entry', TcDeleteEntry);
