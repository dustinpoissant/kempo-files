import TableControl from './TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class TcMakePrivateSelected extends TableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Make Selected Private';
  }

  handleAction(){
    const ids = this.selectedFiles.map(file => file.id);
    if(!ids.length) return;
    this.dispatchEvent(new CustomEvent('make-private', { detail: { ids }, bubbles: true, composed: true }));
  }

  render(){ return html`<slot><k-icon name="public_off" class="tc-danger"></k-icon>Make private</slot>`; }
}

customElements.define('k-files-tc-make-private-selected', TcMakePrivateSelected);
