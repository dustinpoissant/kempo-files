import { html } from '/kempo-ui/lit-all.min.js';

/*
  Video/audio/model3d/archive/font ship in kempo core's own shared icon set (kempo/src/kempo/icons) —
  they are common enough that other extensions plausibly want them too, so they do not belong to this
  one. Document/text/folder/other reuse kempo-ui's existing icons rather than duplicating them.
*/
const KIND_ICON_NAME = {
  video: 'video', audio: 'audio', model3d: 'model3d', archive: 'archive', font: 'font',
  document: 'file-text', text: 'code', folder: 'folder', other: 'file',
};

/*
  row (k-table's shadow root) and tile (k-card-grid's shadow root, via cardTemplate) are both callers
  reaching in from FileLibrary's own render functions — a foreign shadow root FileLibrary's own
  scoped .glyph/.thumb.folder .glyph rules cannot reach, so both get an inline font-size instead.
  Thumb.js's own internal call (row only, never tile) is different: it renders into Thumb's own
  shadow root regardless of where <k-files-thumb> sits, so its non-row case keeps the `glyph` class
  and relies on Thumb's own copy of that rule.
*/
export const kindIcon = (kind, { row = false, tile = false } = {}) => {
  const size = row ? '1.25rem' : kind === 'folder' ? '3.25rem' : '2.75rem';
  return html`
    <k-icon
      name=${KIND_ICON_NAME[kind] || 'file'}
      class=${row || tile ? 'tc-muted' : 'glyph tc-muted'}
      style=${row || tile ? `font-size:${size}` : ''}
    ></k-icon>
  `;
};
