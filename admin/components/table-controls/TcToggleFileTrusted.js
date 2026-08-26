import CardControl from './CardControl.js';
import { html } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Icon.js';

/*
  Shows the file's current trust status, not the action — check_circle means "already approved",
  cancel means "not reviewed yet", matching statusIcon()'s own current-state convention elsewhere.
*/
export default class TcToggleFileTrusted extends CardControl {
  /*
    Hidden entirely on a file nobody can approve, on top of CardControl's own file-only hiding. A
    disabled toggle would still be asking a question that has no answer — the file is not pending
    approval, it is outside the idea of approval altogether.
  */
  willUpdate(changed){
    super.willUpdate?.(changed);
    if(!this.hidden) this.hidden = this.record?.reviewable === false;
  }

  handleAction(){
    const record = this.record;
    if(!record || record.reviewable === false) return;
    this.dispatchEvent(new CustomEvent('toggle-trusted', { detail: { id: record.id, record }, bubbles: true, composed: true }));
  }

  render(){
    const trusted = !!this.record?.trusted;
    this.title = trusted ? 'Withdraw approval' : 'Approve to run in the browser';
    return html`<slot><k-icon name=${trusted ? 'check_circle' : 'cancel'} class=${trusted ? 'tc-success' : 'tc-danger'}></k-icon></slot>`;
  }
}

customElements.define('k-files-tc-toggle-trusted', TcToggleFileTrusted);
