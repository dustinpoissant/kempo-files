/*
  Server-side entry point, for hooks and other extensions that want to reach the file library in
  process rather than over HTTP. The browser-facing client is public/sdk.js, served at
  /kempo-files/sdk.js — same ideas, different transport.

  Note that these are the *data* operations, with no permission checks of their own: the routes are
  what enforce who may do what. Anything calling in here is already server-side code that has
  decided it is allowed.
*/

export { default as storeUpload } from './server/utils/files/storeUpload.js';
export { default as getFile, getFileByAlias } from './server/utils/files/getFile.js';
export { default as listFiles, listRecentFiles } from './server/utils/files/listFiles.js';
export { default as updateFile } from './server/utils/files/updateFile.js';
export { default as replaceFileContent } from './server/utils/files/replaceFileContent.js';
export { default as setFileTrust } from './server/utils/files/setFileTrust.js';
export { default as deleteFile } from './server/utils/files/deleteFile.js';

export { default as createDirectory } from './server/utils/directories/createDirectory.js';
export { default as listDirectories } from './server/utils/directories/listDirectories.js';
export { default as updateDirectory } from './server/utils/directories/updateDirectory.js';
export { default as deleteDirectory } from './server/utils/directories/deleteDirectory.js';

export { default as resolveDownload, headersFor } from './server/utils/serving/resolveDownload.js';

export { FILES_ROOT, directoryPath, filePath, displayPath } from './server/utils/paths.js';
export { default as sanitizeName, sanitizeAlias } from './server/utils/names/sanitizeName.js';
export { KINDS, kindForName, mimeForName, servingClass, extensionOf } from './server/utils/names/fileTypes.js';
export { default as parseMultipart, extractBoundary } from './server/utils/uploads/parseMultipart.js';
