/*
  The one validator for every name that becomes a real path segment on disk — directory names,
  filenames, and each segment of an alias.

  Names here are genuinely the user's: a file is stored as `files/<directories>/<filename>`, not
  under a generated id, because a download needs to arrive called `manual.pdf` rather than
  `a1b2c3d4.pdf`. That is the whole reason this file has to be careful — every rejection below is a
  way a name could stop meaning what the database thinks it means.

  This rejects rather than rewrites. Silently transforming a name into something legal means the
  row and the disk disagree about what the file is called, and the user is never told.
*/

const MAX_LENGTH = 255;

/*
  Reserved on Windows regardless of extension: `CON.txt` is as unusable as `CON`. Matched against
  the portion before the first dot, case-insensitively.
*/
const WINDOWS_RESERVED = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

/*
  Characters that are either path syntax or illegal on Windows. `/` and `\` are the ones that
  matter for traversal; the rest (`:` `*` `?` `"` `<` `>` `|`) would produce a name that cannot be
  created on one of the platforms this has to run on, which is a desync waiting to happen.
*/
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[/\\:*?"<>|\x00-\x1f\x7f]/;

/*
  Returns [error, name]. The name comes back exactly as given — validation never edits it.
*/
export default name => {
  if(typeof name !== 'string' || name.length === 0){
    return [{ code: 400, msg: 'A name is required' }, null];
  }

  if(name.length > MAX_LENGTH){
    return [{ code: 400, msg: `Names cannot be longer than ${MAX_LENGTH} characters` }, null];
  }

  if(ILLEGAL.test(name)){
    return [{ code: 400, msg: 'Names cannot contain / \\ : * ? " < > | or control characters' }, null];
  }

  /*
    `.` and `..` are traversal, not names. The illegal-character check above already stops a name
    from containing a separator, so these two are the only traversal forms left.
  */
  if(name === '.' || name === '..'){
    return [{ code: 400, msg: 'That name is reserved' }, null];
  }

  /*
    Windows silently strips a trailing dot or space when creating the file, so `report.` on disk
    becomes `report` while the database goes on believing otherwise — and then every later lookup
    by name misses. Rejecting is the only way the two stay in agreement.
  */
  if(/[. ]$/.test(name)){
    return [{ code: 400, msg: 'Names cannot end with a dot or a space' }, null];
  }

  if(/^ /.test(name)){
    return [{ code: 400, msg: 'Names cannot start with a space' }, null];
  }

  if(WINDOWS_RESERVED.has(name.split('.')[0].toLowerCase())){
    return [{ code: 400, msg: 'That name is reserved by the operating system' }, null];
  }

  return [null, name];
};

/*
  An alias is a whole path rather than one segment — `scripts/analytics.js` — so it is validated as
  a sequence of ordinary names. Leading and trailing slashes are tolerated and stripped, since a
  user typing `/scripts/x.js` means the same thing, but an empty segment (`a//b`) is a mistake
  worth surfacing rather than quietly collapsing.

  Returns [error, normalizedAlias].
*/
export const sanitizeAlias = (alias, fileName) => {
  if(typeof alias !== 'string'){
    return [{ code: 400, msg: 'An alias must be a string' }, null];
  }

  const trimmed = alias.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if(trimmed.length === 0){
    return [{ code: 400, msg: 'An alias cannot be empty' }, null];
  }
  if(trimmed.length > MAX_LENGTH){
    return [{ code: 400, msg: `An alias cannot be longer than ${MAX_LENGTH} characters` }, null];
  }

  const segments = trimmed.split('/');
  for(const segment of segments){
    if(segment.length === 0){
      return [{ code: 400, msg: 'An alias cannot contain an empty path segment' }, null];
    }
    const [error] = sanitizeNameSegment(segment);
    if(error) return [error, null];
  }

  /*
    An alias may choose the directory part of the URL but not the filename — `scripts/app.js` is
    allowed for `app.js`, `scripts/anything.js` is not.

    This keeps the alias honest about what it points at. Without it a `.js` file could be published
    as `photo.png`, or two files could present themselves under each other's names, and the
    extension a browser uses to decide how to treat a response would no longer match the file the
    library thinks it is serving.
  */
  if(fileName){
    const last = segments[segments.length - 1];
    if(last !== fileName){
      return [{ code: 400, msg: `An alias must end with the file's own name ("${fileName}")` }, null];
    }
  }

  return [null, segments.join('/')];
};

/*
  Named separately so sanitizeAlias can reuse the segment rules without importing its own default
  export. Kept private — callers want one of the two exported entry points.
*/
const sanitizeNameSegment = segment => {
  if(ILLEGAL.test(segment)) return [{ code: 400, msg: 'Alias segments cannot contain / \\ : * ? " < > | or control characters' }, null];
  if(segment === '.' || segment === '..') return [{ code: 400, msg: 'An alias cannot contain . or .. segments' }, null];
  if(/[. ]$/.test(segment)) return [{ code: 400, msg: 'Alias segments cannot end with a dot or a space' }, null];
  if(/^ /.test(segment)) return [{ code: 400, msg: 'Alias segments cannot start with a space' }, null];
  if(WINDOWS_RESERVED.has(segment.split('.')[0].toLowerCase())) return [{ code: 400, msg: 'An alias segment uses a name reserved by the operating system' }, null];
  return [null, segment];
};
