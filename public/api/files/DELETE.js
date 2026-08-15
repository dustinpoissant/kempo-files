import getFile from '../../../server/utils/files/getFile.js';
import deleteFile from '../../../server/utils/files/deleteFile.js';
import { requireSession, requireOwnership } from '../../../server/utils/permissions/gate.js';

export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const id = request.body?.id || request.query?.id;
  if(!id) return response.status(400).json({ error: 'A file id is required' });

  const [lookupError, existing] = await getFile(id);
  if(lookupError) return response.status(lookupError.code).json({ error: lookupError.msg });

  const [ownershipError] = await requireOwnership({
    token: session.token,
    userId: session.user.id,
    resource: 'files',
    action: 'delete',
    ownerId: existing.ownerId,
  });
  if(ownershipError) return response.status(ownershipError.code).json({ error: ownershipError.msg });

  const [error, result] = await deleteFile({ id });
  if(error) return response.status(error.code).json({ error: error.msg });

  response.json(result);
};
