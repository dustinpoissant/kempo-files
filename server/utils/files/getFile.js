import { eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFile } from '../../db/schema.js';

export default async id => {
  if(!id) return [{ code: 400, msg: 'A file id is required' }, null];

  try {
    const [row] = await db.select().from(kempoFile).where(eq(kempoFile.id, id));
    if(!row) return [{ code: 404, msg: 'File not found' }, null];
    return [null, row];
  } catch {
    return [{ code: 500, msg: 'Could not load the file' }, null];
  }
};

/*
  The alias lookup behind the route:unmatched handler. Separate from the id lookup so the handler
  cannot accidentally resolve an id typed into the URL bar as though it were an alias.
*/
export const getFileByAlias = async alias => {
  if(!alias) return [{ code: 400, msg: 'An alias is required' }, null];

  try {
    const [row] = await db.select().from(kempoFile).where(eq(kempoFile.alias, alias));
    if(!row) return [{ code: 404, msg: 'File not found' }, null];
    return [null, row];
  } catch {
    return [{ code: 500, msg: 'Could not load the file' }, null];
  }
};
