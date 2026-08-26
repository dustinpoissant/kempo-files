import { sql } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import install from './install.js';

/*
  Updating is the same job as installing — make sure files/ exists and is explained — plus the
  column-level migrations kempo's own declarative schema handling does not do. It only ever creates
  and drops whole tables, so a column added in a later version has to be added here.

  Every statement is IF NOT EXISTS and runs unconditionally rather than behind a version check. The
  version this ships in is decided by CI at publish time, so a check against it would be a guess;
  and these are idempotent, which is the property that actually makes an update safe to re-run.
*/
export default async () => {
  /*
    `reviewable` (added alongside kempo-user-dirs): whether approving this file is a question worth
    asking. Defaults to true, so every file that already existed keeps behaving exactly as it did —
    the flag only ever removes a file from review, and nothing had asked for that yet.
  */
  await db.execute(sql`ALTER TABLE "kempoFile" ADD COLUMN IF NOT EXISTS "reviewable" boolean NOT NULL DEFAULT true`);

  await install();
};
