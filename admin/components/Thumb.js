import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import '/kempo-ui/components/Icon.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import { urlForFile } from '/kempo-files/sdk.js';
import { kindIcon } from '/admin/extension/kempo-files/utils/kindIcon.js';

/*
  The thumbnail used in both the grid tile and the list row. kind:'image' is not the same thing as
  "safe to render" — an unreviewed SVG is served as text/plain until approved, so the <img> 404s on
  content-type. Owning the broken-image fallback here, reactively, means neither caller has to track
  or re-render around it — a k-table row calculator can just always return a fresh <k-files-thumb>.
*/
export default class Thumb extends ShadowComponent {
  static properties = {
    file: { type: Object },
    row: { type: Boolean },
    _broken: { state: true },
  };

  constructor(){
    super();
    this.file = null;
    this.row = false;
    this._broken = false;
  }

  handleError = () => { this._broken = true; };

  render(){
    if(!this.file) return html``;
    if(this.file.kind !== 'image' || this._broken) return kindIcon(this.file.kind, { row: this.row });

    // Inline style, not a class: the row variant renders inside k-table's shadow root.
    return this.row
      ? html`<img src=${urlForFile(this.file)} alt="" loading="lazy" style="width:1.25rem;height:1.25rem;object-fit:contain;display:block" @error=${this.handleError} />`
      : html`<img src=${urlForFile(this.file)} alt=${this.file.altText || this.file.name} loading="lazy" @error=${this.handleError} />`;
  }

  static styles = css`
    /* No box of its own: the caller's grid/flex/table-cell context sizes and centers whatever this
       renders exactly as if it were a direct child, same as before this was its own component. */
    :host { display: contents; }
    img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .glyph { font-size: 2.75rem; }
  `;
}

customElements.define('k-files-thumb', Thumb);
