import { writeFile, stat, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFile, kempoFileDirectory } from '../../db/schema.js';
import sanitizeName from '../names/sanitizeName.js';
import { kindForName } from '../names/fileTypes.js';
import { directoryPath } from '../paths.js';

/*
  Writes an uploaded file to disk and records it.

  The name is the user's own — a download has to arrive called what they uploaded — so it goes
  through the same validator every other path segment does, and a collision is refused rather than
  silently suffixed. Quietly turning `logo.png` into `logo-1.png` produces a library where the file
  someone linked to is not the file they uploaded.
*/
export default async ({
  id = null,
  name,
  data,
  directoryId = null,
  altText = '',
  ownerId,
  trusted = false,
  public: isPublic = false,
  reviewable = true,
  maxBytes,
}) => {
  const [nameError, validName] = sanitizeName(name);
  if(nameError) return [nameError, null];

  /*
    A caller can pick the id when another record already uses it as its own key (kempo-media keeps
    a media asset's id and its file's id the same, so nothing needs a mapping table). It is held to
    the shape generated ids have, since the id ends up in URLs and is never a path segment on disk.
  */
  if(id !== null && !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return [{ code: 400, msg: 'That file id is not valid' }, null];
  if(id !== null){
    const [taken] = await db.select({ id: kempoFile.id }).from(kempoFile).where(eq(kempoFile.id, id));
    if(taken) return [{ code: 409, msg: 'A file with that id already exists' }, null];
  }

  if(!ownerId) return [{ code: 400, msg: 'An owner is required' }, null];
  if(!Buffer.isBuffer(data)) return [{ code: 400, msg: 'File content is required' }, null];
  if(maxBytes && data.length > maxBytes){
    return [{ code: 413, msg: `That file is larger than the ${Math.round(maxBytes / 1024 / 1024)}MB limit` }, null];
  }

  if(directoryId){
    const [parent] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, directoryId));
    if(!parent) return [{ code: 404, msg: 'Folder not found' }, null];
  }

  const [existing] = await db.select().from(kempoFile).where(and(
    eq(kempoFile.name, validName),
    directoryId ? eq(kempoFile.directoryId, directoryId) : isNull(kempoFile.directoryId),
  ));
  if(existing) return [{ code: 409, msg: `A file named "${validName}" already exists here` }, null];

  const [dirError, directoryAbsolute] = await directoryPath(directoryId);
  if(dirError) return [dirError, null];

  const absolute = join(directoryAbsolute, validName);

  /*
    A file on disk with no row behind it still gets in the way — overwriting it would destroy
    content the library never knew about, which is exactly the kind of loss nobody goes looking
    for until much later.
  */
  try {
    await stat(absolute);
    return [{ code: 409, msg: `"${validName}" already exists on disk` }, null];
  } catch(error) {
    if(error.code !== 'ENOENT') return [{ code: 500, msg: 'Could not check the destination' }, null];
  }

  try {
    await mkdir(directoryAbsolute, { recursive: true });
    await writeFile(absolute, data);
  } catch {
    return [{ code: 500, msg: 'Could not write the file' }, null];
  }

  const now = new Date();
  const row = {
    id: id ?? crypto.randomBytes(8).toString('hex'),
    name: validName,
    directoryId,
    kind: kindForName(validName),
    altText,
    public: Boolean(isPublic),
    /*
      An unreviewable file can never be trusted, whatever the caller passed. Enforced here as well
      as in setFileTrust so the two flags cannot be made to contradict each other at the one moment
      the row is created.
    */
    trusted: Boolean(reviewable) && Boolean(trusted),
    reviewable: Boolean(reviewable),
    alias: null,
    ownerId,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.insert(kempoFile).values(row);
  } catch {
    return [{ code: 500, msg: 'Could not record the file' }, null];
  }

  return [null, row];
};
