import TableControl from './TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class TcRejectSelected extends TableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Reject Selected';
  }

  /*
    Same subset as Approve. Withdrawing trust from a file that could never have it is a no-op the
    server accepts silently, which would report "3 files rejected" over files nothing changed for.
  */
  get selectionCount(){
    return this.reviewableFiles.length;
  }

  handleAction(){
    const ids = this.reviewableFiles.map(file => file.id);
    if(!ids.length) return;
    this.dispatchEvent(new CustomEvent('reject', { detail: { ids }, bubbles: true, composed: true }));
  }

  render(){ return html`<slot><k-icon name="cancel" class="tc-danger"></k-icon>Reject</slot>`; }
}

customElements.define('k-files-tc-reject-selected', TcRejectSelected);
