import ShadowComponent from '/kempo-ui/components/ShadowComponent.js';
import '/kempo-ui/components/Icon.js';
import '/kempo-ui/components/Card.js';
import '/kempo-ui/components/Table.js';
import '/kempo-ui/components/CardGrid.js';
import '/kempo-ui/components/controls/Menu.js';
import '/admin/extension/kempo-files/components/Thumb.js';
import '/admin/extension/kempo-files/components/EntryMenu.js';
import '/admin/extension/kempo-files/components/Toolbar.js';
import '/admin/extension/kempo-files/components/Breadcrumb.js';
import '/admin/extension/kempo-files/components/UploadProgress.js';
import '/admin/extension/kempo-files/components/FileDetails.js';
import '/admin/extension/kempo-files/components/table-controls/TcSelectionCount.js';
import '/admin/extension/kempo-files/components/table-controls/TcMoveSelected.js';
import '/admin/extension/kempo-files/components/table-controls/TcMakePublicSelected.js';
import '/admin/extension/kempo-files/components/table-controls/TcMakePrivateSelected.js';
import '/admin/extension/kempo-files/components/table-controls/TcApproveSelected.js';
import '/admin/extension/kempo-files/components/table-controls/TcRejectSelected.js';
import '/admin/extension/kempo-files/components/table-controls/TcDeleteSelected.js';
import '/admin/extension/kempo-files/components/table-controls/TcToggleFilePublic.js';
import '/admin/extension/kempo-files/components/table-controls/TcToggleFileTrusted.js';
import '/admin/extension/kempo-files/components/table-controls/TcRenameEntry.js';
import '/admin/extension/kempo-files/components/table-controls/TcMoveEntry.js';
import '/admin/extension/kempo-files/components/table-controls/TcDeleteEntry.js';
import { html, css } from '/kempo-ui/lit-all.min.js';
import Toast from '/kempo-ui/components/Toast.js';
import Dialog from '/kempo-ui/components/Dialog.js';
import { promptForValue, promptForChoice } from '/admin/extension/kempo-files/utils/promptDialogs.js';
import { kindIcon } from '/admin/extension/kempo-files/utils/kindIcon.js';
import {
  listFiles,
  listDirectories,
  createDirectory,
  updateDirectory,
  deleteDirectory,
  uploadFile,
  updateFile,
  deleteFile,
  urlForFile,
  apiUrlForFile,
} from '/kempo-files/sdk.js';

/*
  The file library, used both as the admin screen and as the picker the editor opens.

  This is the orchestrator: state, data loading, drag-drop, and the grid/list layouts themselves.
  Everything reusable — the thumbnail, the action menu, the toolbar, the breadcrumb, the upload
  queue, and the details dialog's contents — is a sibling component (k-files-*), each owning its own
  rendering and, where it has one, its own bit of state (a thumbnail's broken-image fallback, a
  preview's fetch). This one wires them together and owns the actual API calls.

  Data is fetched and paged server-side, so both views show the same page of the same query. k-table
  is used as a renderer only — its own paging stays off — because otherwise switching views would
  silently change which records you were looking at.
*/

const PAGE_SIZE = 24;

export default class FileLibrary extends ShadowComponent {
  static properties = {
    kind: { type: String },
    selectable: { type: Boolean },
    canUpload: { type: Boolean, attribute: 'can-upload' },
    canTrust: { type: Boolean, attribute: 'can-trust' },
    canCreateDirectory: { type: Boolean, attribute: 'can-create-directory' },
    files: { type: Array, state: true },
    directories: { type: Array, state: true },
    directoryId: { type: String, state: true },
    total: { type: Number, state: true },
    offset: { type: Number, state: true },
    search: { type: String, state: true },
    awaitingReview: { type: Boolean, state: true },
    viewMode: { type: String, state: true },
    loading: { type: Boolean, state: true },
    dragging: { type: Boolean, state: true },
    uploading: { type: Array, state: true },
    selectedId: { type: String, state: true },
  };

  constructor() {
    super();
    this.kind = '';
    this.selectable = false;
    this.canUpload = false;
    this.canTrust = false;
    this.canCreateDirectory = false;
    this.files = [];
    this.directories = [];
    this.directoryId = '';
    this.total = 0;
    this.offset = 0;
    this.search = '';
    this.awaitingReview = false;
    this.viewMode = 'grid';
    this.loading = true;
    this.dragging = false;
    this.uploading = [];
    this.selectedId = '';
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadDirectories();
    this.load();
  }

  loadDirectories = async () => {
    const [error, data] = await listDirectories({ all: true });
    if(error) return Toast.error(`Could not load folders: ${error.msg}`);
    this.directories = data.directories;
  };

  load = async () => {
    this.loading = true;
    const [error, data] = await listFiles({
      // Searching looks through the whole library — when hunting by name you rarely know the folder
      directoryId: this.search ? undefined : (this.directoryId || 'root'),
      kind: this.kind || undefined,
      search: this.search || undefined,
      awaitingReview: this.awaitingReview || undefined,
      limit: PAGE_SIZE,
      offset: this.offset,
    });
    this.loading = false;
    if(error) return Toast.error(`Could not load files: ${error.msg}`);
    this.files = data.files;
    this.total = data.total;
  };

  refresh = async () => {
    await Promise.all([this.loadDirectories(), this.load()]);
  };

  get currentDirectories() {
    if(this.search) return [];
    const parent = this.directoryId || null;
    return this.directories.filter(directory => (directory.parentId || null) === parent);
  }

  /*
    Root-first ancestry of the folder being viewed, from the flat list already in memory. The
    visited set guards against a cycle in the data turning navigation into a hang.
  */
  get breadcrumb() {
    const trail = [];
    const visited = new Set();
    let cursor = this.directoryId;
    while(cursor && !visited.has(cursor)){
      visited.add(cursor);
      const directory = this.directories.find(candidate => candidate.id === cursor);
      if(!directory) break;
      trail.unshift(directory);
      cursor = directory.parentId;
    }
    return trail;
  }

  get selectedFile() {
    return this.files.find(file => file.id === this.selectedId) || null;
  }

  openDirectory = id => {
    this.directoryId = id || '';
    this.offset = 0;
    this.selectedId = '';
    this.load();
  };

  /*
    Shared shape behind every bulk field-edit: same [error,data] tuple, same success/failure
    tallying — only the ids, changes and wording differ. pastTense reads naturally both as
    "File <pastTense>" and "could not be <pastTense>" ('approved', 'moved', 'made public'…).

    ids arrives via event detail — every k-files-tc-* control dispatches { detail: { ids } } after
    reading its host's own live selection (k-table in list view, k-card-grid in grid view), so this
    one method works identically regardless of which view fired it.
  */
  bulkUpdate = async (ids, changes, pastTense) => {
    if(!ids.length) return;

    const results = await Promise.all(ids.map(id => updateFile({ id, ...changes })));
    const failed = results.filter(([error]) => error).length;
    const succeeded = ids.length - failed;

    if(succeeded) Toast.success(succeeded === 1 ? `File ${pastTense}` : `${succeeded} files ${pastTense}`);
    if(failed) Toast.error(`${failed} file${failed === 1 ? '' : 's'} could not be ${pastTense}`);

    this.load();
  };

  approveBulkSelected = e => this.bulkUpdate(e.detail.ids, { trusted: true }, 'approved');
  rejectBulkSelected = e => this.bulkUpdate(e.detail.ids, { trusted: false }, 'rejected');
  makePublicBulkSelected = e => this.bulkUpdate(e.detail.ids, { public: true }, 'made public');
  makePrivateBulkSelected = e => this.bulkUpdate(e.detail.ids, { public: false }, 'made private');

  /*
    Folders can be selected right alongside files (the grid/table selection checkbox has no per-row
    opt-out), so this splits the selection by _type and calls each type's own API — updateFile takes
    directoryId, updateDirectory takes parentId, and a non-empty folder is refused server-side rather
    than emptied, which surfaces here as just another per-item failure in the same tally.
  */
  moveBulkSelected = async e => {
    const records = e.detail.records;
    if(!records.length) return;

    const fileRecords = records.filter(record => record._type === 'file');
    const directoryRecords = records.filter(record => record._type === 'directory');
    const directoryIds = new Set(directoryRecords.map(record => record.id));

    const options = [
      { value: 'root', label: '/ (top level)' },
      ...this.directories.filter(directory => !directoryIds.has(directory.id)).map(directory => ({ value: directory.id, label: this.pathOf(directory) })),
    ];
    const count = records.length;
    const destination = await promptForChoice(`Move ${count} item${count === 1 ? '' : 's'}`, options);
    if(!destination) return;
    const directoryId = destination === 'root' ? null : destination;

    const [fileResults, directoryResults] = await Promise.all([
      Promise.all(fileRecords.map(file => updateFile({ id: file.id, directoryId }))),
      Promise.all(directoryRecords.map(directory => updateDirectory({ id: directory.id, parentId: directoryId }))),
    ]);
    const results = [...fileResults, ...directoryResults];
    const failed = results.filter(([error]) => error).length;
    const succeeded = results.length - failed;

    if(succeeded) Toast.success(succeeded === 1 ? 'Moved' : `${succeeded} items moved`);
    if(failed) Toast.error(`${failed} item${failed === 1 ? '' : 's'} could not be moved`);

    this.refresh();
  };

  deleteBulkSelected = e => {
    const records = e.detail.records;
    if(!records.length) return;

    const fileRecords = records.filter(record => record._type === 'file');
    const directoryRecords = records.filter(record => record._type === 'directory');
    const count = records.length;

    Dialog.confirm(
      `Delete ${count} item${count === 1 ? '' : 's'}? Anything already linking to a file will break, and non-empty folders will be skipped.`,
      async confirmed => {
        if(!confirmed) return;
        const [fileResults, directoryResults] = await Promise.all([
          Promise.all(fileRecords.map(file => deleteFile(file.id))),
          Promise.all(directoryRecords.map(directory => deleteDirectory(directory.id))),
        ]);
        const results = [...fileResults, ...directoryResults];
        const failed = results.filter(([error]) => error).length;
        const succeeded = results.length - failed;
        if(succeeded) Toast.success(succeeded === 1 ? 'Deleted' : `${succeeded} items deleted`);
        if(failed) Toast.error(`${failed} item${failed === 1 ? '' : 's'} could not be deleted`);
        this.refresh();
      },
      { title: 'Delete items', confirmText: 'Delete' }
    );
  };

  /*
    Uploads run one at a time. Request bodies are buffered in memory server-side, so firing ten
    large files at once is the surest way to exhaust it.
  */
  uploadFiles = async fileList => {
    const queue = [...fileList];
    if(!queue.length) return;

    this.uploading = queue.map(file => ({ name: file.name, failed: false, loaded: 0, total: file.size }));

    for(const [index, file] of queue.entries()){
      const [error] = await uploadFile(file, {
        directoryId: this.directoryId || undefined,
        onProgress: (loaded, total) => {
          this.uploading = this.uploading.map((entry, i) => i === index ? { ...entry, loaded, total } : entry);
        },
      });
      if(error){
        this.uploading = this.uploading.map((entry, i) => i === index ? { ...entry, failed: true } : entry);
        Toast.error(`${file.name}: ${error.msg}`);
      }
    }

    const failed = this.uploading.filter(entry => entry.failed).length;
    const succeeded = queue.length - failed;
    if(succeeded) Toast.success(succeeded === 1 ? 'Uploaded' : `Uploaded ${succeeded} files`);

    this.uploading = [];
    this.offset = 0;
    await this.load();
  };

  handleDrop = e => {
    e.preventDefault();
    this.dragging = false;
    if(this.canUpload) this.uploadFiles(e.dataTransfer.files);
  };

  newDirectory = async () => {
    const name = await promptForValue('New folder', { placeholder: 'Folder name', confirmText: 'Create' });
    if(!name) return;
    const [error] = await createDirectory(name, this.directoryId || null);
    if(error) return Toast.error(error.msg);
    Toast.success('Folder created');
    this.loadDirectories();
  };

  renameDirectory = async directory => {
    const name = await promptForValue(`Rename “${directory.name}”`, { value: directory.name, confirmText: 'Rename' });
    if(!name || name === directory.name) return;
    const [error] = await updateDirectory({ id: directory.id, name });
    if(error) return Toast.error(error.msg);
    Toast.success('Renamed');
    this.refresh();
  };

  moveDirectory = async directory => {
    const options = [
      { value: 'root', label: '/ (top level)' },
      ...this.directories.filter(candidate => candidate.id !== directory.id).map(candidate => ({ value: candidate.id, label: this.pathOf(candidate) })),
    ];
    const destination = await promptForChoice(`Move “${directory.name}”`, options);
    if(!destination) return;
    // Moving into one of its own descendants is refused server-side (updateDirectory walks the chain).
    const [error] = await updateDirectory({ id: directory.id, parentId: destination === 'root' ? null : destination });
    if(error) return Toast.error(error.msg);
    Toast.success('Moved');
    this.refresh();
  };

  removeDirectory = directory => {
    Dialog.confirm(`Delete the folder “${directory.name}”?`, async confirmed => {
      if(!confirmed) return;
      const [error] = await deleteDirectory(directory.id);
      // A non-empty folder is refused server-side rather than emptied.
      if(error) return Toast.error(error.msg);
      Toast.success('Folder deleted');
      this.refresh();
    }, { title: 'Delete folder', confirmText: 'Delete' });
  };

  renameFile = async file => {
    const name = await promptForValue(`Rename “${file.name}”`, { value: file.name, confirmText: 'Rename' });
    if(!name || name === file.name) return;
    const [error] = await updateFile({ id: file.id, name });
    if(error) return Toast.error(error.msg);
    Toast.success('Renamed');
    this.load();
  };

  moveFile = async file => {
    const options = [
      { value: 'root', label: '/ (top level)' },
      ...this.directories.map(directory => ({ value: directory.id, label: this.pathOf(directory) })),
    ];
    const destination = await promptForChoice(`Move “${file.name}”`, options);
    if(!destination) return;
    const [error] = await updateFile({ id: file.id, directoryId: destination === 'root' ? null : destination });
    if(error) return Toast.error(error.msg);
    Toast.success('Moved');
    this.load();
  };

  /*
    The per-card rename/move/delete controls (k-files-tc-rename-entry/move-entry/delete-entry) work
    identically on a file or a folder, so they dispatch one generic event each with whichever record
    was clicked — these three just route to the file or directory version of the action based on
    record._type, reusing the exact same methods the folder's own entry menu and the file's details
    dialog already call.
  */
  renameEntry = record => record._type === 'directory' ? this.renameDirectory(record) : this.renameFile(record);
  moveEntry = record => record._type === 'directory' ? this.moveDirectory(record) : this.moveFile(record);
  deleteEntry = record => record._type === 'directory' ? this.removeDirectory(record) : this.removeFile(record);

  pathOf = directory => {
    const trail = [];
    const visited = new Set();
    let cursor = directory.id;
    while(cursor && !visited.has(cursor)){
      visited.add(cursor);
      const found = this.directories.find(candidate => candidate.id === cursor);
      if(!found) break;
      trail.unshift(found.name);
      cursor = found.parentId;
    }
    return `/${trail.join('/')}`;
  };

  togglePublic = async file => {
    const [error, data] = await updateFile({ id: file.id, public: !file.public });
    if(error) return Toast.error(error.msg);
    // Going private takes the alias with it server-side, so say so rather than let a link go stale.
    if(file.public && file.alias) Toast.info('Made private — its alias was removed');
    else Toast.success(data.file.public ? 'Anyone can now download this' : 'Made private');
    this.load();
  };

  toggleTrusted = async file => {
    const [error, data] = await updateFile({ id: file.id, trusted: !file.trusted });
    if(error) return Toast.error(error.msg);
    Toast.success(data.file.trusted ? 'Approved — this file can now run in the browser' : 'Approval withdrawn');
    this.load();
  };

  editAlias = async file => {
    if(!file.public) return Toast.error('Only public files can have an alias');

    const alias = await promptForValue(`Alias for “${file.name}”`, {
      value: file.alias || '',
      placeholder: 'scripts/analytics.js',
      help: 'The file is also served at this path, so it can be referenced like an ordinary file. Leave empty to remove.',
    });
    // null is "cancelled"; an empty string is "clear the alias", which is a real choice
    if(alias === null) return;

    const [error] = await updateFile({ id: file.id, alias: alias || null });
    if(error) return Toast.error(error.msg);
    Toast.success(alias ? 'Alias set' : 'Alias removed');
    this.load();
  };

  removeFile = file => {
    Dialog.confirm(
      `Delete “${file.name}”? Anything already linking to it will break.`,
      async confirmed => {
        if(!confirmed) return;
        const [error] = await deleteFile(file.id);
        if(error) return Toast.error(error.msg);
        Toast.success('Deleted');
        if(this.files.length === 1 && this.offset > 0) this.offset -= PAGE_SIZE;
        this.load();
      },
      { title: 'Delete file', confirmText: 'Delete' }
    );
  };

  /*
    In the picker a click selects; in the admin it opens the file's details instead.
  */
  handleActivate = file => {
    if(!this.selectable) return this.openDetails(file);
    this.selectedId = file.id;
    this.dispatchEvent(new CustomEvent('file-selected', { detail: { file }, bubbles: true, composed: true }));
  };

  /*
    The one listener for every k-files-entry-menu — list view only now (see EntryMenu.js). It only
    knows which button was clicked — what each action actually does lives here, same as before the
    menu was its own component.
  */
  handleEntryAction = e => {
    const { action, kind, entry } = e.detail;
    if(kind === 'directory'){
      if(action === 'rename') this.renameDirectory(entry);
      if(action === 'move') this.moveDirectory(entry);
      if(action === 'delete') this.removeDirectory(entry);
      return;
    }
    switch(action){
      case 'details': this.openDetails(entry); break;
      case 'open': window.open(urlForFile(entry), '_blank', 'noopener'); break;
      case 'rename': this.renameFile(entry); break;
      case 'move': this.moveFile(entry); break;
      case 'public': this.togglePublic(entry); break;
      case 'alias': this.editAlias(entry); break;
      case 'trust': this.toggleTrusted(entry); break;
      case 'delete': this.removeFile(entry); break;
    }
  };

  /*
    What clicking a file does. Previously nothing outside the picker, which made every tile look
    interactive and do nothing. k-files-file-details owns the preview and metadata table; this only
    owns the dialog's lifecycle and what "edit the alias" (or "approve") actually does.
  */
  openDetails(file) {
    // Reviewing is the point of opening details on something unapproved — put the action right there.
    const canApprove = this.canTrust && !file.trusted;

    let $dialog;
    $dialog = Dialog.create(
      html`<k-files-file-details .file=${file} @edit-alias=${() => { $dialog?.close?.(); this.editAlias(file); }}></k-files-file-details>`,
      {
        title: file.name,
        cancelText: 'Close',
        width: 'min(46rem, 92vw)',
        ...(canApprove ? { confirmText: 'Approve', confirmAction: () => this.toggleTrusted(file) } : {}),
      }
    );
  }

  /*
    List-view-only now — grid tiles dropped their own worded chip once the toggle-public/
    toggle-trusted controls started coloring their icon by current state, which already says the
    same thing without a separate badge fighting the thumbnail for space.
  */
  statusIcon(file) {
    return file.trusted
      ? html`<k-icon name="star_filled" class="tc-success" title="Trusted — approved to run in the browser"></k-icon>`
      : html`<k-icon name="warning" class="tc-danger" title="Unreviewed — served as plain text until approved"></k-icon>`;
  }

  accessIcon(file) {
    return file.public
      ? html`<k-icon name="show" class="tc-success" title=${file.alias ? `Public — also served at /${file.alias}` : 'Public — anyone can download this'}></k-icon>`
      : html`<k-icon name="hide" class="tc-danger" title="Private — requires permission to download"></k-icon>`;
  }

  /*
    The bulk-action controls, genuine k-files-tc-* elements living in slot="top" of whichever host is
    currently mounted — k-table in list view, k-card-grid in grid view — the same mechanism kempo
    core's own admin screens use for kc-tc-delete-selected. Each one discovers its host via
    closest('[controlled]') (Control's own mechanism, inherited through TableControl/ButtonControl)
    and reads that host's live selection directly; neither host nor control cares which one the other
    is, since k-card-grid implements the same getSelectedRecords()/deselectAllOnPage()/selectionChange
    contract k-table does. Always mounted once permission allows it; each control disables itself
    independently while nothing's selected rather than the whole strip disappearing, matching
    kc-tc-delete-selected's own always-there-but-disabled behavior.
  */
  /*
    No dedicated "Clear" control — unchecking "Select all" already clears the selection (one click
    when everything on the page is checked, which is the only state a bulk action bar is visible
    in), and the button was one more thing shifting layout as the count went from one digit to two.
  */
  renderSelectionControls(){
    return html`
      <k-files-tc-selection-count slot="top"></k-files-tc-selection-count>
      <div slot="top" style="flex:1 1 auto"></div>
      <k-files-tc-move-selected slot="top" @move=${this.moveBulkSelected}></k-files-tc-move-selected>
      <k-files-tc-make-public-selected slot="top" @make-public=${this.makePublicBulkSelected}></k-files-tc-make-public-selected>
      <k-files-tc-make-private-selected slot="top" @make-private=${this.makePrivateBulkSelected}></k-files-tc-make-private-selected>
      ${this.canTrust ? html`
        <k-files-tc-approve-selected slot="top" @approve=${this.approveBulkSelected}></k-files-tc-approve-selected>
        <k-files-tc-reject-selected slot="top" @reject=${this.rejectBulkSelected}></k-files-tc-reject-selected>
      ` : ''}
      <k-files-tc-delete-selected slot="top" @delete=${this.deleteBulkSelected}></k-files-tc-delete-selected>
    `;
  }

  /*
    Per-card controls — registered once as slot="after" children of <k-card-grid>, which clones each
    of them (tag + attributes only, plus innerHTML for anything nested) into every tile's own bottom
    strip. Rename/Move/Delete apply to a folder the same as a file, so kc-menu (kempo-ui's own real
    dropdown-menu control, `k-dropdown` under the hood) and its three items are unconditional here —
    they show on every tile. The public/trust toggles are the file-only part (colored, so the icon
    doubles as the state indicator — no separate badge needed); CardControlMixin hides those two on a
    directory. The plain spacer div between them and the menu is always wanted now (the menu never
    hides), so it doesn't need any opt-out logic of its own.

    Each menu item — k-files-tc-rename-entry/move-entry/delete-entry — is a genuine ButtonControl,
    slotted into kc-menu the same way kempo-ui's own HtmlEditor slots kc-format-block into its own
    kc-menu (see docs/components/html-editor). It resolves its own record via CardRecordMixin
    (walk up to the tile's data-index) exactly like the toggles do, and dispatches a bubbling
    rename-entry/move-entry/delete-entry event with that record — FileLibrary decides whether that
    means the file or directory version of the action. No @event binding needed on the menu items
    themselves: kc-menu's own <k-dropdown> requires no external listener to open/close/focus real
    control children (fixed in kempo-ui's Dropdown.js — it used to only recognize <a>/<button> as
    interactive, which is what previously forced hand-rolling a menu with plain data-value buttons
    instead of real controls here).
  */
  renderCardControls(){
    return html`
      <k-files-tc-toggle-public slot="after"></k-files-tc-toggle-public>
      ${this.canTrust ? html`<k-files-tc-toggle-trusted slot="after"></k-files-tc-toggle-trusted>` : ''}
      <div slot="after" style="flex:1 1 auto"></div>
      <kc-menu slot="after">
        <k-icon slot="icon" name="more_vert"></k-icon>
        <k-files-tc-rename-entry></k-files-tc-rename-entry>
        <k-files-tc-move-entry></k-files-tc-move-entry>
        <k-files-tc-delete-entry class="tc-danger"></k-files-tc-delete-entry>
      </kc-menu>
    `;
  }

  /*
    Grid view's cardTemplate — k-card-grid calls this once per record and renders the result inside
    its own <k-card>, alongside the selection checkbox it owns itself. Because the actual DOM lands in
    k-card-grid's shadow root (not this component's), everything here is either a kempo-css utility
    class (linked into every shadow root) or an inline style — this component's own scoped CSS cannot
    reach, same constraint the list view's field calculators already work under (see kindIcon.js).
    The "currently chosen" picker-mode highlight lives on this inner wrapper for the same reason: this
    component can't add a class to the outer <k-card> k-card-grid itself created.
  */
  renderTile = record => {
    if(record._type === 'directory'){
      return html`
        <div class="tile-body" style="cursor:pointer;" @click=${() => this.openDirectory(record.id)}>
          <div class="bg-alt" style="position:relative; aspect-ratio:4/3; display:grid; place-items:center; overflow:hidden;">
            ${kindIcon('folder', { tile: true })}
          </div>
          <div class="pyq pxh" style="display:flex; align-items:center; gap:var(--spacer_q); flex-wrap:nowrap;">
            <span class="flex" title=${record.name} style="min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.875rem;">${record.name}</span>
          </div>
        </div>
      `;
    }
    return html`
      <div
        class="tile-body"
        style=${`cursor:pointer;${this.selectedId === record.id ? ' outline:2px solid var(--c_primary);' : ''}`}
        @click=${() => this.handleActivate(record)}
        @dblclick=${() => { if(this.selectable) this.dispatchEvent(new CustomEvent('file-confirmed', { detail: { file: record }, bubbles: true, composed: true })); }}
      >
        <div class="bg-alt" style="position:relative; aspect-ratio:4/3; display:grid; place-items:center; overflow:hidden;">
          <k-files-thumb .file=${record}></k-files-thumb>
        </div>
        <div class="pyq pxh" style="display:flex; align-items:center; gap:var(--spacer_q); flex-wrap:nowrap;">
          <span class="flex" title=${record.path || record.name} style="min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.875rem;">${record.name}</span>
        </div>
        ${record.alias ? html`
          <div class="pt0 pxh pbq" style="display:flex; gap:var(--spacer_q); align-items:center; flex-wrap:wrap;">
            <code class="small">/${record.alias}</code>
          </div>
        ` : ''}
      </div>
    `;
  };

  /*
    Pushes records into whichever host is currently mounted — k-table in list view, k-card-grid in
    grid view. Both hosts reset every record's own selected flag on every setData() call regardless,
    which is exactly what's wanted after a bulk action reloads the page or the folder/filter/page
    changes; neither host's selection is ever mirrored into this component's own state.

    updated() runs after every render, and setData makes the host render, which lands back here.
    Feeding it unconditionally is an endless loop that pins the CPU — the signature includes viewMode
    specifically because switching views swaps in a brand-new host element (different tag names can't
    be reused across a Lit re-render) with empty records, so returning to a view must always repopulate
    even when the underlying directories/files haven't changed since last time.

    The same "brand-new host with empty records" hazard also happens mid-loading: the loading branch
    above renders neither <k-table> nor <k-card-grid>, so a refresh() spanning two independent fetches
    (loadDirectories + load, which can settle in either order) can land a render here where the
    signature has already changed but $table/$grid is momentarily null. _recordsSignature is only
    committed once a host is actually found and fed — recording it earlier would mark this signature
    "already pushed" when it never reached any host, permanently starving the next (freshly recreated,
    empty) host of the update it needs once loading finishes.
  */
  updated(changed) {
    super.updated?.(changed);

    const directories = this.currentDirectories.map(directory => ({ ...directory, _type: 'directory' }));
    const files = this.files.map(file => ({ ...file, _type: 'file' }));

    const signature = JSON.stringify([
      this.viewMode,
      directories.map(directory => directory.id),
      files.map(file => [file.id, file.name, file.public, file.trusted, file.alias, file.directoryId]),
    ]);
    if(signature === this._recordsSignature) return;

    const records = [...directories, ...files];

    if(this.viewMode === 'list'){
      const $table = this.shadowRoot.querySelector('k-table');
      if(!$table) return;
      this._recordsSignature = signature;
      $table.setData({
        records,
        fields: [
          {
            name: 'icon', label: '', size: 36,
            calculator: record => record._type === 'directory'
              ? kindIcon('folder', { row: true })
              : html`<k-files-thumb .file=${record} row></k-files-thumb>`,
          },
          {
            name: 'name', label: 'Name', size: 320,
            calculator: record => record._type === 'directory'
              ? html`<button class="no-btn link" @click=${() => this.openDirectory(record.id)}>${record.name}</button>`
              : html`<button class="no-btn link" title=${record.path || record.name} @click=${() => this.handleActivate(record)}>${record.name}</button>`,
          },
          { name: 'kind', label: 'Type', size: 100, calculator: record => record._type === 'directory' ? 'Folder' : record.kind },
          {
            name: 'status', label: 'Status', size: 70,
            calculator: record => record._type === 'directory' ? '' : this.statusIcon(record),
          },
          {
            name: 'access', label: 'Access', size: 70,
            calculator: record => record._type === 'directory' ? '' : this.accessIcon(record),
          },
          {
            name: 'alias', label: 'Alias', size: 200,
            calculator: record => record.alias ? html`<code class="small">/${record.alias}</code>` : '',
          },
          {
            name: 'actions', label: 'Actions', size: 70,
            calculator: record => record._type === 'directory'
              ? html`<k-files-entry-menu kind="directory" .entry=${record} @action=${this.handleEntryAction}></k-files-entry-menu>`
              : html`<k-files-entry-menu kind="file" .entry=${record} ?can-trust=${this.canTrust} @action=${this.handleEntryAction}></k-files-entry-menu>`,
          },
        ],
      });
    } else {
      const $grid = this.shadowRoot.querySelector('k-card-grid');
      if(!$grid) return;
      this._recordsSignature = signature;
      $grid.setData({ records, cardTemplate: this.renderTile });
    }
  }

  render() {
    const page = Math.floor(this.offset / PAGE_SIZE) + 1;
    const pages = Math.max(1, Math.ceil(this.total / PAGE_SIZE));
    const directories = this.currentDirectories;
    const isEmpty = !directories.length && !this.files.length;

    return html`
      <div
        class="library ${this.dragging ? 'dragging' : ''}"
        @dragover=${e => { e.preventDefault(); if(this.canUpload) this.dragging = true; }}
        @dragleave=${() => this.dragging = false}
        @drop=${this.handleDrop}
      >
        <k-files-toolbar
          class="mbh"
          kind=${this.kind}
          view-mode=${this.viewMode}
          ?can-trust=${this.canTrust}
          ?can-create-directory=${this.canCreateDirectory}
          ?can-upload=${this.canUpload}
          ?awaiting-review=${this.awaitingReview}
          @search=${e => { this.search = e.detail.value; this.offset = 0; this.load(); }}
          @kind-change=${e => { this.kind = e.detail.value; this.offset = 0; this.load(); }}
          @view-change=${e => this.viewMode = e.detail.value}
          @toggle-review=${() => { this.awaitingReview = !this.awaitingReview; this.offset = 0; this.load(); }}
          @new-folder=${this.newDirectory}
          @upload=${e => this.uploadFiles(e.detail.files)}
        ></k-files-toolbar>

        ${this.search ? '' : html`
          <k-files-breadcrumb .trail=${this.breadcrumb} @navigate=${e => this.openDirectory(e.detail.id)}></k-files-breadcrumb>
        `}

        <k-files-upload-progress .entries=${this.uploading}></k-files-upload-progress>

        ${this.loading
          ? html`<p class="p ta-center tc-muted">Loading…</p>`
          : isEmpty
            ? html`
              <k-card class="p">
                <p class="ta-center tc-muted m0">
                  ${this.search || this.kind || this.awaitingReview ? 'Nothing matches that filter.' : 'This folder is empty.'}
                  ${this.canUpload ? html`<br />Drop files here, or use the Upload button.` : ''}
                </p>
              </k-card>`
            : this.viewMode === 'list'
              ? html`
                <k-table ?enable-selection=${!this.selectable} placeholder="This folder is empty.">
                  ${!this.selectable ? this.renderSelectionControls() : ''}
                </k-table>
              `
              : html`
                <k-card-grid
                  ?enable-selection=${!this.selectable}
                  placeholder="This folder is empty."
                  @toggle-public=${e => this.togglePublic(e.detail.record)}
                  @toggle-trusted=${e => this.toggleTrusted(e.detail.record)}
                  @rename-entry=${e => this.renameEntry(e.detail.record)}
                  @move-entry=${e => this.moveEntry(e.detail.record)}
                  @delete-entry=${e => this.deleteEntry(e.detail.record)}
                >
                  ${!this.selectable ? this.renderSelectionControls() : ''}
                  ${!this.selectable ? this.renderCardControls() : ''}
                </k-card-grid>
              `}

        ${pages > 1 ? html`
          <div class="d-f pager mt">
            <button ?disabled=${this.offset === 0} @click=${() => { this.offset = Math.max(0, this.offset - PAGE_SIZE); this.load(); }}>Previous</button>
            <span class="flex ta-center tc-muted small">Page ${page} of ${pages} · ${this.total} file${this.total === 1 ? '' : 's'}</span>
            <button ?disabled=${page >= pages} @click=${() => { this.offset += PAGE_SIZE; this.load(); }}>Next</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /*
    Grid tile layout now lives inline in renderTile (k-card-grid's shadow root, not this one — see
    that method's own comment for why). Only what's left is genuinely this component's own: the
    library wrapper, the drag-over outline, and the pager.
  */
  static styles = css`
    :host { display: block; }
    .library { position: relative; }
    .library.dragging { outline: 2px dashed var(--c_primary); outline-offset: 0.5rem; }
    .pager { gap: var(--spacer_h); align-items: center; }
  `;
}

customElements.define('k-files-library', FileLibrary);
