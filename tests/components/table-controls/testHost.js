import '/kempo-ui/components/CardGrid.js';

/*
  A real <k-card-grid>, not a stand-in — Control's host resolution (closest('[controlled]')) and
  CardGrid's clone-per-tile mechanism for slot="before"/"after" controls only behave correctly
  against the genuine component, so every table-controls test mounts one instead of faking its API.
  No kempo-server, no fetch, no database: everything a control reads (host.getSelectedRecords(),
  host.records via a tile's data-index) comes from properties set directly on this real element.
*/
export const sampleRecords = () => ([
  { id: 'dir-1', name: 'downloads', _type: 'directory', parentId: null },
  { id: 'file-1', name: '802.svg', _type: 'file', public: false, trusted: false, alias: null, directoryId: null },
  { id: 'file-2', name: 'analytics.js', _type: 'file', public: false, trusted: true, alias: null, directoryId: null },
  { id: 'file-3', name: 'hero.jpg', _type: 'file', public: true, trusted: false, alias: 'images/hero.jpg', directoryId: null },
]);

export const createGrid = async ({ records = sampleRecords(), enableSelection = true, topControls = [], afterControls = [], beforeControls = [] } = {}) => {
  const container = document.createElement('div');
  const grid = document.createElement('k-card-grid');
  topControls.forEach(control => { control.setAttribute('slot', 'top'); grid.appendChild(control); });
  afterControls.forEach(control => { control.setAttribute('slot', 'after'); grid.appendChild(control); });
  beforeControls.forEach(control => { control.setAttribute('slot', 'before'); grid.appendChild(control); });
  container.appendChild(grid);
  document.body.appendChild(container);
  grid.setData({ records, cardTemplate: record => record.name, enableSelection });
  await grid.updateComplete;
  return { container, grid };
};

// The clone landing in a specific record's own tile — what a real per-card control resolves against.
export const tileFor = (grid, recordId) => {
  const idx = grid.records.findIndex(r => r.id === recordId);
  return grid.shadowRoot.querySelector(`.tile[data-index="${idx}"]`);
};

// selectAllOnPage/deselectAllOnPage fire selectionChange via setTimeout(..., 0), not synchronously.
export const waitForSelectionChange = grid => new Promise(resolve => grid.addEventListener('selectionChange', resolve, { once: true }));

/*
  Checks exactly one record's own checkbox via a real click — the [selected] flag CardGrid tracks
  per record is a module-private Symbol, so there's no public "select just this one" method; a click
  on the actual rendered checkbox is the only way in from outside that isn't reaching into internals.
  Hiding a record (hideRecord) does NOT exclude it from selectAllOnPage/getSelectedRecords, so it
  can't be used to fake a partial selection either — this is the real mechanism.
*/
export const selectOnly = (grid, recordId) => {
  const tile = tileFor(grid, recordId);
  const checkbox = tile?.querySelector('.card-select');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
};

export const cleanup = container => {
  if(container?.parentNode) container.parentNode.removeChild(container);
};
