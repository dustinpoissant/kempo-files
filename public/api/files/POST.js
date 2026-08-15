import { getSetting, currentUserHasPermission, triggerHook } from 'kempo/server/sdk.js';
import parseMultipart, { extractBoundary } from '../../../server/utils/uploads/parseMultipart.js';
import storeUpload from '../../../server/utils/files/storeUpload.js';
import { requireSession, requirePermission } from '../../../server/utils/permissions/gate.js';

export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const [permError] = await requirePermission(session.token, 'files:upload');
  if(permError) return response.status(permError.code).json({ error: permError.msg });

  const boundary = extractBoundary(request.headers['content-type']);
  if(!boundary) return response.status(400).json({ error: 'Expected a multipart/form-data upload' });

  /*
    request.buffer() rather than request.body: for a multipart content type kempo-server hands back
    the body decoded as UTF-8, which mangles every byte of a binary file. buffer() is the only
    accessor that preserves them (kempo-server >= 3.2.0).
  */
  const raw = await request.buffer();
  const parts = parseMultipart(raw, boundary);

  const filePart = parts.find(part => part.filename);
  if(!filePart) return response.status(400).json({ error: 'No file was included in the upload' });

  const field = name => parts.find(part => part.name === name && !part.filename)?.data.toString('utf8');

  const directoryId = field('directoryId') || null;
  const altText = field('alt') || '';
  const wantsPublic = field('public') === 'true';
  const wantsTrusted = field('trusted') === 'true';

  /*
    Trust is a claim about content, so it takes its own permission on top of the upload one. Asking
    for it without holding it is refused outright rather than quietly downgraded — an uploader who
    thinks they published a working script deserves to be told they did not.
  */
  if(wantsTrusted){
    const [trustError, canTrust] = await currentUserHasPermission(session.token, 'files:upload_trusted');
    if(trustError) return response.status(trustError.code).json({ error: trustError.msg });
    if(!canTrust) return response.status(403).json({ error: 'You cannot mark files as trusted' });
  }

  /*
    Where a site says no to whole categories of upload. Nothing is refused by type here by default
    — that was the wrong tool, since this extension exists partly so an admin *can* upload a script
    — but a site with a policy has somewhere to enforce it. Handlers block by throwing { code }.
  */
  try {
    await triggerHook('file:before_upload', {
      name: filePart.filename,
      size: filePart.data.length,
      directoryId,
      uploadedBy: session.user.id,
      request,
    }, { bail: true });
  } catch(hookError) {
    return response.status(hookError?.code || 403).json({ error: hookError?.msg || 'That upload was refused' });
  }

  const [, maxUploadMb] = await getSetting('kempo-files', 'max_upload_size_mb', 250);

  const [storeError, file] = await storeUpload({
    name: filePart.filename,
    data: filePart.data,
    directoryId,
    altText,
    ownerId: session.user.id,
    trusted: wantsTrusted,
    public: wantsPublic,
    maxBytes: Number(maxUploadMb) * 1024 * 1024,
  });
  if(storeError) return response.status(storeError.code).json({ error: storeError.msg });

  /*
    Notification, not a gate — the file is already stored. A scanner-type extension picks it up
    here. Handlers are awaited in sequence, so anything slow belongs in a background job rather
    than awaited inline, or every upload waits for it.
  */
  await triggerHook('file:uploaded', { file });

  response.status(201).json({ file });
};
