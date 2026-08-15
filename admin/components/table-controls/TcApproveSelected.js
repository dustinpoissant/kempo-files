import TableControl from './TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Only ever mounted by FileLibrary when the viewer holds files:upload_trusted — same gate the
  per-file entry menu applies to its own Approve/Withdraw item.
*/
export default class TcApproveSelected extends TableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Approve Selected';
  }

  handleAction(){
    const ids = this.selectedFiles.map(file => file.id);
    if(!ids.length) return;
    this.dispatchEvent(new CustomEvent('approve', { detail: { ids }, bubbles: true, composed: true }));
  }

  render(){ return html`<slot><k-icon name="check_circle" class="tc-success"></k-icon>Approve</slot>`; }
}

customElements.define('k-files-tc-approve-selected', TcApproveSelected);
