import { mkdir, stat } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory } from '../../db/schema.js';
import sanitizeName from '../names/sanitizeName.js';
import { directoryPath } from '../paths.js';

/*
  Creates a folder, on disk and in the database, refusing anything that would collide with
  something already there.

  Both checks matter and neither replaces the other: the database check catches a name already
  claimed by a sibling row, and the filesystem check catches a name that exists on disk without a
  row behind it (a leftover, or something a person put there by hand). Writing over either is how
  a library loses track of its own contents.
*/
export default async ({ name, parentId = null, ownerId }) => {
  const [nameError, validName] = sanitizeName(name);
  if(nameError) return [nameError, null];

  if(!ownerId) return [{ code: 400, msg: 'An owner is required' }, null];

  if(parentId){
    const [parent] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, parentId));
    if(!parent) return [{ code: 404, msg: 'Parent folder not found' }, null];
  }

  const [siblingsError, parentAbsolute] = await directoryPath(parentId);
  if(siblingsError) return [siblingsError, null];

  const [existing] = await db.select().from(kempoFileDirectory).where(and(
    eq(kempoFileDirectory.name, validName),
    parentId ? eq(kempoFileDirectory.parentId, parentId) : isNull(kempoFileDirectory.parentId),
  ));
  if(existing) return [{ code: 409, msg: `A folder named "${validName}" already exists here` }, null];

  const absolute = join(parentAbsolute, validName);
  try {
    await stat(absolute);
    return [{ code: 409, msg: `"${validName}" already exists on disk` }, null];
  } catch(error) {
    if(error.code !== 'ENOENT') return [{ code: 500, msg: 'Could not check the destination folder' }, null];
  }

  try {
    await mkdir(absolute, { recursive: true });
  } catch {
    return [{ code: 500, msg: 'Could not create the folder on disk' }, null];
  }

  const row = {
    id: crypto.randomBytes(8).toString('hex'),
    name: validName,
    parentId,
    ownerId,
    createdAt: new Date(),
  };

  try {
    await db.insert(kempoFileDirectory).values(row);
  } catch {
    return [{ code: 500, msg: 'Could not record the folder' }, null];
  }

  return [null, row];
};
