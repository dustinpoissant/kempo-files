/*
  A minimal multipart/form-data parser, working entirely on Buffers.

  Nothing in kempo or kempo-server parses multipart, and the usual dependency for it (busboy and
  friends) is built around streaming a body that is still arriving. kempo-server buffers the whole
  body before a route ever runs, so there is no stream left to consume by then and none of that
  machinery earns its keep. This handles the shape an upload form actually sends — file parts plus
  a few text fields — and nothing else.

  Every offset is found with Buffer.indexOf and every slice stays a Buffer, so file content is
  never decoded. Decoding it as UTF-8 is precisely the corruption kempo-server 3.2.0 fixed, and
  doing it here would reintroduce it one layer up.
*/

const CRLF = Buffer.from('\r\n');
const CRLF_CRLF = Buffer.from('\r\n\r\n');
const DASH_DASH = Buffer.from('--');

/*
  `multipart/form-data; boundary=----WebKitFormBoundaryAbC123`, optionally quoted. Returns null when
  the header is absent or is not multipart, which the caller turns into a 400.
*/
export const extractBoundary = contentType => {
  if(!contentType || !contentType.toLowerCase().includes('multipart/form-data')) return null;
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  return match ? (match[1] || match[2]) : null;
};

const parseHeaders = raw => {
  const headers = {};
  for(const line of raw.split('\r\n')){
    const colon = line.indexOf(':');
    if(colon === -1) continue;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return headers;
};

// name="field"; filename="photo.png" — filename is absent on plain text fields
const quoted = (source, key) => {
  const match = source.match(new RegExp(`${key}="([^"]*)"`, 'i'));
  return match ? match[1] : null;
};

/*
  Returns [{ name, filename, contentType, data }], where `data` is always a Buffer. Parts without a
  Content-Disposition name are skipped rather than treated as an error, since a stray part should
  not fail an otherwise valid upload.
*/
export default (buffer, boundary) => {
  if(!Buffer.isBuffer(buffer) || !boundary) return [];

  const delimiter = Buffer.from(`\r\n--${boundary}`);
  /*
    The opening boundary is at the very start of the body with no CRLF before it, unlike every
    later one. Prefixing a CRLF makes all of them identical so a single search handles the lot.
  */
  const body = Buffer.concat([CRLF, buffer]);

  const parts = [];
  let index = body.indexOf(delimiter);

  while(index !== -1){
    const afterBoundary = index + delimiter.length;

    // A boundary followed by "--" is the closing delimiter; anything after it is epilogue
    if(body.subarray(afterBoundary, afterBoundary + 2).equals(DASH_DASH)) break;

    const next = body.indexOf(delimiter, afterBoundary);
    if(next === -1) break; // truncated body — drop the trailing fragment rather than guess at it

    // The boundary line may carry trailing whitespace before its CRLF
    const lineEnd = body.indexOf(CRLF, afterBoundary);
    if(lineEnd === -1 || lineEnd > next) break;

    const headerEnd = body.indexOf(CRLF_CRLF, lineEnd);
    if(headerEnd === -1 || headerEnd > next){
      index = next;
      continue; // no header block — not a part worth keeping
    }

    const headers = parseHeaders(body.subarray(lineEnd + CRLF.length, headerEnd).toString('utf8'));
    const disposition = headers['content-disposition'] || '';
    const name = quoted(disposition, 'name');

    if(name !== null){
      parts.push({
        name,
        filename: quoted(disposition, 'filename'),
        contentType: headers['content-type'] || null,
        data: body.subarray(headerEnd + CRLF_CRLF.length, next)
      });
    }

    index = next;
  }

  return parts;
};
