import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import '/kempo-ui/components/Dropzone.js';
import '/kempo-ui/components/Progress.js';
import { uploadFile } from '/kempo-files/sdk.js';

let entryCounter = 0;

/*
  Upload files to this site: a dashed area to drop files on or click to open the file picker (kempo-ui's `<k-dropzone>`), and
  a progress bar for each file while it goes up. Served at /kempo-files/components/FilesUpload.js, so any extension can put it
  on its pages.

    <k-files-upload multiple accept="image/*,video/*" public></k-files-upload>

  Files go to kempo-files, one after another, unless `uploader` is set. It is a function `(file, report) => [error, result]`
  (the tuple every kempo SDK call returns; `report(fraction)` takes 0 to 1) for an extension whose files are more than plain
  files, such as kempo-media, which makes a media asset of each. Everything else about the component stays the same.

  Events (bubbling and composed):
    uploaded       one file is up: detail { file, result } (`result` is what kempo-files, or the uploader, answered)
    uploadfailed   one file was not: detail { file, error } with { code, msg }, also shown under the area
*/
export default class FilesUpload extends ShadowComponent {
  static properties = {
    accept: { type: String },
    multiple: { type: Boolean },
    disabled: { type: Boolean },
    label: { type: String },
    makePublic: { type: Boolean, attribute: 'public' },
    directoryId: { type: String, attribute: 'directory-id' },
    uploader: { attribute: false },
    entries: { state: true }
  };

  constructor(){
    super();
    this.accept = '';
    this.multiple = false;
    this.disabled = false;
    this.label = '';
    this.makePublic = false;
    this.directoryId = '';
    this.uploader = null;
    this.entries = [];
  }

  /*
    Event handlers
  */

  handleFiles = async ({ detail }) => {
    this.entries = this.entries.filter(entry => !entry.error);
    detail.rejected.forEach(file => this.fail({ file, error: { code: 415, msg: 'That kind of file is not accepted here' } }));
    for(const file of detail.files) await this.send(file);
  };

  /*
    Utility functions
  */

  announce = (name, detail) => this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));

  fail = ({ file, error, entry = { id: ++entryCounter, name: file.name } }) => {
    entry.error = error.msg;
    this.entries = this.entries.includes(entry) ? [...this.entries] : [...this.entries, entry];
    this.announce('uploadfailed', { file, error });
  };

  send = async file => {
    const entry = { id: ++entryCounter, name: file.name, fraction: 0, error: '' };
    this.entries = [...this.entries, entry];
    const report = fraction => {
      entry.fraction = fraction;
      this.requestUpdate();
    };

    const [error, result] = this.uploader
      ? await this.uploader(file, report)
      : await uploadFile(file, { directoryId: this.directoryId || undefined, public: this.makePublic, onProgress: (loaded, total) => report(loaded / total) });

    if(error){
      this.fail({ file, error, entry });
      return;
    }
    this.entries = this.entries.filter(other => other !== entry);
    this.announce('uploaded', { file, result });
  };

  /*
    Rendering
  */

  render(){
    return html`
      <k-dropzone .accept=${this.accept} ?multiple=${this.multiple} ?disabled=${this.disabled} .label=${this.label} @files=${this.handleFiles}></k-dropzone>
      ${this.entries.map(entry => html`
        <div class="entry">
          <span class="name ${entry.error ? 'tc-danger' : ''}">${entry.name}</span>
          ${entry.error
            ? html`<span class="tc-danger">${entry.error}</span>`
            : html`<k-progress color="var(--c_primary)" percentage=${Math.round(entry.fraction * 100)} label></k-progress>`}
        </div>
      `)}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .entry {
      display: flex;
      align-items: center;
      gap: var(--spacer_h);
      margin-top: var(--spacer_h);
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    k-progress {
      flex: 0 0 10rem;
      width: 10rem;
    }
  `;
}

customElements.define('k-files-upload', FilesUpload);
