import createDirectory from '../../../server/utils/directories/createDirectory.js';
import { requireSession, requirePermission } from '../../../server/utils/permissions/gate.js';

export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const [permError] = await requirePermission(session.token, 'directories:create');
  if(permError) return response.status(permError.code).json({ error: permError.msg });

  const { name, parentId } = request.body || {};

  const [error, directory] = await createDirectory({
    name,
    parentId: parentId === 'root' ? null : (parentId || null),
    ownerId: session.user.id,
  });
  if(error) return response.status(error.code).json({ error: error.msg });

  response.status(201).json({ directory });
};
