import { unlink } from 'fs/promises';
import { eq } from 'drizzle-orm';
import { triggerHook } from 'kempo/server/sdk.js';
import db from 'kempo/server/db/index.js';
import { kempoFile } from '../../db/schema.js';
import { filePath } from '../paths.js';

/*
  Removes a file from disk and from the library.

  Nothing checks whether anything links to it — see the README's non-goals. Tracking references
  across pages, posts and every extension's own content is a much larger feature than this, and
  guessing at it badly would be worse than being clear that it does not happen.
*/
export default async ({ id }) => {
  const [existing] = await db.select().from(kempoFile).where(eq(kempoFile.id, id));
  if(!existing) return [{ code: 404, msg: 'File not found' }, null];

  const [pathError, absolute] = await filePath(existing);
  if(pathError) return [pathError, null];

  /*
    Bytes first, row second. If the delete fails halfway, a row with no file behind it is a visible,
    fixable problem; a file with no row is invisible and stays on disk forever.

    ENOENT is treated as success — the file is already gone, which is the state being asked for.
  */
  try {
    await unlink(absolute);
  } catch(error) {
    if(error.code !== 'ENOENT'){
      return [{ code: 500, msg: 'Could not delete the file from disk' }, null];
    }
  }

  try {
    await db.delete(kempoFile).where(eq(kempoFile.id, id));
  } catch {
    return [{ code: 500, msg: 'Could not remove the file record' }, null];
  }

  /*
    Notification, not a gate — the file is already gone, and there is nothing left to veto. This is
    where anything that derived something *from* this file cleans up after itself: a generated
    thumbnail, a cached transcode, an index entry. Without it those outlive their source silently,
    and nothing ever comes looking for them again.

    Deliberately not `file:before_delete`. Deleting is not refusable here the way an upload or a
    download is: kempo-files has no undo, so a handler that threw would leave the bytes gone and the
    row still present.
  */
  await triggerHook('file:deleted', { file: existing });

  return [null, { id }];
};
