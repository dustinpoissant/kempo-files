import { getFileByAlias } from '../server/utils/files/getFile.js';
import resolveDownload from '../server/utils/serving/resolveDownload.js';

/*
  Serves aliased files at bare, real-looking URLs — `<script src="scripts/analytics.js">` rather
  than an API path with an opaque id in it.

  Reached through the site's CATCH.js, which fires `route:unmatched` for any URL nothing else
  claimed. That is the whole reason no prefix is needed: by the time this runs, every real route,
  page and static file has already been ruled out, so there is nothing left to collide with.

  An alias is a second lookup key, never a second set of rules — the file goes through exactly the
  same resolveDownload gate as its id URL, including the permission check, the before_download veto
  and the trusted/untrusted serving decision. A file that is untrusted at its id URL is untrusted
  here too.
*/
export default async ({ url, draft, request }) => {
  /*
    Someone else already answered. Nothing to add, and overwriting their response would defeat the
    point of every handler getting a turn.
  */
  if(draft.handled) return;

  const alias = url.replace(/^\/+/, '');
  if(!alias) return;

  const [lookupError, file] = await getFileByAlias(alias);
  if(lookupError) return; // no alias matches — leave the draft alone so the 404 renders

  const [gateError, resolved] = await resolveDownload(file, request);
  if(gateError){
    /*
      The file exists but this visitor may not have it. Answering with the real status rather than
      falling through to the 404 keeps the alias honest: a 401 tells a signed-out visitor to sign
      in, where a 404 would say the file does not exist at all.
    */
    draft.status = gateError.code;
    draft.body = gateError.msg;
    draft.headers['Content-Type'] = 'text/plain; charset=utf-8';
    draft.handled = true;
    return;
  }

  draft.status = 200;
  draft.filePath = resolved.filePath;
  Object.assign(draft.headers, resolved.headers);
  draft.handled = true;
};
