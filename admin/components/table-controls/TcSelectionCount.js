import Control from '/kempo-ui/components/controls/Control.js';
import { html } from '/kempo-ui/lit-all.min.js';

/*
  Plain text, not a button — extends Control directly rather than TableControl/ButtonControl, since
  it has no click behavior. Always visible, "0 selected" included — hiding it when empty was making
  the whole bar shift as soon as the first item got checked; the action buttons alongside it already
  stay visible (just disabled) at zero for the same reason.
*/
export default class TcSelectionCount extends Control {
  static hostEvents = ['selectionChange'];

  get count(){
    return (this.host?.getSelectedRecords?.() || []).length;
  }

  render(){
    return html`${this.count} selected`;
  }
}

customElements.define('k-files-tc-selection-count', TcSelectionCount);
