import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import '/kempo-ui/components/Card.js';
import '/kempo-ui/components/Progress.js';
import { html, css } from '/kempo-ui/lit-all.min.js';

export default class UploadProgress extends ShadowComponent {
  static properties = {
    entries: { type: Array },
  };

  constructor(){
    super();
    this.entries = [];
  }

  render(){
    if(!this.entries.length) return html``;
    return html`
      <k-card class="mb">
        ${this.entries.map(entry => html`
          <div class="d-f row">
            <span class="flex ${entry.failed ? 'tc-danger' : ''}">${entry.name}</span>
            <k-progress
              class="bar"
              color=${entry.failed ? 'var(--c_danger)' : 'var(--c_primary)'}
              percentage=${entry.total ? Math.round(entry.loaded / entry.total * 100) : 0}
              label
              ?indeterminate=${!entry.total && !entry.failed}
            ></k-progress>
          </div>
        `)}
      </k-card>
    `;
  }

  static styles = css`
    :host { display: block; }
    .row { gap: var(--spacer_h); align-items: center; }
    /* k-progress defaults to width:100% (fine as the only content in a normal layout), which would
       otherwise fight the name label for space here — a fixed width alongside flex:0 0 auto keeps
       it a fixed-size sidekick to the name, matching how a native <progress> would have sized. */
    .row .bar { width: 8rem; flex: 0 0 auto; }
  `;
}

customElements.define('k-files-upload-progress', UploadProgress);
