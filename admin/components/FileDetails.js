import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import '/admin/extension/kempo-files/components/VisualCodePreview.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import { urlForFile, apiUrlForFile } from '/kempo-files/sdk.js';
import { formatBytes } from '/admin/extension/kempo-files/utils/formatBytes.js';

/*
  What the details dialog shows for one file: a preview (native for image/video/audio, Preview+Source
  tabs for SVG/HTML, fetched source for plain text) alongside a metadata table. Dispatches `edit-alias`
  rather than editing anything itself — the library owns the API call and the dialog's own lifecycle.
*/
export default class FileDetails extends ShadowComponent {
  static properties = {
    file: { type: Object },
    _text: { state: true },
    _error: { state: true },
  };

  constructor(){
    super();
    this.file = null;
    this._text = null;
    this._error = '';
  }

  connectedCallback(){
    super.connectedCallback();
    if(this.file && this.isPlainText) this.loadText();
  }

  updated(changed){
    super.updated?.(changed);
    if(changed.has('file') && this.file && this.isPlainText) this.loadText();
  }

  get isVisualCode(){ return /\.(svg|html?|xhtml)$/i.test(this.file?.name || ''); }
  get isPlainText(){ return !this.isVisualCode && this.file?.kind === 'text'; }
  get isPdf(){ return /\.pdf$/i.test(this.file?.name || ''); }

  async loadText(){
    this._text = null;
    this._error = '';
    try {
      const response = await fetch(urlForFile(this.file), { credentials: 'same-origin' });
      if(!response.ok) throw new Error(String(response.status));
      this._text = await response.text();
    } catch {
      this._error = 'Could not load this file’s contents.';
    }
  }

  requestEditAlias = () => this.dispatchEvent(new CustomEvent('edit-alias', { bubbles: true, composed: true }));

  renderPreview(){
    const file = this.file;
    const url = urlForFile(file);

    if(this.isVisualCode){
      return html`<k-files-visual-code-preview class="mb" url=${url} kind=${/\.svg$/i.test(file.name) ? 'svg' : 'html'}></k-files-visual-code-preview>`;
    }

    /*
      Server-side, an untrusted PDF is forced to a download attachment rather than served inline
      (resolveDownload.js — a PDF's own viewer can run script, so this is the same trust gate SVG
      gets, just without a client-side sanitizer to fall back on: there is no equivalent of stripping
      a <script> tag out of a PDF). An <iframe> pointed at an untrusted PDF's URL would just trigger
      that download rather than show anything, so this says why instead of rendering a dead frame.
    */
    if(this.isPdf){
      return html`
        <div class="preview-pane bg-alt r ph mb">
          ${file.trusted
            ? html`<iframe src=${url} title=${file.name}></iframe>`
            : html`<p class="tc-muted ta-center m0">${file.reviewable === false
                ? 'PDF preview is not available — this file was stored on a user\'s behalf and is always served as a download.'
                : 'PDF preview is available once this file is approved — served as a download until then.'}</p>`}
        </div>
      `;
    }

    const body = {
      image: html`<img src=${url} alt=${file.altText || file.name} />`,
      video: html`<video src=${url} controls></video>`,
      audio: html`<audio src=${url} controls class="full"></audio>`,
      text: html`<pre class="source full b r ph m0 ta-left bg-default">${this._error || this._text || 'Loading…'}</pre>`,
    }[file.kind];

    return html`
      <div class="preview-pane bg-alt r ph mb">
        ${body || html`<p class="tc-muted ta-center m0">No preview for this kind of file.</p>`}
      </div>
    `;
  }

  render(){
    const file = this.file;
    if(!file) return html``;
    const created = file.createdAt ? new Date(file.createdAt).toLocaleString() : '—';
    const updated = file.updatedAt ? new Date(file.updatedAt).toLocaleString() : '—';

    return html`
      <div class="p">
        ${this.renderPreview()}

        <table class="m0">
          <tbody>
            <tr><th>Name</th><td class="bt">${file.name}</td></tr>
            <tr><th>Path</th><td><code>${file.path || file.name}</code></tr>
            <tr><th>Type</th><td>${file.kind}</td></tr>
            <tr><th>Size</th><td>${formatBytes(file.sizeBytes)}</td></tr>
            <tr><th>Access</th><td>${file.public ? 'Public — anyone can download it' : 'Private — requires permission'}</td></tr>
            <tr><th>Status</th><td>${statusText(file)}</td></tr>
            <tr><th>API</th><td><code>${apiUrlForFile(file)}</code></td></tr>
            <tr>
              <th>Alias</th>
              <td>
                ${file.alias ? html`<code>/${file.alias}</code> ` : html`<span class="tc-muted">None — </span>`}
                ${file.public
                  ? html`<button class="no-btn link" @click=${this.requestEditAlias}>${file.alias ? 'Edit' : 'Set an alias'}</button>`
                  : html`<span class="tc-muted small">(only public files can have one)</span>`}
              </td>
            </tr>
            ${file.altText ? html`<tr><th>Alt text</th><td>${file.altText}</td></tr>` : ''}
            <tr><th>Owner</th><td><code>${file.ownerId}</code></td></tr>
            <tr><th>Uploaded</th><td>${created}</td></tr>
            <tr><th>Updated</th><td>${updated}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  static styles = css`
    :host { display: block; }
    .preview-pane { display: grid; place-items: center; min-height: 8rem; max-height: 55vh; overflow: auto; }
    .preview-pane img, .preview-pane video { max-width: 100%; max-height: 50vh; object-fit: contain; }
    .preview-pane iframe { width: 100%; height: 50vh; border: 1px solid var(--c_border); border-radius: var(--radius); display: block; }
    .source { max-height: 22rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.8125rem; }
    table { width: 100%; }
    th { text-align: left; white-space: nowrap; color: var(--tc_muted); font-weight: normal; width: 1%; vertical-align: top; }
    td { min-width: 0; overflow-wrap: anywhere; vertical-align: top; }
  `;
}

/*
  Three states. "Unreviewed" implies somebody will get to it; for a file stored on a user's behalf
  nobody ever will, and saying so is what stops an admin going looking for the Approve button that
  is deliberately not there.
*/
const statusText = file => {
  if(file.reviewable === false) return 'Not up for review — stored on a user\'s behalf, always served as plain text';
  return file.trusted ? 'Trusted — served as its real type' : 'Unreviewed — served as plain text';
};

customElements.define('k-files-file-details', FileDetails);
