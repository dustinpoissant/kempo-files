import { rm, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { sql, like, eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { hook } from 'kempo/server/db/schema.js';
import { clearHandlerCache } from 'kempo/server/utils/hooks/triggerHook.js';
import createHook from 'kempo/server/utils/hooks/createHook.js';
import { kempoFile } from '../server/db/schema.js';
import storeUpload from '../server/utils/files/storeUpload.js';
import uploadFile from '../server/utils/files/uploadFile.js';
import resolveDownload from '../server/utils/serving/resolveDownload.js';
import updateFile from '../server/utils/files/updateFile.js';
import routeUnmatched from '../hooks/route-unmatched.js';
import { FILES_ROOT } from '../server/utils/paths.js';

/*
  What a public file looks like on the wire, and the SDK entry point that stores one with its hooks.

  The media library serves product photos, galleries and video out of this extension, so what has to
  hold is that a public file needs no login, seeks like a static one, carries a cache lifetime, and
  answers a conditional request with a 304 instead of the bytes. The id route is driven directly
  with a recording response; its range handling is kempo-server's own, which is the point of
  asserting it still arrives intact.
*/

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'test-owner-delivery';
const PREFIX = 'zz-delivery-';
const HOOK_DIR = path.join(root, 'tests', '.tmp-delivery-hooks');

const databaseReachable = await db.execute(sql`select 1`).then(() => true).catch(() => false);

const skipped = reason => ({
  'delivery (SKIPPED)': async ({ pass }) => pass(`skipped: ${reason}`),
});

const purge = async () => {
  await db.delete(kempoFile).where(like(kempoFile.name, `${PREFIX}%`)).catch(() => {});
  await db.delete(hook).where(eq(hook.owner, 'delivery-test')).catch(() => {});
  clearHandlerCache();
  await rm(HOOK_DIR, { recursive: true, force: true }).catch(() => {});
  await rm(FILES_ROOT(), { recursive: true, force: true }).catch(() => {});
  await mkdir(FILES_ROOT(), { recursive: true }).catch(() => {});
};

const upload = (name, content, extra = {}) => storeUpload({
  name: `${PREFIX}${name}`,
  data: Buffer.isBuffer(content) ? content : Buffer.from(content),
  ownerId: OWNER,
  ...extra,
});

const request = (headers = {}) => ({ cookies: {}, headers });

const recordingResponse = () => {
  const recorded = { status: null, headers: {}, chunks: [], ended: false, json: null };
  return {
    recorded,
    writeHead: (status, headers) => { recorded.status = status; recorded.headers = headers; },
    write: chunk => { recorded.chunks.push(Buffer.from(chunk)); },
    end: chunk => { if(chunk) recorded.chunks.push(Buffer.from(chunk)); recorded.ended = true; },
    status: code => ({ json: body => { recorded.status = code; recorded.json = body; } }),
  };
};

const downloadRoute = (await import(pathToFileURL(path.join(root, 'public', 'api', 'files', '[id]', 'GET.js')).href)).default;

const serve = async (file, headers = {}) => {
  const response = recordingResponse();
  await downloadRoute({ params: { id: file.id }, cookies: {}, headers }, response);
  return { ...response.recorded, body: Buffer.concat(response.recorded.chunks) };
};

const tests = {
  'a public file is served with no session, seeks by range and carries its content type': async ({ pass, fail }) => {
    try {
      await purge();
      const bytes = Buffer.from('0123456789abcdefghij');
      const [, file] = await upload('clip.mp4', bytes, { public: true });

      const whole = await serve(file);
      if(whole.status !== 200) return fail(`anonymous GET of a public file answered ${whole.status}`);
      if(!whole.body.equals(bytes)) return fail('the body did not arrive intact');
      if(whole.headers['Content-Type'] !== 'video/mp4') return fail(`served as ${whole.headers['Content-Type']}`);
      if(whole.headers['Accept-Ranges'] !== 'bytes') return fail('should advertise range support');

      const part = await serve(file, { range: 'bytes=5-9' });
      if(part.status !== 206) return fail(`a range request answered ${part.status}, not 206`);
      if(part.headers['Content-Range'] !== 'bytes 5-9/20') return fail(`Content-Range was ${part.headers['Content-Range']}`);
      if(part.body.toString() !== '56789') return fail(`range body was ${part.body.toString()}`);

      const tail = await serve(file, { range: 'bytes=-4' });
      if(tail.status !== 206 || tail.body.toString() !== 'ghij') return fail('a suffix range should return the last bytes');

      const unsatisfiable = await serve(file, { range: 'bytes=500-600' });
      if(unsatisfiable.status !== 416) return fail(`an out-of-range request answered ${unsatisfiable.status}, not 416`);
      pass('public, seekable, typed');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a private file still refuses an anonymous request on the real route': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('private.png', 'x', { public: false });
      const response = await serve(file);
      if(response.status !== 401) return fail(`expected 401, got ${response.status}`);
      pass('private refused');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a public file may be cached by anyone for a bounded time': async ({ pass, fail }) => {
    try {
      await purge();
      const [, open] = await upload('open.png', 'x', { public: true });
      const [, resolved] = await resolveDownload(open, request());
      if(!/^public, max-age=\d+$/.test(resolved.headers['Cache-Control'])) return fail(`Cache-Control was ${resolved.headers['Cache-Control']}`);
      pass('cacheable');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a conditional request is answered 304 with no body, and changed bytes are sent again': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('logo.png', 'first version', { public: true });

      const first = await serve(file);
      const etag = first.headers.ETag;
      if(!etag) return fail('a served file should carry an ETag');
      if(!first.headers['Last-Modified']) return fail('a served file should carry Last-Modified');

      const byTag = await serve(file, { 'if-none-match': etag });
      if(byTag.status !== 304) return fail(`If-None-Match answered ${byTag.status}`);
      if(byTag.body.length) return fail('a 304 must not carry a body');
      if(!byTag.headers.ETag) return fail('a 304 should repeat the validators');

      const bySince = await serve(file, { 'if-modified-since': first.headers['Last-Modified'] });
      if(bySince.status !== 304) return fail(`If-Modified-Since answered ${bySince.status}`);

      const stale = await serve(file, { 'if-none-match': 'W/"nope"' });
      if(stale.status !== 200) return fail(`a non-matching tag answered ${stale.status}`);

      // Different bytes mean a different size, so the old tag no longer validates
      await writeFile(path.join(FILES_ROOT(), file.name), 'a considerably longer second version');
      const changed = await serve(file, { 'if-none-match': etag });
      if(changed.status !== 200) return fail(`changed bytes answered ${changed.status} against the old tag`);
      pass('304 on a match, 200 on a change');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'a 304 is never answered to somebody the gate refuses': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('hidden.png', 'x');
      const open = await resolveDownload({ ...file, public: true }, request());
      const etag = open[1].headers.ETag;

      const response = await serve(file, { 'if-none-match': etag });
      if(response.status !== 401) return fail(`a private file with a matching tag answered ${response.status}, not 401`);
      pass('the gate runs before the validators');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'an aliased public file revalidates through the alias too': async ({ pass, fail }) => {
    try {
      await purge();
      const [, file] = await upload('banner.png', 'banner', { public: true });
      await updateFile({ id: file.id, alias: `images/${PREFIX}banner.png` });

      const fresh = { url: `/images/${PREFIX}banner.png`, request: request(), draft: { status: null, headers: {}, body: null, filePath: null, handled: false } };
      await routeUnmatched(fresh);
      if(fresh.draft.status !== 200 || !fresh.draft.filePath) return fail('the alias should serve the file');
      if(!fresh.draft.headers.ETag) return fail('the alias response should carry an ETag');

      const conditional = {
        url: `/images/${PREFIX}banner.png`,
        request: request({ 'if-none-match': fresh.draft.headers.ETag }),
        draft: { status: null, headers: {}, body: null, filePath: null, handled: false },
      };
      await routeUnmatched(conditional);
      if(conditional.draft.status !== 304) return fail(`alias answered ${conditional.draft.status}`);
      if(conditional.draft.filePath || conditional.draft.body) return fail('a 304 should have neither a file nor a body');
      pass('alias 304');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'storeUpload keeps an id it is given, and refuses one that is taken or malformed': async ({ pass, fail }) => {
    try {
      await purge();
      const [error, file] = await upload('chosen.png', 'x', { id: 'abcdef0123456789' });
      if(error) return fail(error.msg);
      if(file.id !== 'abcdef0123456789') return fail(`id was ${file.id}`);

      const [taken] = await upload('other.png', 'x', { id: 'abcdef0123456789' });
      if(taken?.code !== 409) return fail(`a taken id answered ${taken?.code}`);

      const [bad] = await upload('bad.png', 'x', { id: '../escape' });
      if(bad?.code !== 400) return fail(`a malformed id answered ${bad?.code}`);

      const [, generated] = await upload('plain.png', 'x');
      if(!/^[0-9a-f]{16}$/.test(generated.id)) return fail('without an id one is still generated');
      pass('caller-chosen ids');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },

  'uploadFile fires file:before_upload to veto and file:uploaded to notify, through real hooks': async ({ pass, fail }) => {
    try {
      await purge();
      await mkdir(HOOK_DIR, { recursive: true });
      const log = `globalThis.deliveryHookLog ??= [];`;
      await writeFile(path.join(HOOK_DIR, 'before.js'), `${log}\nexport default ({ name, size, uploadedBy }) => {\n  globalThis.deliveryHookLog.push(['before', name, size, uploadedBy]);\n  if(name.endsWith('.exe')) throw { code: 415, msg: 'No executables' };\n};\n`);
      await writeFile(path.join(HOOK_DIR, 'after.js'), `${log}\nexport default ({ file }) => {\n  globalThis.deliveryHookLog.push(['after', file.name, file.id]);\n};\n`);
      await createHook({ owner: 'delivery-test', event: 'file:before_upload', callback: path.join(HOOK_DIR, 'before.js') });
      await createHook({ owner: 'delivery-test', event: 'file:uploaded', callback: path.join(HOOK_DIR, 'after.js') });
      clearHandlerCache();
      globalThis.deliveryHookLog = [];

      const [error, file] = await uploadFile({ name: `${PREFIX}ok.png`, data: Buffer.from('abc'), ownerId: OWNER, public: true });
      if(error) return fail(error.msg);
      const kinds = globalThis.deliveryHookLog.map(entry => entry[0]);
      if(kinds.join() !== 'before,after') return fail(`hooks fired as ${kinds.join() || 'nothing'}`);
      if(globalThis.deliveryHookLog[0][2] !== 3 || globalThis.deliveryHookLog[0][3] !== OWNER) return fail('the before hook should see the size and uploader');
      if(globalThis.deliveryHookLog[1][2] !== file.id) return fail('the after hook should see the stored row');

      globalThis.deliveryHookLog = [];
      const [refusal, refused] = await uploadFile({ name: `${PREFIX}bad.exe`, data: Buffer.from('abc'), ownerId: OWNER });
      if(refused || refusal?.code !== 415) return fail(`a vetoed upload answered ${JSON.stringify(refusal)}`);
      if(globalThis.deliveryHookLog.some(entry => entry[0] === 'after')) return fail('a vetoed upload must not announce itself');
      const [still] = await db.select().from(kempoFile).where(eq(kempoFile.name, `${PREFIX}bad.exe`));
      if(still) return fail('a vetoed upload should store nothing');
      pass('hooks around uploadFile');
    } catch(e){ fail(e.message); } finally { delete globalThis.deliveryHookLog; await purge(); }
  },

  'uploadFile enforces the size limit from the setting unless told otherwise': async ({ pass, fail }) => {
    try {
      await purge();
      const [error] = await uploadFile({ name: `${PREFIX}big.png`, data: Buffer.alloc(2048), ownerId: OWNER, maxBytes: 1024 });
      if(error?.code !== 413) return fail(`expected 413, got ${error?.code}`);
      pass('size limit');
    } catch(e){ fail(e.message); } finally { await purge(); }
  },
};

export default databaseReachable ? tests : skipped('no reachable database');
