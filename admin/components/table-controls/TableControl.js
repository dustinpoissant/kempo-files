import ButtonControl from '/kempo-ui/components/controls/ButtonControl.js';
import { css } from '/kempo-ui/lit-all.min.js';

/*
  Shared base for kempo-files' own k-files-tc-* family — same shape kempo-ui's own Tc* controls and
  kempo core's AdminTableControl use: host discovery via closest('[controlled]') (k-table sets that
  on itself), disabled state, click/keyboard handling all come from ButtonControl/Control. This adds
  only what every one of ours needs — reading the table's own live selection — plus the
  disable-when-nothing-selected behavior every action control here shares.

  selectedFiles filters to files only, since folder rows have no public/trusted/etc fields —
  make-public, make-private, approve and reject all read this and stay files-only. Move and delete
  are the exception: a folder can be moved or deleted same as a file, so those two override
  selectionCount to count the full selection (selectedRecords, unfiltered) rather than files alone.
*/
export default class TableControl extends ButtonControl {
  static hostEvents = ['selectionChange'];

  /*
    The host is display:inline-flex (Control.styles) with no gap of its own — a literal space
    between <k-icon> and the label text in render() doesn't reliably render as a visible gap once
    icon and text are separate flex items (flex collapses/ignores that whitespace text node rather
    than treating it like normal inline flow). kempo-ui's own FormatBlock hits the same thing and
    fixes it the same way: a real gap on :host, no space character in the markup.
  */
  static styles = [
    ...ButtonControl.styles,
    css`:host{ gap: 0.5rem; }`
  ];

  get selectedRecords(){
    return this.host?.getSelectedRecords?.() || [];
  }

  get selectedFiles(){
    return this.selectedRecords.filter(record => record._type === 'file');
  }

  /*
    The subset approve/reject act on. A file stored on a user's behalf can never be approved, so
    including it would mean a bulk approve reported success over files the server refused — and
    selecting a folder of them would leave the button enabled with nothing it could actually do.
  */
  get reviewableFiles(){
    return this.selectedFiles.filter(record => record.reviewable !== false);
  }

  get selectionCount(){
    return this.selectedFiles.length;
  }

  willUpdate(changed){
    super.willUpdate?.(changed);
    this.disabled = this.selectionCount === 0;
  }
}
