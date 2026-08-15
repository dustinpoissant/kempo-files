/*
  Resolves which record a cloned per-card control belongs to. k-card-grid clones a slot="before"/
  "after" control (tag + attributes only) into every tile, so a clone can't be handed its record
  directly — it has to find it itself, the same way kempo core's AdminTableControl.record works for
  Table's own before/after row controls: walk up to the tile the clone landed in, read its
  data-index, look that index up on the host's live records.

  Split out from CardControlMixin (which adds file-only hiding on top of this) because not every
  control that needs its record also needs to hide itself on directories — rename/move/delete apply
  to both.
*/
export const CardRecordMixin = Base => class extends Base {
  get record(){
    const tile = this.closest('.tile');
    const idx = tile?.dataset?.index;
    if(idx === undefined) return null;
    return this.host?.records?.[idx] ?? null;
  }
};
