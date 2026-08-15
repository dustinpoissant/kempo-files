import TableControl from './TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class TcRejectSelected extends TableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Reject Selected';
  }

  handleAction(){
    const ids = this.selectedFiles.map(file => file.id);
    if(!ids.length) return;
    this.dispatchEvent(new CustomEvent('reject', { detail: { ids }, bubbles: true, composed: true }));
  }

  render(){ return html`<slot><k-icon name="cancel" class="tc-danger"></k-icon>Reject</slot>`; }
}

customElements.define('k-files-tc-reject-selected', TcRejectSelected);
