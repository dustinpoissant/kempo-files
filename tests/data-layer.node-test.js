import { readFile, rm, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { sql, like } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFile, kempoFileDirectory } from '../server/db/schema.js';
import createDirectory from '../server/utils/directories/createDirectory.js';
import updateDirectory from '../server/utils/directories/updateDirectory.js';
import deleteDirectory from '../server/utils/directories/deleteDirectory.js';
import storeUpload from '../server/utils/files/storeUpload.js';
import updateFile from '../server/utils/files/updateFile.js';
import replaceFileContent from '../server/utils/files/replaceFileContent.js';
import setFileTrust from '../server/utils/files/setFileTrust.js';
import listFiles from '../server/utils/files/listFiles.js';
import deleteFile from '../server/utils/files/deleteFile.js';
import { filePath, displayPath, FILES_ROOT } from '../server/utils/paths.js';

/*
  The data layer against a real database and a real filesystem.

  The cases worth having here are the destructive ones — a rename that would silently overwrite
  another file, a content swap that would keep an approval it should have lost. Those are the
  failures that do not announce themselves.

  Requires a reachable Postgres with kempo's schema and this extension's applied
  (`npx drizzle-kit push --force`). Skips itself when there is none, rather than failing.
*/

const OWNER = 'test-owner-aaaa';
const OTHER = 'test-owner-bbbb';

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const skipped = reason => ({
  'data layer (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

/*
  Everything this suite makes is named with the same prefix so cleanup can find it without
  disturbing anything else that happens to be in the database.
*/
const PREFIX = 'zz-test-';

const purge = async () => {
  await db.delete(kempoFile).where(like(kempoFile.name, `${PREFIX}%`)).catch(() => {});
  await db.delete(kempoFileDirectory).where(like(kempoFileDirectory.name, `${PREFIX}%`)).catch(() => {});
  await rm(path.join(FILES_ROOT()), { recursive: true, force: true }).catch(() => {});
  await mkdir(FILES_ROOT(), { recursive: true }).catch(() => {});
};

const upload = (name, content, extra = {}) => storeUpload({
  name: `${PREFIX}${name}`,
  data: Buffer.from(content),
  ownerId: OWNER,
  ...extra,
});

const tests = {
  'a file is stored under its real name in its real folder': async ({ pass, fail }) => {
    try {
      await purge();
      const [dirError, directory] = await createDirectory({ name: `${PREFIX}docs`, ownerId: OWNER });
      if(dirError) return fail(`createDirectory: ${dirError.msg}`);

      const [error, file] = await upload('manual.pdf', 'pretend pdf', { directoryId: directory.id });
      if(error) return fail(`storeUpload: ${error.msg}`);

      const [, absolute] = await filePath(file);
      const onDisk = await readFile(absolute, 'utf8');
      if(onDisk !== 'pretend pdf') return fail('content did not survive the round trip');
      if(!absolute.includes(`${PREFIX}docs`)) return fail(`stored outside its folder: ${absolute}`);

      const [, shown] = await displayPath(file);
      if(shown !== `${PREFIX}docs/${PREFIX}manual.pdf`) return fail(`display path was ${shown}`);
      if(file.kind !== 'document') return fail(`kind was ${file.kind}`);
      pass('stored by real name');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a colliding upload is refused rather than silently renamed': async ({ pass, fail }) => {
    try {
      await purge();
      const [firstError] = await upload('logo.png', 'first');
      if(firstError) return fail(firstError.msg);

      const [error] = await upload('logo.png', 'second');
      if(!error) return fail('a second file with the same name should have been refused');
      if(error.code !== 409) return fail(`expected 409, got ${error.code}`);

      const [, files] = [null, await db.select().from(kempoFile).where(like(kempoFile.name, `${PREFIX}%`))];
      if(files.length !== 1) return fail(`expected one row, found ${files.length}`);

      const [, absolute] = await filePath(files[0]);
      if(await readFile(absolute, 'utf8') !== 'first') return fail('the original content must be untouched');
      pass('collision refused');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'renaming a file onto an existing name destroys nothing': async ({ pass, fail }) => {
    try {
      await purge();
      /*
        The case this whole check exists for. fs.rename replaces its destination without
        complaining, so without an explicit check this would wipe victim.txt's bytes while its row
        — id, owner, trusted flag — carried on describing a file whose contents were now something
        else entirely. That is also a way to slip new content under an approved file.
      */
      const [, attacker] = await upload('attacker.txt', 'attacker content');
      const [, victim] = await upload('victim.txt', 'victim content');

      const [error] = await updateFile({ id: attacker.id, name: `${PREFIX}victim.txt` });
      if(!error) return fail('renaming onto an existing file should have been refused');
      if(error.code !== 409) return fail(`expected 409, got ${error.code}`);

      const [, victimPath] = await filePath(victim);
      if(await readFile(victimPath, 'utf8') !== 'victim content'){
        return fail('the victim file was overwritten — this is the bug this test exists for');
      }
      const [, attackerPath] = await filePath(attacker);
      if(await readFile(attackerPath, 'utf8') !== 'attacker content'){
        return fail('the source file should still be where it was');
      }
      pass('rename collision is non-destructive');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'moving a file to another folder moves the bytes with it': async ({ pass, fail }) => {
    try {
      await purge();
      const [, from] = await createDirectory({ name: `${PREFIX}from`, ownerId: OWNER });
      const [, to] = await createDirectory({ name: `${PREFIX}to`, ownerId: OWNER });
      const [, file] = await upload('moving.txt', 'contents', { directoryId: from.id });

      const [error, moved] = await updateFile({ id: file.id, directoryId: to.id });
      if(error) return fail(error.msg);

      const [, absolute] = await filePath(moved);
      if(!absolute.includes(`${PREFIX}to`)) return fail(`did not land in the destination: ${absolute}`);
      if(await readFile(absolute, 'utf8') !== 'contents') return fail('content lost in the move');
      pass('move relocates content');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a folder cannot be moved inside itself': async ({ pass, fail }) => {
    try {
      await purge();
      const [, outer] = await createDirectory({ name: `${PREFIX}outer`, ownerId: OWNER });
      const [, inner] = await createDirectory({ name: `${PREFIX}inner`, parentId: outer.id, ownerId: OWNER });

      const [selfError] = await updateDirectory({ id: outer.id, parentId: outer.id });
      if(!selfError) return fail('a folder should not be able to contain itself');

      const [descendantError] = await updateDirectory({ id: outer.id, parentId: inner.id });
      if(!descendantError) return fail('a folder should not be movable into its own descendant');
      pass('cycles refused');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a folder with anything in it will not delete': async ({ pass, fail }) => {
    try {
      await purge();
      const [, directory] = await createDirectory({ name: `${PREFIX}full`, ownerId: OWNER });
      const [, file] = await upload('inside.txt', 'x', { directoryId: directory.id });

      const [error] = await deleteDirectory({ id: directory.id });
      if(!error) return fail('a non-empty folder should not delete');
      if(error.code !== 409) return fail(`expected 409, got ${error.code}`);

      await deleteFile({ id: file.id });
      const [emptyError] = await deleteDirectory({ id: directory.id });
      if(emptyError) return fail(`should delete once empty: ${emptyError.msg}`);
      pass('non-empty folder protected');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'replacing content as an untrusted writer withdraws approval': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('approved.js', 'console.log(1)', { trusted: true });
      if(!file.trusted) return fail('setup: the file should have started trusted');

      const [error, replaced] = await replaceFileContent({
        id: file.id,
        data: Buffer.from('console.log("something else entirely")'),
        actorHasTrustedUpload: false,
      });
      if(error) return fail(error.msg);
      if(replaced.trusted) return fail('approval must not survive a replacement by an untrusted writer');

      const [, absolute] = await filePath(file);
      if(!(await readFile(absolute, 'utf8')).includes('something else')) return fail('the new content should be on disk');
      pass('trust withdrawn on untrusted replace');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'replacing content as a trusted writer keeps approval': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('approved.js', 'console.log(1)', { trusted: true });

      const [error, replaced] = await replaceFileContent({
        id: file.id,
        data: Buffer.from('console.log(2)'),
        actorHasTrustedUpload: true,
      });
      if(error) return fail(error.msg);
      if(!replaced.trusted) return fail('someone who could approve it anyway should not have to re-approve');
      pass('trust kept for a trusted writer');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'ownership is recorded so the routes can gate on it': async ({ pass, fail }) => {
    try {
      await purge();
      const [, mine] = await upload('mine.txt', 'x');
      const [, theirs] = await upload('theirs.txt', 'x', { ownerId: OTHER });
      if(mine.ownerId !== OWNER || theirs.ownerId !== OTHER) return fail('owner not recorded as given');
      pass('ownership recorded');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'an alias needs the file to be public, and goes away when it stops being': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('script.js', 'x');
      const alias = `scripts/${PREFIX}script.js`;

      const [privateError] = await updateFile({ id: file.id, alias });
      if(!privateError) return fail('a private file should not be aliasable');

      const [, madePublic] = await updateFile({ id: file.id, public: true });
      const [aliasError, aliased] = await updateFile({ id: madePublic.id, alias: `/${alias}/` });
      if(aliasError) return fail(`alias should be accepted once public: ${aliasError.msg}`);
      if(aliased.alias !== alias) return fail(`alias stored as ${aliased.alias}`);

      const [, madePrivate] = await updateFile({ id: file.id, public: false });
      if(madePrivate.alias !== null) return fail('going private must clear the alias');
      pass('alias tracks public');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'an alias must end with the file\'s own name': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('app.js', 'x', { public: true });

      /*
        The directory part is the user's to choose; the filename is not. Otherwise a .js file could
        be published as photo.png, and the extension the browser uses to decide how to treat the
        response would stop matching the file actually being served.
      */
      const [error] = await updateFile({ id: file.id, alias: 'scripts/something-else.js' });
      if(!error) return fail('an alias with a different filename should be refused');
      if(error.code !== 400) return fail(`expected 400, got ${error.code}`);

      const [wrongExtError] = await updateFile({ id: file.id, alias: `scripts/${PREFIX}app.png` });
      if(!wrongExtError) return fail('an alias may not change the extension either');

      const [ok, aliased] = await updateFile({ id: file.id, alias: `scripts/deep/${PREFIX}app.js` });
      if(ok) return fail(`a matching filename at any depth should be allowed: ${ok.msg}`);
      if(aliased.alias !== `scripts/deep/${PREFIX}app.js`) return fail(`stored as ${aliased.alias}`);
      pass('alias filename is pinned to the file');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'renaming a file carries its alias along': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('before.js', 'x', { public: true });
      await updateFile({ id: file.id, alias: `scripts/${PREFIX}before.js` });

      const [error, renamed] = await updateFile({ id: file.id, name: `${PREFIX}after.js` });
      if(error) return fail(error.msg);
      /*
        Left alone, the alias would still end in "before.js" — a name the file no longer has, which
        the rule above forbids, so every later edit of any unrelated field would start failing.
      */
      if(renamed.alias !== `scripts/${PREFIX}after.js`){
        return fail(`alias should have followed the rename, got ${renamed.alias}`);
      }
      pass('alias follows rename');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'two files cannot share an alias': async ({ pass, fail }) => {
    try {
      await purge();
      // Same filename in two folders — the only way two files can want the same alias
      const [, one] = await createDirectory({ name: `${PREFIX}one`, ownerId: OWNER });
      const [, two] = await createDirectory({ name: `${PREFIX}two`, ownerId: OWNER });
      const [, first] = await upload('shared.js', 'x', { public: true, directoryId: one.id });
      const [, second] = await upload('shared.js', 'x', { public: true, directoryId: two.id });

      const alias = `pub/${PREFIX}shared.js`;
      const [firstError] = await updateFile({ id: first.id, alias });
      if(firstError) return fail(firstError.msg);

      const [error] = await updateFile({ id: second.id, alias });
      if(!error) return fail('an alias already in use should be refused');
      if(error.code !== 409) return fail(`expected 409, got ${error.code}`);
      pass('alias uniqueness');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'an upload will not overwrite a file on disk the library does not know about': async ({ pass, fail }) => {
    try {
      await purge();
      /*
        A leftover, or something a person put there by hand. Overwriting it would destroy content
        nobody was tracking — the kind of loss discovered much later, if at all.
      */
      const stray = path.join(FILES_ROOT(), `${PREFIX}stray.txt`);
      await writeFile(stray, 'placed by hand');

      const [error] = await upload('stray.txt', 'from the upload form');
      if(!error) return fail('should refuse to write over an untracked file');
      if(await readFile(stray, 'utf8') !== 'placed by hand') return fail('the untracked file was destroyed');
      pass('untracked files protected');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'deleting a file removes both the row and the bytes': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('doomed.txt', 'x');
      const [, absolute] = await filePath(file);

      const [error] = await deleteFile({ id: file.id });
      if(error) return fail(error.msg);

      const stillThere = await readFile(absolute, 'utf8').then(() => true).catch(() => false);
      if(stillThere) return fail('the bytes should be gone');

      const rows = await db.select().from(kempoFile).where(like(kempoFile.name, `${PREFIX}doomed%`));
      if(rows.length) return fail('the row should be gone');
      pass('delete removes both');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'an unreviewable file cannot be granted trust': async ({ pass, fail }) => {
    /*
      The point of the flag. An extension storing files on a user's behalf marks them unreviewable
      precisely so that nobody — including an admin holding files:upload_trusted, working from the
      library's own screens — can approve a member's upload into something that executes on this
      site's origin.
    */
    try {
      await purge();
      const [, file] = await upload('members-upload.js', 'alert(1)', { reviewable: false });
      if(file.reviewable !== false) return fail('setup: the file should have been stored unreviewable');

      const [error] = await setFileTrust({ id: file.id, trusted: true });
      if(!error) return fail('an unreviewable file was approved');
      if(error.code !== 409) return fail(`expected a 409, got ${error.code}`);

      const [reloaded] = await db.select().from(kempoFile).where(like(kempoFile.name, `${PREFIX}members-upload%`));
      if(reloaded.trusted) return fail('the flag was written despite the refusal');
      pass('approval is refused outright');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'storing an unreviewable file ignores a trusted flag passed alongside it': async ({ pass, fail }) => {
    // The two must not be settable together at the one moment no later check would ever see.
    try {
      await purge();
      const [, file] = await upload('contradiction.js', 'x', { reviewable: false, trusted: true });
      if(file.trusted) return fail('a file was stored both unreviewable and trusted');
      pass('the contradiction resolves in favour of safety');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'withdrawing trust is still allowed on an unreviewable file': async ({ pass, fail }) => {
    /*
      Making a file *less* dangerous should never be refused — otherwise a row that reached this
      state through some path nobody anticipated could not be cleaned up.
    */
    try {
      await purge();
      const [, file] = await upload('legacy.js', 'x', { reviewable: false });
      await db.update(kempoFile).set({ trusted: true }).where(like(kempoFile.name, `${PREFIX}legacy%`));

      const [error] = await setFileTrust({ id: file.id, trusted: false });
      if(error) return fail(`withdrawing trust was refused: ${error.msg}`);

      const [reloaded] = await db.select().from(kempoFile).where(like(kempoFile.name, `${PREFIX}legacy%`));
      if(reloaded.trusted) return fail('trust was not withdrawn');
      pass('the gate is one-way');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'unreviewable files stay out of the review queue': async ({ pass, fail }) => {
    /*
      Without this, a site with a per-user file space buries its actual review work under every
      document its members ever uploaded, and the queue never reaches zero.
    */
    try {
      await purge();
      await upload('needs-looking-at.js', 'x');
      await upload('someones-document.js', 'x', { reviewable: false });

      const [error, data] = await listFiles({ awaitingReview: true, limit: 100 });
      if(error) return fail(error.msg);

      const names = data.files.map(file => file.name);
      if(!names.includes(`${PREFIX}needs-looking-at.js`)) return fail('a genuinely unreviewed file went missing from the queue');
      if(names.includes(`${PREFIX}someones-document.js`)) return fail('an unreviewable file appeared in the review queue');
      pass('the queue shows only work somebody can actually do');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'files default to reviewable, so nothing existing changes behaviour': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('ordinary.js', 'x');
      if(file.reviewable !== true) return fail('an ordinary upload should still be up for review');

      const [error] = await setFileTrust({ id: file.id, trusted: true });
      if(error) return fail(`approving an ordinary file was refused: ${error.msg}`);
      pass('the library keeps working exactly as before');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },
};

export default databaseReachable ? tests : skipped('no reachable database');
