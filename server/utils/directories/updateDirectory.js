import { rename, stat } from 'fs/promises';
import { join } from 'path';
import { and, eq, isNull, ne } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory } from '../../db/schema.js';
import sanitizeName from '../names/sanitizeName.js';
import { directoryPath } from '../paths.js';

/*
  Renames or moves a folder.

  `fs.rename` does not refuse an existing destination — it replaces it — so every path here checks
  first and only proceeds on ENOENT. Without that, moving one folder onto another's name destroys
  the second folder's contents on disk while its rows carry on pointing at a path whose contents
  are now something else entirely.
*/
export default async ({ id, name, parentId }) => {
  const [existing] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, id));
  if(!existing) return [{ code: 404, msg: 'Folder not found' }, null];

  const movingParent = parentId !== undefined && parentId !== existing.parentId;
  const renaming = name !== undefined && name !== existing.name;
  if(!movingParent && !renaming) return [null, existing];

  let nextName = existing.name;
  if(renaming){
    const [nameError, validName] = sanitizeName(name);
    if(nameError) return [nameError, null];
    nextName = validName;
  }

  const nextParentId = movingParent ? parentId : existing.parentId;

  if(nextParentId){
    const [parent] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, nextParentId));
    if(!parent) return [{ code: 404, msg: 'Destination folder not found' }, null];

    /*
      A folder cannot be moved inside itself or one of its own descendants. The database would
      accept it happily and the result is a subtree orphaned from the root — unreachable, and an
      infinite walk for anything reconstructing paths.
    */
    let cursor = nextParentId;
    const seen = new Set();
    while(cursor){
      if(cursor === id) return [{ code: 400, msg: 'A folder cannot be moved inside itself' }, null];
      if(seen.has(cursor)) break; // already-broken data; directoryPath below reports it properly
      seen.add(cursor);
      const [row] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, cursor));
      cursor = row?.parentId;
    }
  }

  const [siblingConflict] = await db.select().from(kempoFileDirectory).where(and(
    eq(kempoFileDirectory.name, nextName),
    nextParentId ? eq(kempoFileDirectory.parentId, nextParentId) : isNull(kempoFileDirectory.parentId),
    ne(kempoFileDirectory.id, id),
  ));
  if(siblingConflict) return [{ code: 409, msg: `A folder named "${nextName}" already exists there` }, null];

  const [fromError, fromPath] = await directoryPath(id);
  if(fromError) return [fromError, null];

  const [toParentError, toParentPath] = await directoryPath(nextParentId);
  if(toParentError) return [toParentError, null];

  const toPath = join(toParentPath, nextName);

  if(toPath !== fromPath){
    try {
      await stat(toPath);
      return [{ code: 409, msg: `"${nextName}" already exists at the destination` }, null];
    } catch(error) {
      if(error.code !== 'ENOENT') return [{ code: 500, msg: 'Could not check the destination' }, null];
    }

    try {
      await rename(fromPath, toPath);
    } catch {
      return [{ code: 500, msg: 'Could not move the folder on disk' }, null];
    }
  }

  const updated = { ...existing, name: nextName, parentId: nextParentId };

  try {
    await db.update(kempoFileDirectory)
      .set({ name: nextName, parentId: nextParentId })
      .where(eq(kempoFileDirectory.id, id));
  } catch {
    /*
      The bytes already moved. Putting them back is the only way to leave the library consistent —
      a row pointing at a path that no longer exists is worse than a failed rename.
    */
    if(toPath !== fromPath) await rename(toPath, fromPath).catch(() => {});
    return [{ code: 500, msg: 'Could not record the change' }, null];
  }

  return [null, updated];
};
