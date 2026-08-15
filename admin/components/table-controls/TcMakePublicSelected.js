import TableControl from './TableControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

export default class TcMakePublicSelected extends TableControl {
  connectedCallback(){
    super.connectedCallback();
    if(!this.hasAttribute('title')) this.title = 'Make Selected Public';
  }

  handleAction(){
    const ids = this.selectedFiles.map(file => file.id);
    if(!ids.length) return;
    this.dispatchEvent(new CustomEvent('make-public', { detail: { ids }, bubbles: true, composed: true }));
  }

  render(){ return html`<slot><k-icon name="public" class="tc-success"></k-icon>Make public</slot>`; }
}

customElements.define('k-files-tc-make-public-selected', TcMakePublicSelected);
