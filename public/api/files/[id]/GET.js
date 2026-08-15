import serveStaticFile from 'kempo-server/serve-static-file';
import getFile from '../../../../server/utils/files/getFile.js';
import resolveDownload from '../../../../server/utils/serving/resolveDownload.js';

/*
  The canonical download URL. The alias route (hooks/route-unmatched.js) is a second way to reach
  this same gate, never a way around it — both call resolveDownload and neither decides anything
  on its own.

  The bytes go out through kempo-server's own file server, so a gated video seeks exactly like a
  static one: Range requests, 206 responses, streaming rather than buffering. That behaviour is why
  it is worth reusing rather than reimplementing.
*/
export default async (request, response) => {
  const [lookupError, file] = await getFile(request.params?.id);
  if(lookupError) return response.status(lookupError.code).json({ error: lookupError.msg });

  const [gateError, resolved] = await resolveDownload(file, request);
  if(gateError) return response.status(gateError.code).json({ error: gateError.msg });

  const { 'Content-Type': contentType, ...headers } = resolved.headers;
  await serveStaticFile(resolved.filePath, request, response, {}, undefined, { contentType, headers });
};
