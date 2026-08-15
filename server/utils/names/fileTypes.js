/*
  What a file is, and how dangerous it would be to hand back with its real content type.

  There is deliberately **no allowlist here**. Refusing file types was the wrong tool: this
  extension exists partly so an admin can upload a script and actually use it, and a site that
  wants to refuse `.exe` can say so in a `file:before_upload` hook. What matters is not which types
  exist but whether the browser will *run* one — and that is decided when serving, not uploading.

  Two questions are answered here:
    - `kindForName`  — the coarse bucket the library UI filters by
    - `servingClass` — whether handing this back with its real type could execute something
*/

const MIME = {
  // images
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
  tif: 'image/tiff', tiff: 'image/tiff', svg: 'image/svg+xml',

  // video
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg',
  mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',

  // audio
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav',
  flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/opus',

  // 3d models
  glb: 'model/gltf-binary', gltf: 'model/gltf+json', obj: 'model/obj',
  stl: 'model/stl', fbx: 'application/octet-stream', ply: 'model/mesh',

  // archives
  zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
  rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed',
  mcaddon: 'application/zip', mcpack: 'application/zip', mcworld: 'application/zip',

  // fonts
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', eot: 'application/vnd.ms-fontobject',

  // documents
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  epub: 'application/epub+zip',

  // text and code
  txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', log: 'text/plain',
  html: 'text/html', htm: 'text/html', xhtml: 'application/xhtml+xml',
  css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
  json: 'application/json', jsonld: 'application/ld+json',
  xml: 'application/xml', xsl: 'application/xml', xslt: 'application/xml',
  yml: 'text/yaml', yaml: 'text/yaml', toml: 'text/plain', ini: 'text/plain',
  ts: 'text/plain', tsx: 'text/plain', jsx: 'text/plain',
  py: 'text/plain', rb: 'text/plain', php: 'text/plain', pl: 'text/plain',
  sh: 'text/plain', bash: 'text/plain', ps1: 'text/plain', bat: 'text/plain',
  c: 'text/plain', h: 'text/plain', cpp: 'text/plain', cs: 'text/plain',
  java: 'text/plain', go: 'text/plain', rs: 'text/plain', sql: 'text/plain',
};

const KINDS_BY_EXTENSION = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'tif', 'tiff', 'svg'],
  video: ['mp4', 'm4v', 'webm', 'ogv', 'mov', 'avi', 'mkv'],
  audio: ['mp3', 'ogg', 'oga', 'wav', 'flac', 'm4a', 'aac', 'opus'],
  model3d: ['glb', 'gltf', 'obj', 'stl', 'fbx', 'ply'],
  archive: ['zip', 'gz', 'tar', 'rar', '7z', 'mcaddon', 'mcpack', 'mcworld'],
  font: ['woff', 'woff2', 'ttf', 'otf', 'eot'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'rtf', 'epub'],
};

const KIND_LOOKUP = Object.entries(KINDS_BY_EXTENSION).reduce((acc, [kind, extensions]) => {
  for(const extension of extensions) acc[extension] = kind;
  return acc;
}, {});

export const KINDS = [...Object.keys(KINDS_BY_EXTENSION), 'text', 'other'];

/*
  Anything the browser will parse as markup or execute as code if it is allowed to. SVG belongs
  here and not with the images: it is a document that can carry <script>, and serving one inline
  from the site's own origin is stored XSS.
*/
const EXECUTABLE_IF_TRUSTED = new Set([
  'html', 'htm', 'xhtml', 'shtml', 'svg', 'xml', 'xsl', 'xslt',
  'js', 'mjs', 'cjs', 'css', 'json', 'jsonld',
]);

/*
  Types that cannot execute by being rendered through their native handler, so an untrusted one is
  still safe to serve normally. Documents are deliberately *not* here — a PDF can carry script for
  its viewer, and an Office file can carry macros.
*/
const INERT_BINARY = new Set([
  ...KINDS_BY_EXTENSION.video,
  ...KINDS_BY_EXTENSION.audio,
  ...KINDS_BY_EXTENSION.model3d,
  ...KINDS_BY_EXTENSION.archive,
  ...KINDS_BY_EXTENSION.font,
  ...KINDS_BY_EXTENSION.image.filter(extension => extension !== 'svg'),
]);

export const extensionOf = name => {
  if(typeof name !== 'string') return '';
  const dot = name.lastIndexOf('.');
  if(dot <= 0 || dot === name.length - 1) return '';
  return name.slice(dot + 1).toLowerCase();
};

export const mimeForName = name => MIME[extensionOf(name)] || 'application/octet-stream';

export const kindForName = name => {
  const extension = extensionOf(name);
  if(KIND_LOOKUP[extension]) return KIND_LOOKUP[extension];
  return MIME[extension] ? 'text' : 'other';
};

/*
  How an *untrusted* file of this type has to be served. Trusted files always get their real type;
  this only describes what to do when nobody has vouched for the contents.

    'inert'     — safe as-is, because rendering it cannot run anything
    'as-text'   — show the source as plain text: viewable, unexecutable. This is also the review
                  mechanism, since an untrusted file's own URL displays its source safely.
    'download'  — neither safe to render nor useful as text (a PDF, an .exe, an unknown binary), so
                  it is handed back as an attachment and never rendered in place.
*/
export const servingClass = name => {
  const extension = extensionOf(name);
  if(INERT_BINARY.has(extension)) return 'inert';
  if(EXECUTABLE_IF_TRUSTED.has(extension)) return 'as-text';
  // Everything with a known text/* mime is readable source; anything else is opaque bytes.
  return MIME[extension]?.startsWith('text/') ? 'as-text' : 'download';
};
