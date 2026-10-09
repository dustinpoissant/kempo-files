import { stat } from 'fs/promises';
import { currentUserHasPermission, triggerHook } from 'kempo/server/sdk.js';
import { mimeForName, servingClass } from '../names/fileTypes.js';
import { filePath } from '../paths.js';

/*
  The single gate every download passes through, whatever URL it arrived at.

  Both the id route and the alias handler call this, which is the point: an alias is a second way
  to look a file up, never a second set of rules. If this were implemented twice, the two would
  drift and one of them would end up serving something the other would have refused.

  Returns [error, { filePath, headers, notModified }]. It never touches the response — the id route
  writes the result directly, and the alias handler copies it onto the route:unmatched draft.
*/
export default async (file, request) => {
  /*
    public means downloadable with no session at all. Permissions cannot express that:
    currentUserHasPermission answers 401 the moment there is no token, so it can only ever say
    which *authenticated* users may act, never "anyone".
  */
  if(!file.public){
    const token = request.cookies?.session_token;
    if(!token) return [{ code: 401, msg: 'Authentication required' }, null];

    const [permError, canDownload] = await currentUserHasPermission(token, 'files:download');
    if(permError) return [permError, null];
    if(!canDownload) return [{ code: 403, msg: 'Insufficient permissions' }, null];
  }

  /*
    Fires for every download, public or not, trusted or not. This is where an extension that knows
    something this one does not gets to say no — a store checking the file was paid for, a scanner
    that has not finished looking at it yet. Handlers block by throwing { code }, the same veto
    mechanism kempo uses for page guards.

    Orthogonal to `trusted`: that decides *how* an allowed download is served, never *whether*.
  */
  try {
    await triggerHook('file:before_download', { file, request }, { bail: true });
  } catch(hookError) {
    return [{ code: hookError?.code || 403, msg: hookError?.msg || 'This download is not available' }, null];
  }

  const [pathError, absolute] = await filePath(file);
  if(pathError) return [pathError, null];

  /*
    Validators and a cache lifetime, so a page full of thumbnails is not refetched on every visit.
    This runs after the gate, never instead of it: a 304 is only ever answered to somebody the gate
    already let through, and a file that stops being public stops answering at all.

    A public file may be cached by anyone for an hour. Anything else is marked private, and has to
    revalidate each time so a shared cache can never hand it to somebody the gate would refuse.
    Replacing a file's contents changes its validators, so the worst a stale public copy can do is
    outlive a replacement by that hour.
  */
  const headers = headersFor(file);
  headers['Cache-Control'] = file.public ? 'public, max-age=3600' : 'private, no-cache';

  let notModified = false;
  try {
    const { size, mtime } = await stat(absolute);
    const etag = `W/"${size.toString(16)}-${Math.floor(mtime.getTime()).toString(16)}"`;
    headers.ETag = etag;
    headers['Last-Modified'] = mtime.toUTCString();

    const ifNoneMatch = request.headers?.['if-none-match'];
    const ifModifiedSince = Date.parse(request.headers?.['if-modified-since']);
    notModified = ifNoneMatch
      ? ifNoneMatch.split(',').map(tag => tag.trim()).some(tag => tag === etag || tag === '*')
      : Number.isFinite(ifModifiedSince) && Math.floor(mtime.getTime() / 1000) <= Math.floor(ifModifiedSince / 1000);
  } catch {
    // Missing from disk: serving it fails the same way it always did, just without validators
  }

  return [null, { filePath: absolute, headers, notModified }];
};

/*
  What a file is allowed to be, on the way out.

  The risk was never that a JS file exists — an admin can already put a <script> tag straight into
  a page. It is that the server hands back an executable response with nobody having decided that
  was alright. `trusted` records that somebody with files:upload_trusted did decide it.
*/
export const headersFor = file => {
  const realType = mimeForName(file.name);

  /*
    An unreviewable file is never served as its real executable type, whatever its trusted flag
    says. Every write path already refuses to set the two together, so this is the backstop for the
    cases no write path saw: a row edited straight in the database, a restore from a backup taken
    before the flag existed, a future code path that forgets. The guarantee is only worth anything
    if it holds at the response, which is the one place it actually matters.
  */
  if(file.trusted && file.reviewable !== false){
    /*
      Vouched for: served as what it is, so a script referenced with <script src> actually runs.
      kempo-server's own default security headers send every response out as X-Frame-Options: DENY,
      which also blocks a trusted PDF from rendering in the admin's own same-origin preview iframe —
      a stricter rule than the one already granted here (trusted content may execute; being framed
      by this same site is a smaller allowance than that). SAMEORIGIN keeps third-party clickjacking
      protection intact and only relaxes the same-site case.
    */
    return { 'Content-Type': realType, 'X-Frame-Options': 'SAMEORIGIN' };
  }

  switch(servingClass(file.name)){
    /*
      Readable source, served as text. Viewable but impossible to execute or render as markup
      however it is referenced — which is also the review mechanism: an untrusted file's own URL
      shows its source safely, so no separate code viewer is needed.
    */
    case 'as-text':
      return {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      };

    /*
      Opaque bytes that are neither safe to render nor useful as text — a PDF (its viewer runs
      script), an Office file (macros), anything unrecognised. Handed over as a download rather
      than rendered in place.
    */
    case 'download':
      return {
        'Content-Type': 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      };

    /*
      Images (except SVG), video, audio, archives, fonts, 3D models: rendering these through their
      native handler cannot run anything, so an unreviewed one is still safe as itself.
    */
    default:
      return { 'Content-Type': realType, 'X-Content-Type-Options': 'nosniff' };
  }
};
