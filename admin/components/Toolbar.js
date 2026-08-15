import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/SegmentedControl.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

/*
  Search, kind filter, view toggle and the three permission-gated action buttons. Purely a control
  surface: it holds no library state of its own, just reflects what the library passes in and
  dispatches an event per action for the library to act on.
*/
export default class Toolbar extends ShadowComponent {
  static properties = {
    kind: { type: String },
    viewMode: { type: String, attribute: 'view-mode' },
    canTrust: { type: Boolean, attribute: 'can-trust' },
    canCreateDirectory: { type: Boolean, attribute: 'can-create-directory' },
    canUpload: { type: Boolean, attribute: 'can-upload' },
    awaitingReview: { type: Boolean, attribute: 'awaiting-review' },
  };

  constructor(){
    super();
    this.kind = '';
    this.viewMode = 'grid';
    this.canTrust = false;
    this.canCreateDirectory = false;
    this.canUpload = false;
    this.awaitingReview = false;
  }

  handleSearch = e => {
    // A request per keystroke is a request per keystroke
    clearTimeout(this._searchTimer);
    const value = e.target.value;
    this._searchTimer = setTimeout(() => {
      this.dispatchEvent(new CustomEvent('search', { detail: { value }, bubbles: true, composed: true }));
    }, 250);
  };

  handleKindChange = e => {
    this.dispatchEvent(new CustomEvent('kind-change', { detail: { value: e.target.value }, bubbles: true, composed: true }));
  };

  handleViewChange = e => {
    this.dispatchEvent(new CustomEvent('view-change', { detail: { value: e.detail.value }, bubbles: true, composed: true }));
  };

  handleUpload = e => {
    this.dispatchEvent(new CustomEvent('upload', { detail: { files: e.target.files }, bubbles: true, composed: true }));
    e.target.value = ''; // so picking the same file twice in a row still fires a change event
  };

  dispatch = name => () => this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));

  render(){
    return html`
      <div class="d-f toolbar">
        <input class="search flex" type="search" placeholder="Search the whole library…" @input=${this.handleSearch} />

        <select class="kind" .value=${this.kind} @change=${this.handleKindChange}>
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="video">Video</option>
          <option value="audio">Audio</option>
          <option value="model3d">3D models</option>
          <option value="archive">Archives</option>
          <option value="document">Documents</option>
          <option value="font">Fonts</option>
          <option value="text">Text &amp; code</option>
          <option value="other">Other</option>
        </select>

        <!-- Icon-only: the two layouts are self-evident, and words here crowd an already-busy toolbar -->
        <k-segmented-control class="views" persistent-id="kempo-files-view-mode" value=${this.viewMode} @change=${this.handleViewChange}>
          <k-sc-option value="grid" title="Grid"><k-icon name="cards"></k-icon></k-sc-option>
          <k-sc-option value="list" title="List"><k-icon name="table"></k-icon></k-sc-option>
        </k-segmented-control>

        ${this.canTrust ? html`
          <button
            class=${this.awaitingReview ? 'primary' : ''}
            title="Show only files nobody has approved yet"
            @click=${this.dispatch('toggle-review')}
          ><k-icon name="warning"></k-icon> Needs review</button>
        ` : ''}
        ${this.canCreateDirectory ? html`
          <button @click=${this.dispatch('new-folder')}><k-icon name="folder"></k-icon> New Folder</button>
        ` : ''}
        ${this.canUpload ? html`
          <label class="btn primary upload">
            <k-icon name="download" direction="up"></k-icon> Upload
            <input type="file" multiple @change=${this.handleUpload} />
          </label>
        ` : ''}
      </div>
    `;
  }

  static styles = css`
    :host { display: block; }
    .toolbar { gap: var(--spacer_h); align-items: center; }
    .toolbar .search { min-width: 12rem; width: auto !important; }
    .toolbar .kind { width: auto !important; }
    /* No utility hides an element outright; this is the file input's own visibility, not layout */
    .upload input { display: none !important; }
  `;
}

customElements.define('k-files-toolbar', Toolbar);
