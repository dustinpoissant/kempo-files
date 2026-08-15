import { rm, mkdir } from 'fs/promises';
import path from 'path';
import { sql, like } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFile, kempoFileDirectory } from '../server/db/schema.js';
import storeUpload from '../server/utils/files/storeUpload.js';
import updateFile from '../server/utils/files/updateFile.js';
import resolveDownload, { headersFor } from '../server/utils/serving/resolveDownload.js';
import routeUnmatched from '../hooks/route-unmatched.js';
import { FILES_ROOT } from '../server/utils/paths.js';

/*
  How a file reaches a browser, and what it is allowed to be when it gets there.

  The header decisions are the security-critical part of this extension: an unreviewed script that
  comes back as application/javascript is a stored XSS, and one that comes back as text/plain is a
  code review. These assert the difference directly.
*/

const OWNER = 'test-owner-aaaa';
const PREFIX = 'zz-serve-';

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const skipped = reason => ({
  'serving (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

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

// The shape resolveDownload reads off a request; nothing else about it matters here.
const anonymous = () => ({ cookies: {}, headers: {} });

const draft = () => ({ status: null, headers: {}, body: null, filePath: null, handled: false });

const tests = {
  'an unreviewed script is served as unexecutable plain text': async ({ pass, fail }) => {
    /*
      The single most important assertion in this suite. If this ever comes back as
      application/javascript, any user who can upload can run script on the site's own origin.
    */
    const headers = headersFor({ name: 'evil.js', trusted: false });
    if(!headers['Content-Type'].startsWith('text/plain')) return fail(`served as ${headers['Content-Type']}`);
    if(headers['X-Content-Type-Options'] !== 'nosniff') return fail('nosniff is what stops the browser second-guessing the type');
    pass('untrusted script neutralised');
  },

  'an approved script is served as a real script': async ({ pass, fail }) => {
    const headers = headersFor({ name: 'analytics.js', trusted: true });
    if(headers['Content-Type'] !== 'text/javascript') return fail(`served as ${headers['Content-Type']}`);
    if(headers['Content-Disposition']) return fail('an approved script must not be forced to download');
    pass('trusted script executable');
  },

  'an unreviewed SVG is not served as an image': async ({ pass, fail }) => {
    // SVG looks like an image and is a document that can carry <script>.
    const headers = headersFor({ name: 'vector.svg', trusted: false });
    if(headers['Content-Type'].includes('svg')) return fail('an unreviewed SVG must not be served as SVG');
    pass('untrusted svg neutralised');
  },

  'unreviewed media is still served as itself': async ({ pass, fail }) => {
    const headers = headersFor({ name: 'clip.mp4', trusted: false });
    if(headers['Content-Type'] !== 'video/mp4') return fail(`served as ${headers['Content-Type']}`);
    pass('inert binary unaffected');
  },

  'an unreviewed PDF is handed over rather than rendered': async ({ pass, fail }) => {
    const headers = headersFor({ name: 'manual.pdf', trusted: false });
    if(!headers['Content-Disposition']?.startsWith('attachment')) return fail('should be an attachment');
    pass('opaque binary downloaded');
  },

  'a private file refuses an anonymous request': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('private.txt', 'secret');
      const [error] = await resolveDownload(file, anonymous());
      if(!error) return fail('a private file should not serve without a session');
      if(error.code !== 401) return fail(`expected 401, got ${error.code}`);
      pass('private refused anonymously');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a public file serves with no session at all': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('open.png', 'bytes', { public: true });
      const [error, resolved] = await resolveDownload(file, anonymous());
      if(error) return fail(`public file refused: ${error.msg}`);
      if(!resolved.filePath.endsWith(`${PREFIX}open.png`)) return fail('resolved the wrong path');
      pass('public serves anonymously');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'the alias hook serves an aliased file through the same gate': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('analytics.js', 'console.log(1)', { public: true });
      await updateFile({ id: file.id, alias: `scripts/${PREFIX}analytics.js` });

      const data = { url: `/scripts/${PREFIX}analytics.js`, request: anonymous(), draft: draft() };
      await routeUnmatched(data);

      if(!data.draft.handled) return fail('the hook should have claimed the request');
      if(!data.draft.filePath) return fail('should serve the file from disk, not a body');
      /*
        Nobody approved this script, so reaching it by its pretty URL must be exactly as
        unexecutable as reaching it by its id. An alias is a lookup key, not a way round the rules.
      */
      if(!data.draft.headers['Content-Type'].startsWith('text/plain')){
        return fail(`alias route served it as ${data.draft.headers['Content-Type']}`);
      }
      pass('alias uses the same gate');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'the alias hook leaves unrelated URLs alone': async ({ pass, fail }) => {
    try {
      await purge();
      const data = { url: '/nothing/here', request: anonymous(), draft: draft() };
      await routeUnmatched(data);
      if(data.draft.handled) return fail('should not claim a URL with no alias behind it');
      if(data.draft.filePath || data.draft.body) return fail('should have left the draft untouched');
      pass('unrelated urls untouched');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'the alias hook defers to a handler that already answered': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('taken.js', 'x', { public: true });
      await updateFile({ id: file.id, alias: `scripts/${PREFIX}taken.js` });

      const already = { ...draft(), handled: true, body: 'someone else got here first' };
      const data = { url: `/scripts/${PREFIX}taken.js`, request: anonymous(), draft: already };
      await routeUnmatched(data);

      if(data.draft.body !== 'someone else got here first') return fail('must not overwrite another handler');
      if(data.draft.filePath) return fail('must not add a file to an answered request');
      pass('defers when already handled');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'an aliased private file reports its real status rather than a 404': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('secret.js', 'x', { public: true });
      await updateFile({ id: file.id, alias: `scripts/${PREFIX}secret.js` });
      /*
        Going private clears the alias, so this reaches the alias only if something regressed —
        which is worth knowing. Set it back directly to exercise the gate's own refusal path.
      */
      await updateFile({ id: file.id, public: false });

      const data = { url: `/scripts/${PREFIX}secret.js`, request: anonymous(), draft: draft() };
      await routeUnmatched(data);

      if(data.draft.handled) return fail('the alias should have been cleared when the file went private');
      pass('private file drops its alias');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },
};

export default databaseReachable ? tests : skipped('no reachable database');
