import { getSetting, triggerHook } from 'kempo/server/sdk.js';
import storeUpload from './storeUpload.js';

/*
  storeUpload plus the hooks the upload route fires around it, for server-side code that stores a
  file on behalf of somebody and still wants the rest of the site to see it.

  The hooks live in the route rather than in storeUpload, so anything calling storeUpload directly
  skips them: nothing vetoes the upload and a listener such as kempo-thumbs never hears about the
  file. This is the one call that does both. It does not check permissions; the caller has already
  decided who may do this, the same as the rest of the SDK.

  `maxBytes` falls back to the max_upload_size_mb setting.
*/
export default async ({ request = null, maxBytes, ...upload }) => {
  try {
    await triggerHook('file:before_upload', {
      name: upload.name,
      size: upload.data?.length ?? 0,
      directoryId: upload.directoryId ?? null,
      uploadedBy: upload.ownerId,
      request,
    }, { bail: true });
  } catch(hookError) {
    return [{ code: hookError?.code || 403, msg: hookError?.msg || 'That upload was refused' }, null];
  }

  const [, maxUploadMb] = await getSetting('kempo-files', 'max_upload_size_mb', 250);

  const [error, file] = await storeUpload({ ...upload, maxBytes: maxBytes ?? Number(maxUploadMb) * 1024 * 1024 });
  if(error) return [error, null];

  await triggerHook('file:uploaded', { file });

  return [null, file];
};
