import { eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFile } from '../../db/schema.js';

/*
  The only place trust is granted deliberately.

  Kept apart from updateFile on purpose. Trust is the one field that decides whether the server
  will hand back something the browser executes, so every route that can change it should be
  obvious from the call sites of this function — not buried among alt-text and rename handling.

  The one other way it changes is replaceFileContent, which clears it. That asymmetry is the point:
  granting trust is explicit, losing it is automatic.
*/
export default async ({ id, trusted }) => {
  /*
    A file its owning extension marked unreviewable can never be granted trust — the whole reason
    that flag exists is that the file is member-supplied and approving it would let somebody else's
    upload execute on this site's origin. Withdrawing trust stays allowed, since making a file
    *less* dangerous should never be refused.
  */
  if(trusted){
    const [existing] = await db.select().from(kempoFile).where(eq(kempoFile.id, id));
    if(!existing) return [{ code: 404, msg: 'File not found' }, null];
    if(!existing.reviewable){
      return [{ code: 409, msg: 'This file is not up for review — it was uploaded on a user\'s behalf and can never be approved to run' }, null];
    }
  }

  try {
    await db.update(kempoFile)
      .set({ trusted: Boolean(trusted), updatedAt: new Date() })
      .where(eq(kempoFile.id, id));
    return [null, { id, trusted: Boolean(trusted) }];
  } catch {
    return [{ code: 500, msg: 'Could not update the trusted flag' }, null];
  }
};
