import { eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory } from '../../../server/db/schema.js';
import updateDirectory from '../../../server/utils/directories/updateDirectory.js';
import { requireSession, requireOwnership } from '../../../server/utils/permissions/gate.js';

export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const { id, name, parentId } = request.body || {};
  if(!id) return response.status(400).json({ error: 'A folder id is required' });

  const [existing] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, id));
  if(!existing) return response.status(404).json({ error: 'Folder not found' });

  const [ownershipError] = await requireOwnership({
    token: session.token,
    userId: session.user.id,
    resource: 'directories',
    action: 'update',
    ownerId: existing.ownerId,
  });
  if(ownershipError) return response.status(ownershipError.code).json({ error: ownershipError.msg });

  const [error, directory] = await updateDirectory({
    id,
    name,
    parentId: parentId === undefined ? undefined : (parentId === 'root' ? null : parentId),
  });
  if(error) return response.status(error.code).json({ error: error.msg });

  response.json({ directory });
};
