import { and, asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { stat } from 'fs/promises';
import { join } from 'path';
import db from 'kempo/server/db/index.js';
import { kempoFile } from '../../db/schema.js';
import { directoryPath } from '../paths.js';

/*
  Attaches each row's on-disk size — deliberately not stored (schema.js), so it is read fresh every
  time rather than kept in sync. Directory paths are resolved once per distinct directoryId among
  the rows rather than once per file, since a listing is almost always many files sharing one
  folder. A row whose stat fails (removed from disk outside the app, say) gets sizeBytes: null
  rather than failing the whole listing — it is still a real row, just briefly unmeasurable.
*/
const withSizes = async rows => {
  const dirIds = [...new Set(rows.map(row => row.directoryId))];
  const dirPaths = new Map();
  await Promise.all(dirIds.map(async directoryId => {
    const [error, path] = await directoryPath(directoryId);
    dirPaths.set(directoryId, error ? null : path);
  }));

  return Promise.all(rows.map(async row => {
    const dir = dirPaths.get(row.directoryId);
    if(!dir) return { ...row, sizeBytes: null };
    try {
      const stats = await stat(join(dir, row.name));
      return { ...row, sizeBytes: stats.size };
    } catch {
      return { ...row, sizeBytes: null };
    }
  }));
};

/*
  The library listing: one folder at a time, optionally filtered.

  `awaitingReview` is what gives the trusted-uploader role somewhere to work from — without it,
  finding the files nobody has vouched for yet means paging through everything.
*/
export default async ({
  directoryId,
  kind,
  search,
  awaitingReview = false,
  limit = 24,
  offset = 0,
} = {}) => {
  try {
    const filters = [];

    /*
      `directoryId === undefined` means "wherever", which the picker uses to search the whole
      library; `null` means the root folder specifically. They are different questions and
      collapsing them makes root un-listable.
    */
    if(directoryId !== undefined){
      filters.push(directoryId === null ? isNull(kempoFile.directoryId) : eq(kempoFile.directoryId, directoryId));
    }
    if(kind) filters.push(eq(kempoFile.kind, kind));
    if(awaitingReview) filters.push(eq(kempoFile.trusted, false));
    if(search){
      const term = `%${search}%`;
      filters.push(or(ilike(kempoFile.name, term), ilike(kempoFile.altText, term)));
    }

    const where = filters.length ? and(...filters) : undefined;

    const rows = await db.select().from(kempoFile)
      .where(where)
      .orderBy(asc(kempoFile.kind), asc(kempoFile.name))
      .limit(limit)
      .offset(offset);

    const total = await db.select({ id: kempoFile.id }).from(kempoFile).where(where);

    return [null, { files: await withSizes(rows), total: total.length, limit, offset }];
  } catch {
    return [{ code: 500, msg: 'Could not list files' }, null];
  }
};

/*
  Most-recent-first, for the picker's default view where "what I just uploaded" is almost always
  what is wanted.
*/
export const listRecentFiles = async ({ limit = 24 } = {}) => {
  try {
    const rows = await db.select().from(kempoFile).orderBy(desc(kempoFile.createdAt)).limit(limit);
    return [null, { files: rows }];
  } catch {
    return [{ code: 500, msg: 'Could not list files' }, null];
  }
};
