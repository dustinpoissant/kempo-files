import { join, resolve, sep } from 'path';
import { eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory } from '../db/schema.js';

/*
  Where files live, and how a row turns into a path on disk.

  `<site-root>/files/` is a sibling of `public/`, never inside it. That is the whole basis of this
  extension's security model: kempo-server's static file scanner is rooted at `public/`, so nothing
  here can be served by accident. Every byte that reaches a browser goes through a route that
  checked a permission and fired the download hook first.
*/
export const FILES_ROOT = () => join(process.cwd(), 'files');

/*
  A directory's ancestry, root-first. Walks parentId upward, which is the only way to reconstruct a
  path from a self-referential table.

  The visited set is not paranoia: nothing in the schema stops a row from being made its own
  ancestor by a buggy move, and without this an accidental cycle is an infinite loop inside a
  request rather than an error.
*/
export const directorySegments = async directoryId => {
  const segments = [];
  const visited = new Set();
  let currentId = directoryId;

  while(currentId){
    if(visited.has(currentId)){
      return [{ code: 500, msg: 'Folder structure contains a cycle' }, null];
    }
    visited.add(currentId);

    const [row] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, currentId));
    if(!row) return [{ code: 404, msg: 'Folder not found' }, null];

    segments.unshift(row.name);
    currentId = row.parentId;
  }

  return [null, segments];
};

/*
  Refuses any path that escapes the files root. The name validator should already make this
  impossible, so reaching it means something upstream is wrong — which is exactly when a second
  check earns its keep, since the cost of being wrong here is reading or writing arbitrary files.
*/
const within = (root, target) => {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + sep);
};

export const directoryPath = async directoryId => {
  const [error, segments] = await directorySegments(directoryId);
  if(error) return [error, null];

  const path = join(FILES_ROOT(), ...segments);
  if(!within(FILES_ROOT(), path)){
    return [{ code: 400, msg: 'Resolved folder path is outside the file library' }, null];
  }
  return [null, path];
};

export const filePath = async file => {
  const [error, dir] = await directoryPath(file.directoryId);
  if(error) return [error, null];

  const path = join(dir, file.name);
  if(!within(FILES_ROOT(), path)){
    return [{ code: 400, msg: 'Resolved file path is outside the file library' }, null];
  }
  return [null, path];
};

/*
  The path as the user sees it — forward slashes, relative to the library root. Used for display
  and for the browser SDK; never for filesystem access.
*/
export const displayPath = async file => {
  const [error, segments] = await directorySegments(file.directoryId);
  if(error) return [error, null];
  return [null, [...segments, file.name].join('/')];
};
