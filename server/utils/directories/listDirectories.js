import { asc, eq, isNull } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory } from '../../db/schema.js';

/*
  Folders, either for one parent or the whole tree.

  The admin library asks for the whole tree once and builds its breadcrumb from the parentId chain
  client-side, which is cheaper than a request per level and keeps "move to…" able to show every
  destination without further round trips.
*/
export default async ({ parentId, all = false } = {}) => {
  try {
    const query = db.select().from(kempoFileDirectory);

    const rows = all
      ? await query.orderBy(asc(kempoFileDirectory.name))
      : await query
          .where(parentId ? eq(kempoFileDirectory.parentId, parentId) : isNull(kempoFileDirectory.parentId))
          .orderBy(asc(kempoFileDirectory.name));

    return [null, { directories: rows }];
  } catch {
    return [{ code: 500, msg: 'Could not list folders' }, null];
  }
};
