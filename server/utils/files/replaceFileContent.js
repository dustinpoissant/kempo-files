import { writeFile } from 'fs/promises';
import { eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFile } from '../../db/schema.js';
import { filePath } from '../paths.js';

/*
  Replaces a file's bytes in place, keeping its id, name, path and every URL pointing at it.

  This is a distinct action from a metadata edit precisely so the rule below can exist. If content
  replacement were folded into the general update, then "someone changed the alt text" and
  "someone swapped out the contents of an approved script" would be the same event, and the second
  one is the entire reason the trusted flag exists.

  **Trust does not survive an untrusted writer.** Whoever performs this write either holds
  files:upload_trusted or the file drops back to untrusted and needs looking at again — regardless
  of who owns it, and regardless of whether it was trusted a moment ago. Ownership never conferred
  trust, so the check is against the person doing *this* write, not the file's history.

  Without it, approval would be permanent and transferable: get a file marked trusted once, then
  quietly replace its contents, and the site executes whatever came second.
*/
export default async ({ id, data, actorHasTrustedUpload, maxBytes }) => {
  if(!Buffer.isBuffer(data)) return [{ code: 400, msg: 'File content is required' }, null];

  const [existing] = await db.select().from(kempoFile).where(eq(kempoFile.id, id));
  if(!existing) return [{ code: 404, msg: 'File not found' }, null];

  if(maxBytes && data.length > maxBytes){
    return [{ code: 413, msg: `That file is larger than the ${Math.round(maxBytes / 1024 / 1024)}MB limit` }, null];
  }

  const [pathError, absolute] = await filePath(existing);
  if(pathError) return [pathError, null];

  try {
    await writeFile(absolute, data);
  } catch {
    return [{ code: 500, msg: 'Could not write the file' }, null];
  }

  /*
    A trusted actor keeps the flag as it was — there is no point making someone re-approve their
    own authority. Anyone else resets it, including the file's owner.
  */
  const trusted = actorHasTrustedUpload ? existing.trusted : false;

  try {
    await db.update(kempoFile)
      .set({ trusted, updatedAt: new Date() })
      .where(eq(kempoFile.id, id));
  } catch {
    return [{ code: 500, msg: 'Could not record the replacement' }, null];
  }

  return [null, { ...existing, trusted }];
};
