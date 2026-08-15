import { eq } from 'drizzle-orm';
import db from 'kempo/server/db/index.js';
import { kempoFileDirectory } from '../../../server/db/schema.js';
import deleteDirectory from '../../../server/utils/directories/deleteDirectory.js';
import { requireSession, requireOwnership } from '../../../server/utils/permissions/gate.js';

export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const id = request.body?.id || request.query?.id;
  if(!id) return response.status(400).json({ error: 'A folder id is required' });

  const [existing] = await db.select().from(kempoFileDirectory).where(eq(kempoFileDirectory.id, id));
  if(!existing) return response.status(404).json({ error: 'Folder not found' });

  const [ownershipError] = await requireOwnership({
    token: session.token,
    userId: session.user.id,
    resource: 'directories',
    action: 'delete',
    ownerId: existing.ownerId,
  });
  if(ownershipError) return response.status(ownershipError.code).json({ error: ownershipError.msg });

  const [error, result] = await deleteDirectory({ id });
  if(error) return response.status(error.code).json({ error: error.msg });

  response.json(result);
};
