import CardControl from './CardControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Shows the file's current access, not the action — same convention as accessIcon() elsewhere in
  FileLibrary — so "public" means "this is public right now", not "click to make public".
*/
export default class TcToggleFilePublic extends CardControl {
  handleAction(){
    const record = this.record;
    if(!record) return;
    this.dispatchEvent(new CustomEvent('toggle-public', { detail: { id: record.id, record }, bubbles: true, composed: true }));
  }

  render(){
    const isPublic = !!this.record?.public;
    this.title = isPublic ? 'Make private' : 'Make public';
    return html`<slot><k-icon name=${isPublic ? 'public' : 'public_off'} class=${isPublic ? 'tc-success' : 'tc-danger'}></k-icon></slot>`;
  }
}

customElements.define('k-files-tc-toggle-public', TcToggleFilePublic);
