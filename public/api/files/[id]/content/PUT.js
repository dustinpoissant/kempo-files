import { getSetting, currentUserHasPermission, triggerHook } from 'kempo/server/sdk.js';
import parseMultipart, { extractBoundary } from '../../../../../server/utils/uploads/parseMultipart.js';
import getFile from '../../../../../server/utils/files/getFile.js';
import replaceFileContent from '../../../../../server/utils/files/replaceFileContent.js';
import { requireSession, requirePermission, requireOwnership } from '../../../../../server/utils/permissions/gate.js';

/*
  Replaces a file's bytes while keeping its id, name and every URL pointing at it.

  Its own route rather than part of PATCH, because the permissions and the consequences are
  different: this needs files:upload on top of the ownership gate (replacing content is
  upload-shaped, not a field edit), and it can cost the file its trusted status. Keeping it
  separate is what makes "someone replaced the contents" a distinguishable event.
*/
export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const [lookupError, existing] = await getFile(request.params?.id);
  if(lookupError) return response.status(lookupError.code).json({ error: lookupError.msg });

  const [ownershipError] = await requireOwnership({
    token: session.token,
    userId: session.user.id,
    resource: 'files',
    action: 'update',
    ownerId: existing.ownerId,
  });
  if(ownershipError) return response.status(ownershipError.code).json({ error: ownershipError.msg });

  const [uploadError] = await requirePermission(session.token, 'files:upload');
  if(uploadError) return response.status(uploadError.code).json({ error: uploadError.msg });

  const boundary = extractBoundary(request.headers['content-type']);
  if(!boundary) return response.status(400).json({ error: 'Expected a multipart/form-data upload' });

  const raw = await request.buffer();
  const parts = parseMultipart(raw, boundary);
  const filePart = parts.find(part => part.filename);
  if(!filePart) return response.status(400).json({ error: 'No file was included' });

  try {
    await triggerHook('file:before_upload', {
      name: existing.name,
      size: filePart.data.length,
      directoryId: existing.directoryId,
      uploadedBy: session.user.id,
      replacing: existing.id,
      request,
    }, { bail: true });
  } catch(hookError) {
    return response.status(hookError?.code || 403).json({ error: hookError?.msg || 'That upload was refused' });
  }

  /*
    Whether *this* writer is trusted, not whether the file was. A file keeps its approval only if
    the person replacing its contents could have granted that approval themselves; anyone else
    sends it back for review, owner included.
  */
  const [, actorHasTrustedUpload] = await currentUserHasPermission(session.token, 'files:upload_trusted');

  const [, maxUploadMb] = await getSetting('kempo-files', 'max_upload_size_mb', 250);

  const [error, file] = await replaceFileContent({
    id: existing.id,
    data: filePart.data,
    actorHasTrustedUpload: Boolean(actorHasTrustedUpload),
    maxBytes: Number(maxUploadMb) * 1024 * 1024,
  });
  if(error) return response.status(error.code).json({ error: error.msg });

  await triggerHook('file:uploaded', { file, replaced: true });

  response.json({ file });
};
