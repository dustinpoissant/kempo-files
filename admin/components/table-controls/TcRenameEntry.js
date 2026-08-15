import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';
import { CardRecordMixin } from './CardRecordMixin.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Works for a file or a folder — CardRecordMixin only, not CardControlMixin, since rename applies to
  both and has no reason to hide on either. Dispatches rename-entry with the record; FileLibrary
  decides whether that means renameFile or renameDirectory.
*/
export default class TcRenameEntry extends CardRecordMixin(ButtonControl) {
  handleAction(){
    const record = this.record;
    if(!record) return;
    this.dispatchEvent(new CustomEvent('rename-entry', { detail: { record }, bubbles: true, composed: true }));
  }

  render(){
    return html`<slot><k-icon name="edit"></k-icon> Rename…</slot>`;
  }
}

customElements.define('k-files-tc-rename-entry', TcRenameEntry);
