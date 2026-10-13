import DashboardWidget from '/kempo/components/DashboardWidget.js';
import { html } from '/kempo-ui/lit-all.min.js';
import { listFiles, listDirectories } from '/kempo-files/sdk.js';
const formatBytes = bytes => {
  if(bytes === null || bytes === undefined) return '\u2014';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while(value >= 1024 && unit < units.length - 1){
    value /= 1024;
    unit++;
  }
  return `${unit ? value.toFixed(1) : value} ${units[unit]}`;
};
const stat = (value, label, classes = '') => html`<div class="flex"><div class="h2 m0 ${classes}">${value}</div><div class="small tc-muted">${label}</div></div>`;

/*
  File and folder totals. Storage is shown only when the one page fetched holds every file, so it is
  never an under-count.
*/
export default class FilesWidget extends DashboardWidget {
  static properties = {
    ...DashboardWidget.properties,
    total: { state: true },
    folders: { state: true },
    bytes: { state: true }
  };

  constructor(){
    super();
    this.total = 0;
    this.folders = 0;
    this.bytes = null;
    this.cta = { label: 'Upload files', icon: 'upload', href: '/admin/extension/kempo-files/', permission: 'files:upload' };
  }

  /*
    Public Methods
  */

  load = async () => {
    const [files, directories] = await Promise.all([
      this.unwrap(listFiles({ limit: 500 })),
      this.unwrap(listDirectories())
    ]);
    this.total = files.total;
    this.folders = directories.directories.length;
    this.bytes = files.files.length >= files.total ? files.files.reduce((sum, file) => sum + (file.sizeBytes || 0), 0) : null;
  };

  /*
    Rendering
  */

  renderContent(){
    if(!this.total) return html`<p class="tc-muted">No files yet.</p>`;
    return html`<div class="d-f">${stat(this.total, 'Files')}${stat(this.folders, 'Folders')}${stat(formatBytes(this.bytes), 'Storage')}</div>`;
  }
}

customElements.define('k-files-widget', FilesWidget);
