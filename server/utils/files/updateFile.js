import { rename, stat } from 'fs/promises';
import { join } from 'path';
import { and, eq, isNull, ne } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFile, kempoFileDirectory } from '../../db/schema.js';
import sanitizeName, { sanitizeAlias } from '../names/sanitizeName.js';
import { kindForName } from '../names/fileTypes.js';
import { directoryPath, filePath } from '../paths.js';

/*
  Metadata changes: rename, move, alt text, the public flag, the alias.

  Deliberately *not* content. Replacing a file's bytes is a different action with a different
  permission and a trust consequence (see replaceFileContent.js), and folding it in here would mean
  an alt-text edit and a content swap were indistinguishable to every caller and every reviewer.
*/
export default async ({ id, name, directoryId, altText, public: isPublic, alias }) => {
  const [existing] = await db.select().from(kempoFile).where(eq(kempoFile.id, id));
  if(!existing) return [{ code: 404, msg: 'File not found' }, null];

  const changes = {};

  const renaming = name !== undefined && name !== existing.name;
  const moving = directoryId !== undefined && directoryId !== existing.directoryId;

  let nextName = existing.name;
  if(renaming){
    const [nameError, validName] = sanitizeName(name);
    if(nameError) return [nameError, null];
    nextName = validName;
    changes.name = validName;
    // The kind is derived from the extension, so renaming can legitimately change it.
    changes.kind = kindForName(validName);
  }

  const nextDirectoryId = moving ? directoryId : existing.directoryId;
  if(moving && nextDirectoryId){
    const [parent] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, nextDirectoryId));
    if(!parent) return [{ code: 404, msg: 'Destination folder not found' }, null];
  }
  if(moving) changes.directoryId = nextDirectoryId;

  if(altText !== undefined) changes.altText = String(altText);

  /*
    An alias only makes sense for a file anyone can already fetch, so a file going private takes
    its alias with it. Leaving the alias behind would keep a bare public URL resolving to something
    that just stopped being public.
  */
  const nextPublic = isPublic === undefined ? existing.public : Boolean(isPublic);
  if(isPublic !== undefined){
    changes.public = nextPublic;
    if(!nextPublic) changes.alias = null;
  }

  if(alias !== undefined){
    if(alias === null || alias === ''){
      changes.alias = null;
    } else {
      if(!nextPublic){
        return [{ code: 400, msg: 'Only public files can have an alias' }, null];
      }
      /*
        Checked against the name the file will have after this same request, not the one it had
        before — otherwise renaming and re-aliasing in one call would be rejected against a name
        that no longer exists.
      */
      const [aliasError, validAlias] = sanitizeAlias(alias, nextName);
      if(aliasError) return [aliasError, null];

      const [taken] = await db.select().from(kempoFile).where(and(
        eq(kempoFile.alias, validAlias),
        ne(kempoFile.id, id),
      ));
      if(taken) return [{ code: 409, msg: 'Another file already uses that alias' }, null];

      changes.alias = validAlias;
    }
  }

  /*
    Renaming a file that already has an alias would otherwise leave the alias ending in a filename
    that no longer exists — which the rule above forbids, and which would make the next edit of any
    unrelated field fail validation. The alias follows the rename instead: its directory part is
    kept, its last segment becomes the new name.
  */
  if(renaming && changes.alias === undefined && existing.alias){
    const parts = existing.alias.split('/');
    parts[parts.length - 1] = nextName;
    const followed = parts.join('/');

    const [taken] = await db.select().from(kempoFile).where(and(
      eq(kempoFile.alias, followed),
      ne(kempoFile.id, id),
    ));
    // Someone else already holds the alias the rename would produce — drop it rather than fail
    changes.alias = taken ? null : followed;
  }

  if(Object.keys(changes).length === 0) return [null, existing];

  /*
    Moving the bytes. Same rule as folders: `fs.rename` replaces an existing destination without
    complaint, so renaming one file onto another's name would destroy the second file's content
    while its row — id, owner, alt text, trusted flag — carried on as if nothing had happened. That
    is also a way to slip new content under an already-approved file, so it is checked, not assumed.
  */
  if(renaming || moving){
    const [siblingConflict] = await db.select().from(kempoFile).where(and(
      eq(kempoFile.name, nextName),
      nextDirectoryId ? eq(kempoFile.directoryId, nextDirectoryId) : isNull(kempoFile.directoryId),
      ne(kempoFile.id, id),
    ));
    if(siblingConflict) return [{ code: 409, msg: `A file named "${nextName}" already exists there` }, null];

    const [fromError, fromPath] = await filePath(existing);
    if(fromError) return [fromError, null];

    const [toDirError, toDirPath] = await directoryPath(nextDirectoryId);
    if(toDirError) return [toDirError, null];

    const toPath = join(toDirPath, nextName);

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
        return [{ code: 500, msg: 'Could not move the file on disk' }, null];
      }

      try {
        await db.update(kempoFile).set({ ...changes, updatedAt: new Date() }).where(eq(kempoFile.id, id));
      } catch {
        // Put the bytes back rather than leave the row pointing somewhere they are not.
        await rename(toPath, fromPath).catch(() => {});
        return [{ code: 500, msg: 'Could not record the change' }, null];
      }

      return [null, { ...existing, ...changes }];
    }
  }

  try {
    await db.update(kempoFile).set({ ...changes, updatedAt: new Date() }).where(eq(kempoFile.id, id));
  } catch {
    return [{ code: 500, msg: 'Could not record the change' }, null];
  }

  return [null, { ...existing, ...changes }];
};
