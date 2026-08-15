import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

/*
  Static checks that the permission names the code asks for are the ones the extension declares.

  This exists because kempo-blog shipped exactly this mismatch: its config declared prefixed names
  while its routes checked unprefixed ones, so its "New Post" gate silently denied everyone. A
  permission check against a name nobody registered does not error — it just answers no, forever,
  and only for the people who are not administrators (who bypass checks entirely, which is why it
  survives testing).
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const config = JSON.parse(await readFile(path.join(root, 'kempo-config.json'), 'utf8'));
const declared = new Set(config.permissions.map(permission => permission.name));

const walk = async dir => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for(const entry of entries){
    if(entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()) files.push(...await walk(full));
    else if(entry.name.endsWith('.js')) files.push(full);
  }
  return files;
};

const sources = [
  ...await walk(path.join(root, 'public')),
  ...await walk(path.join(root, 'server')),
  ...await walk(path.join(root, 'hooks')),
];

export default {
  'every permission the code checks is one the extension declares': async ({ pass, fail }) => {
    const used = new Map();

    for(const file of sources){
      const text = await readFile(file, 'utf8');

      // currentUserHasPermission(token, 'files:upload') and requirePermission(token, 'files:browse')
      for(const match of text.matchAll(/(?:currentUserHasPermission|requirePermission)\s*\([^,]+,\s*['"]([^'"]+)['"]/g)){
        used.set(match[1], file);
      }

      /*
        requireOwnership builds its names from resource + action, so the literal string never
        appears in the source. Reconstructing it here is the only way this check covers the
        own/others permissions at all — which are most of them.
      */
      for(const match of text.matchAll(/resource:\s*['"]([^'"]+)['"][\s\S]{0,120}?action:\s*['"]([^'"]+)['"]/g)){
        used.set(`${match[1]}:own:${match[2]}`, file);
        used.set(`${match[1]}:others:${match[2]}`, file);
      }
    }

    if(used.size === 0) return fail('found no permission checks at all — this test is not looking in the right place');

    const undeclared = [...used.entries()]
      .filter(([name]) => !declared.has(name))
      .map(([name, file]) => `${name} (${path.relative(root, file)})`);

    undeclared.length
      ? fail(`checked but never declared in kempo-config.json: ${undeclared.join(', ')}`)
      : pass(`${used.size} permission names all declared`);
  },

  'permission names are unprefixed, matching what installExtension stores': async ({ pass, fail }) => {
    /*
      installExtension registers these names verbatim. Prefixing them here (kempo-files:files:upload)
      would mean every check in the code missed.
    */
    const prefixed = [...declared].filter(name => name.startsWith('kempo-files:'));
    prefixed.length
      ? fail(`permissions must not carry the extension prefix: ${prefixed.join(', ')}`)
      : pass('all unprefixed');
  },

  'groups only grant permissions that exist': async ({ pass, fail }) => {
    const bad = [];
    for(const group of config.groups || []){
      // Group *names* are prefixed by convention; the permissions they grant are not.
      if(!group.name.startsWith('kempo-files:')) bad.push(`group "${group.name}" should be prefixed`);
      for(const permission of group.permissions || []){
        if(!declared.has(permission)) bad.push(`group "${group.name}" grants undeclared "${permission}"`);
      }
    }
    bad.length ? fail(bad.join('; ')) : pass('groups reference declared permissions');
  },

  'the declared hook points at a file that exists and exports a handler': async ({ pass, fail }) => {
    const hooks = config.hooks || {};
    if(!Object.keys(hooks).length) return fail('expected at least the route:unmatched hook');

    for(const [event, callback] of Object.entries(hooks)){
      // pathToFileURL, not the bare path: Windows absolute paths are not valid ESM specifiers
      const resolved = pathToFileURL(path.join(root, callback)).href;
      try {
        const module = await import(resolved);
        if(typeof module.default !== 'function') return fail(`${event} handler has no default export function`);
      } catch(error) {
        return fail(`${event} handler (${callback}) failed to load: ${error.message}`);
      }
    }
    pass('hook handlers load');
  },
};
