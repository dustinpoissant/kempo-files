import { eq, inArray } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory } from '../../db/schema.js';

const getDirectory = async id => {
  if(!id) return [{ code: 400, msg: 'A folder id is required' }, null];

  try {
    const [row] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, id));
    if(!row) return [{ code: 404, msg: 'Folder not found' }, null];
    return [null, row];
  } catch {
    return [{ code: 500, msg: 'Could not load the folder' }, null];
  }
};

export default getDirectory;

/*
  A folder's ancestry as whole rows, root-first, with the folder itself last.

  paths.js already walks this chain to build a path on disk, but it only ever needed the *names*.
  An extension asking "which subtree is this folder in" needs the ids, and reconstructing that from
  names is not the same question — two folders under different parents can share a name.

  The visited set is there for the same reason as the one in paths.js: nothing in the schema stops
  a buggy move from making a row its own ancestor, and without it an accidental cycle is an
  infinite loop inside a request rather than an error.
*/
export const directoryAncestry = async id => {
  const chain = [];
  const visited = new Set();
  let currentId = id;

  while(currentId){
    if(visited.has(currentId)) return [{ code: 500, msg: 'Folder structure contains a cycle' }, null];
    visited.add(currentId);

    const [error, row] = await getDirectory(currentId);
    if(error) return [error, null];

    chain.unshift(row);
    currentId = row.parentId;
  }

  return [null, chain];
};

/*
  Every folder at or below `id`, the folder itself included — one query per level of depth rather
  than one per folder, which is what makes sizing or emptying a whole subtree affordable.
*/
export const directorySubtree = async id => {
  const [error, root] = await getDirectory(id);
  if(error) return [error, null];

  try {
    const collected = [root];
    const seen = new Set([root.id]);
    let frontier = [root.id];

    while(frontier.length){
      const children = await db.select().from(kempoFileDirectory).where(inArray(kempoFileDirectory.parentId, frontier));
      const fresh = children.filter(child => !seen.has(child.id));
      if(!fresh.length) break;
      for(const child of fresh) seen.add(child.id);
      collected.push(...fresh);
      frontier = fresh.map(child => child.id);
    }

    return [null, collected];
  } catch {
    return [{ code: 500, msg: 'Could not load the folder tree' }, null];
  }
};
