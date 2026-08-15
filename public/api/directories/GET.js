import listDirectories from '../../../server/utils/directories/listDirectories.js';
import { requireSession, requirePermission } from '../../../server/utils/permissions/gate.js';

/*
  Gated by files:browse rather than a permission of its own. Navigating folders is part of browsing
  the library, not a separate capability — the same way kempo-blog has no permission for listing
  categories distinct from reading posts.
*/
export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const [permError] = await requirePermission(session.token, 'files:browse');
  if(permError) return response.status(permError.code).json({ error: permError.msg });

  const { parentId, all } = request.query;

  const [error, data] = await listDirectories({
    parentId: parentId === 'root' ? null : parentId,
    all: all === 'true',
  });
  if(error) return response.status(error.code).json({ error: error.msg });

  response.json(data);
};
