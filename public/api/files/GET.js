import listFiles from '../../../server/utils/files/listFiles.js';
import { displayPath } from '../../../server/utils/paths.js';
import { requireSession, requirePermission } from '../../../server/utils/permissions/gate.js';

/*
  Browsing is gated even though many of the files listed may be public individually: the listing is
  what exposes the whole library at once, including files nobody has linked to yet.
*/
export default async (request, response) => {
  const [sessionError, session] = await requireSession(request);
  if(sessionError) return response.status(sessionError.code).json({ error: sessionError.msg });

  const [permError] = await requirePermission(session.token, 'files:browse');
  if(permError) return response.status(permError.code).json({ error: permError.msg });

  const { directoryId, kind, search, awaitingReview, limit, offset } = request.query;

  const [error, data] = await listFiles({
    /*
      Absent means "anywhere" (the picker searching the whole library); the literal string 'root'
      means the root folder. Without the distinction, root cannot be listed.
    */
    directoryId: directoryId === undefined ? undefined : (directoryId === 'root' ? null : directoryId),
    kind,
    search,
    awaitingReview: awaitingReview === 'true',
    limit: parseInt(limit, 10) || 24,
    offset: parseInt(offset, 10) || 0,
  });
  if(error) return response.status(error.code).json({ error: error.msg });

  /*
    The path is derived rather than stored, so it is assembled here for display. Doing it in the
    route rather than the data layer keeps the stored row honest about what it actually knows.
  */
  const files = [];
  for(const file of data.files){
    const [, path] = await displayPath(file);
    files.push({ ...file, path });
  }

  response.json({ ...data, files });
};
