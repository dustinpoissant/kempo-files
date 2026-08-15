import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import '/kempo-ui/components/Tabs.js';
import '/kempo-ui/components/Icon.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import { sanitizeSvgMarkup as sanitizeSvg, sanitizeHtmlMarkup as sanitizeHtml } from '/admin/extension/kempo-files/utils/sanitizeMarkup.js';

/*
  Preview + Source tabs for content that can both render *and* carry a <script> — SVG and HTML.
  Approving one means seeing both what it does and what it says, rather than taking a sanitizer's
  word for it: Source is always the untouched fetch, the same thing an unreviewed file's own URL
  already shows; Preview is sanitized and rendered through a mechanism that stays inert regardless
  of what the sanitizer missed.
*/
export default class VisualCodePreview extends ShadowComponent {
  static properties = {
    url: { type: String },
    kind: { type: String }, // 'svg' | 'html'
    _text: { state: true },
    _error: { state: true },
    _previewUrl: { state: true },
    _htmlMarkup: { state: true },
    _stripped: { state: true },
    _previewError: { state: true },
  };

  constructor(){
    super();
    this.url = '';
    this.kind = 'svg';
    this._text = null;
    this._error = '';
    this._previewUrl = '';
    this._htmlMarkup = '';
    this._stripped = false;
    this._previewError = '';
  }

  connectedCallback(){
    super.connectedCallback();
    if(this.url) this.load();
  }

  updated(changed){
    super.updated?.(changed);
    if(changed.has('url') && this.url) this.load();
  }

  disconnectedCallback(){
    super.disconnectedCallback();
    this.revokeObjectUrl();
  }

  revokeObjectUrl(){
    if(this._previewUrl) URL.revokeObjectURL(this._previewUrl);
    this._previewUrl = '';
  }

  async load(){
    this._text = null;
    this._error = '';
    this._previewError = '';
    this.revokeObjectUrl();

    try {
      const response = await fetch(this.url, { credentials: 'same-origin' });
      if(!response.ok) throw new Error(String(response.status));
      this._text = await response.text();
    } catch {
      this._error = 'Could not load this file’s contents.';
      return;
    }

    if(this.kind === 'svg'){
      const result = sanitizeSvg(this._text);
      if(!result){
        this._previewError = 'This does not parse as SVG, so no preview is shown — see the Source tab.';
        return;
      }
      this._stripped = result.stripped;
      this._previewUrl = URL.createObjectURL(new Blob([result.markup], { type: 'image/svg+xml' }));
    } else {
      const result = sanitizeHtml(this._text);
      this._stripped = result.stripped;
      this._htmlMarkup = result.markup;
    }
  }

  renderPreview(){
    if(this._error) return html`<p class="tc-muted ta-center m0">${this._error}</p>`;
    if(this._text === null) return html`<p class="tc-muted ta-center m0">Loading…</p>`;
    if(this._previewError) return html`<p class="tc-muted ta-center m0">${this._previewError}</p>`;

    return this.kind === 'svg'
      ? html`<img src=${this._previewUrl} alt="Sanitized preview — scripts and event handlers removed" @error=${() => { this._previewError = 'Could not render a preview.'; }} />`
      : html`<iframe sandbox="" title="Sanitized preview — scripts and embedded frames removed" .srcdoc=${this._htmlMarkup}></iframe>`;
  }

  render(){
    return html`
      <k-tabs active="preview">
        <k-tab for="preview">Preview</k-tab>
        <k-tab for="source">Source</k-tab>
        <k-tab-content name="preview">
          <div class="render bg-alt r ph">${this.renderPreview()}</div>
          ${this._stripped ? html`
            <p class="notice tc-warning small mt mb0">
              <k-icon name="warning"></k-icon>
              Something potentially dangerous (a script, an embedded frame, or an event handler) was found and removed before rendering this preview. See the Source tab for the original.
            </p>
          ` : ''}
        </k-tab-content>
        <k-tab-content name="source">
          <pre class="source full b r ph m0 ta-left bg-default">${this._error || this._text || 'Loading…'}</pre>
        </k-tab-content>
      </k-tabs>
    `;
  }

  static styles = css`
    :host { display: block; }
    .render { display: grid; place-items: center; min-height: 8rem; max-height: 50vh; overflow: auto; }
    .render img { max-width: 100%; max-height: 46vh; object-fit: contain; }
    .render iframe { width: 100%; height: 40vh; border: 1px solid var(--c_border); border-radius: var(--radius); }
    .source { max-height: 22rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.8125rem; }
  `;
}

customElements.define('k-files-visual-code-preview', VisualCodePreview);
