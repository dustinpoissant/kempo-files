import '../../admin/components/EntryMenu.js';

// Shares table-controls' test page (the /kempo-ui/ import map) rather than duplicating it — this is
// the one component outside that directory needing it, since it imports k-dropdown/k-icon directly.
export const page = './table-controls/test-page.html';

const createMenu = async ({ kind = 'file', entry, canTrust = false } = {}) => {
  const menu = document.createElement('k-files-entry-menu');
  menu.kind = kind;
  menu.entry = entry;
  menu.canTrust = canTrust;
  document.body.appendChild(menu);
  await menu.updateComplete;
  return menu;
};

const cleanup = menu => {
  if(menu?.parentNode) menu.parentNode.removeChild(menu);
};

const itemValues = menu => Array.from(menu.shadowRoot.querySelectorAll('button[data-value]')).map(b => b.dataset.value);

export default {
  'renders nothing without an entry': async ({ pass, fail }) => {
    const menu = await createMenu({ entry: null });
    if(menu.shadowRoot.querySelector('k-dropdown')){
      cleanup(menu);
      return fail('Expected no dropdown to render without an entry');
    }
    cleanup(menu);
    pass('Renders nothing when entry is null');
  },

  'directory kind renders exactly rename, move and delete': async ({ pass, fail }) => {
    const menu = await createMenu({ kind: 'directory', entry: { id: 'dir-1', name: 'downloads' } });
    const values = itemValues(menu);
    if(values.join(',') !== 'rename,move,delete'){
      cleanup(menu);
      return fail(`Expected exactly [rename, move, delete], got ${JSON.stringify(values)}`);
    }
    cleanup(menu);
    pass('Directory menu has rename/move/delete only');
  },

  'directory delete item is styled tc-danger': async ({ pass, fail }) => {
    const menu = await createMenu({ kind: 'directory', entry: { id: 'dir-1', name: 'downloads' } });
    const deleteButton = menu.shadowRoot.querySelector('button[data-value="delete"]');
    if(!deleteButton.classList.contains('tc-danger')){
      cleanup(menu);
      return fail('Expected the delete item to carry tc-danger');
    }
    cleanup(menu);
    pass('Delete item is styled as dangerous');
  },

  'file kind (private, no trust permission) omits alias and trust items': async ({ pass, fail }) => {
    const menu = await createMenu({ kind: 'file', entry: { id: 'f1', name: 'a.txt', public: false, trusted: false } });
    const values = itemValues(menu);
    if(values.join(',') !== 'details,open,rename,move,public,delete'){
      cleanup(menu);
      return fail(`Expected [details, open, rename, move, public, delete], got ${JSON.stringify(values)}`);
    }
    cleanup(menu);
    pass('Private file with no trust permission has the base 6 items');
  },

  'public file adds an alias item, labeled "Set alias…" when none exists yet': async ({ pass, fail }) => {
    const menu = await createMenu({ kind: 'file', entry: { id: 'f1', name: 'a.txt', public: true, trusted: false, alias: null } });
    const values = itemValues(menu);
    if(!values.includes('alias')){
      cleanup(menu);
      return fail(`Expected an alias item for a public file, got ${JSON.stringify(values)}`);
    }
    const aliasButton = menu.shadowRoot.querySelector('button[data-value="alias"]');
    if(aliasButton.textContent.trim() !== 'Set alias…'){
      cleanup(menu);
      return fail(`Expected "Set alias…" with no existing alias, got "${aliasButton.textContent.trim()}"`);
    }
    cleanup(menu);
    pass('Public file with no alias shows "Set alias…"');
  },

  'public file with an existing alias labels the item "Edit alias…"': async ({ pass, fail }) => {
    const menu = await createMenu({ kind: 'file', entry: { id: 'f1', name: 'a.txt', public: true, trusted: false, alias: 'a/b.js' } });
    const aliasButton = menu.shadowRoot.querySelector('button[data-value="alias"]');
    if(aliasButton.textContent.trim() !== 'Edit alias…'){
      cleanup(menu);
      return fail(`Expected "Edit alias…" with an existing alias, got "${aliasButton.textContent.trim()}"`);
    }
    cleanup(menu);
    pass('Public file with an alias shows "Edit alias…"');
  },

  'private file never shows an alias item, even with canTrust': async ({ pass, fail }) => {
    const menu = await createMenu({ kind: 'file', entry: { id: 'f1', name: 'a.txt', public: false, trusted: false }, canTrust: true });
    if(itemValues(menu).includes('alias')){
      cleanup(menu);
      return fail('A private file should never offer an alias item');
    }
    cleanup(menu);
    pass('No alias item for a private file');
  },

  'canTrust adds a trust item labeled by the file\'s current trust state': async ({ pass, fail }) => {
    const unreviewed = await createMenu({ kind: 'file', entry: { id: 'f1', name: 'a.txt', public: false, trusted: false }, canTrust: true });
    const unreviewedButton = unreviewed.shadowRoot.querySelector('button[data-value="trust"]');
    if(!unreviewedButton || unreviewedButton.textContent.trim() !== 'Approve to run'){
      cleanup(unreviewed);
      return fail(`Expected "Approve to run" for an unreviewed file, got "${unreviewedButton?.textContent.trim()}"`);
    }
    cleanup(unreviewed);

    const trusted = await createMenu({ kind: 'file', entry: { id: 'f2', name: 'b.js', public: false, trusted: true }, canTrust: true });
    const trustedButton = trusted.shadowRoot.querySelector('button[data-value="trust"]');
    if(!trustedButton || trustedButton.textContent.trim() !== 'Withdraw approval'){
      cleanup(trusted);
      return fail(`Expected "Withdraw approval" for a trusted file, got "${trustedButton?.textContent.trim()}"`);
    }
    cleanup(trusted);
    pass('Trust item label follows the file\'s current trusted state');
  },

  'without canTrust, no trust item renders even for a trusted file': async ({ pass, fail }) => {
    const menu = await createMenu({ kind: 'file', entry: { id: 'f1', name: 'a.txt', public: false, trusted: true }, canTrust: false });
    if(itemValues(menu).includes('trust')){
      cleanup(menu);
      return fail('Should not offer a trust item without canTrust, regardless of the file\'s own trusted state');
    }
    cleanup(menu);
    pass('No trust item without the canTrust permission');
  },

  'public item label follows the file\'s current public state': async ({ pass, fail }) => {
    const priv = await createMenu({ kind: 'file', entry: { id: 'f1', name: 'a.txt', public: false, trusted: false } });
    const privButton = priv.shadowRoot.querySelector('button[data-value="public"]');
    if(privButton.textContent.trim() !== 'Make public'){
      cleanup(priv);
      return fail(`Expected "Make public" for a private file, got "${privButton.textContent.trim()}"`);
    }
    cleanup(priv);

    const pub = await createMenu({ kind: 'file', entry: { id: 'f2', name: 'b.js', public: true, trusted: false } });
    const pubButton = pub.shadowRoot.querySelector('button[data-value="public"]');
    if(pubButton.textContent.trim() !== 'Make private'){
      cleanup(pub);
      return fail(`Expected "Make private" for a public file, got "${pubButton.textContent.trim()}"`);
    }
    cleanup(pub);
    pass('Public item label follows the file\'s current state');
  },

  'clicking an item dispatches action with the action, kind and entry': async ({ pass, fail }) => {
    const entry = { id: 'dir-1', name: 'downloads' };
    const menu = await createMenu({ kind: 'directory', entry });
    let detail = null;
    menu.addEventListener('action', e => { detail = e.detail; });
    menu.shadowRoot.querySelector('button[data-value="rename"]').click();
    if(!detail || detail.action !== 'rename' || detail.kind !== 'directory' || detail.entry !== entry){
      cleanup(menu);
      return fail(`Expected action="rename" kind="directory" entry===the same object, got ${JSON.stringify(detail)}`);
    }
    cleanup(menu);
    pass('Dispatches action with the clicked item\'s value, kind and entry');
  },
};
