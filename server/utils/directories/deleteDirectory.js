import { rmdir } from 'fs/promises';
import { and, eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory, kempoFile } from '../../db/schema.js';
import { directoryPath } from '../paths.js';

/*
  Deletes an empty folder.

  Refusing to delete a folder with anything in it is deliberate. A recursive delete here would let
  one request destroy an arbitrary amount of other people's work — including files the caller has
  no permission to delete individually — and there is no undo. Emptying it first is a small cost
  for making that impossible.
*/
export default async ({ id }) => {
  const [existing] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, id));
  if(!existing) return [{ code: 404, msg: 'Folder not found' }, null];

  const [childDirectory] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.parentId, id));
  if(childDirectory) return [{ code: 409, msg: 'That folder still has folders in it' }, null];

  const [childFile] = await db.select().from(kempoFile).where(eq(kempoFile.directoryId, id));
  if(childFile) return [{ code: 409, msg: 'That folder still has files in it' }, null];

  const [pathError, absolute] = await directoryPath(id);
  if(pathError) return [pathError, null];

  /*
    ENOENT is not a failure: the row is what the library goes by, and a folder already gone from
    disk should not become undeletable. Anything else — ENOTEMPTY especially, meaning there are
    files on disk with no rows behind them — is a real inconsistency and stops the delete.
  */
  try {
    await rmdir(absolute);
  } catch(error) {
    if(error.code === 'ENOTEMPTY'){
      return [{ code: 409, msg: 'That folder has contents on disk that the library does not know about' }, null];
    }
    if(error.code !== 'ENOENT'){
      return [{ code: 500, msg: 'Could not remove the folder from disk' }, null];
    }
  }

  try {
    await db.delete(kempoFileDirectory).where(and(eq(kempoFileDirectory.id, id)));
  } catch {
    return [{ code: 500, msg: 'Could not remove the folder record' }, null];
  }

  return [null, { id }];
};
