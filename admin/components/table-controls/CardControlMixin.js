import { CardRecordMixin } from './CardRecordMixin.js';

/*
  Adds file-only hiding on top of CardRecordMixin's record resolution — for controls that genuinely
  don't apply to a directory (the public/trust toggles have no meaning for a folder). k-card-grid
  clones a slot="before"/"after" control into every tile regardless of record type, so a control has
  to opt itself out; nothing else does it for them.
*/
export const CardControlMixin = Base => class extends CardRecordMixin(Base) {
  willUpdate(changed){
    super.willUpdate?.(changed);
    this.hidden = this.record?._type !== 'file';
  }
};
