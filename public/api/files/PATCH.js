import { currentUserHasPermission } from 'kempo/server/sdk.js';
import getFile from '../../../server/utils/files/getFile.js';
import updateFile from '../../../server/utils/files/updateFile.js';
import setFileTrust from '../../../server/utils/files/setFileTrust.js';
import { requireSession, requireOwnership } from '../../../server/utils/permissions/gate.js';

/*
  Metadata only — rename, move, alt text, public flag, alias, trusted flag. Replacing the file's
  contents is a separate route with a separate permission, so that a content swap can never look
  like an alt-text edit.
*/
export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const { id, name, directoryId, altText, public: isPublic, alias, trusted } = request.body || {};
  if(!id) return response.status(400).json({ error: 'A file id is required' });

  const [lookupError, existing] = await getFile(id);
  if(lookupError) return response.status(lookupError.code).json({ error: lookupError.msg });

  const [ownershipError] = await requireOwnership({
    token: session.token,
    userId: session.user.id,
    resource: 'files',
    action: 'update',
    ownerId: existing.ownerId,
  });
  if(ownershipError) return response.status(ownershipError.code).json({ error: ownershipError.msg });

  /*
    Approving a file is layered on top of the ownership gate rather than replacing it: being
    allowed to edit a file is not the same as being allowed to say its contents are safe to run.
  */
  let trustedChange;
  if(trusted !== undefined && Boolean(trusted) !== existing.trusted){
    const [trustError, canTrust] = await currentUserHasPermission(session.token, 'files:upload_trusted');
    if(trustError) return response.status(trustError.code).json({ error: trustError.msg });
    if(!canTrust) return response.status(403).json({ error: 'You cannot change whether a file is trusted' });
    trustedChange = Boolean(trusted);
  }

  const [error, file] = await updateFile({
    id,
    name,
    directoryId,
    altText,
    public: isPublic,
    alias,
  });
  if(error) return response.status(error.code).json({ error: error.msg });

  /*
    Applied after the rest so a rejected metadata change cannot leave the trust flag altered on its
    own. updateFile deliberately has no say over trust — only this route and the replacement route
    do — which keeps every path that can change it in view.
  */
  if(trustedChange !== undefined){
    const [trustWriteError] = await setFileTrust({ id, trusted: trustedChange });
    if(trustWriteError) return response.status(trustWriteError.code).json({ error: trustWriteError.msg });
    file.trusted = trustedChange;
  }

  response.json({ file });
};
