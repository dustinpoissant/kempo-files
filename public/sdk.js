/*
  Browser client, served at /kempo-files/sdk.js.

  Mirrors the server SDK's names so a call reads the same on either side, and returns the same
  [error, data] tuples the rest of kempo uses, so a caller never has to remember which convention
  applies where.
*/

const BASE = '/kempo-files/api';

const request = async (path, options = {}) => {
  try {
    const response = await fetch(`${BASE}${path}`, {
      credentials: 'same-origin',
      ...options,
    });

    /*
      A download route answers with bytes, not JSON, so callers wanting the file itself use
      urlForFile below rather than coming through here.
    */
    const data = await response.json().catch(() => ({}));
    if(!response.ok) return [{ code: response.status, msg: data.error || response.statusText }, null];
    return [null, data];
  } catch(error) {
    return [{ code: 0, msg: error.message }, null];
  }
};

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const query = params => {
  const search = new URLSearchParams();
  for(const [key, value] of Object.entries(params)){
    if(value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const string = search.toString();
  return string ? `?${string}` : '';
};

/*
  Where a file is fetched from. The id URL always works; a public file that has been given an alias
  is also reachable at that bare path, which is what makes `<img src="images/logo.png">` possible.
*/
export const urlForFile = file => (file.alias ? `/${file.alias}` : apiUrlForFile(file));

/*
  The canonical API URL, which keeps working whether or not an alias exists and regardless of what
  the alias is later changed to. Worth showing alongside the alias rather than instead of it.
*/
export const apiUrlForFile = file => `${BASE}/files/${file.id}`;

export const listFiles = (params = {}) => request(`/files${query(params)}`);

export const listDirectories = (params = {}) => request(`/directories${query(params)}`);

export const createDirectory = (name, parentId = null) => request('/directories', json('POST', { name, parentId }));

export const updateDirectory = changes => request('/directories', json('PATCH', changes));

export const deleteDirectory = id => request('/directories', json('DELETE', { id }));

export const updateFile = changes => request('/files', json('PATCH', changes));

export const deleteFile = id => request('/files', json('DELETE', { id }));

export const setFileAlias = (id, alias) => request('/files', json('PATCH', { id, alias }));

/*
  Uploads go as multipart rather than JSON so the bytes are never base64'd or decoded as text on
  the way through.

  XMLHttpRequest, not fetch: fetch exposes no upload-progress event (only download progress, via
  the response body stream), so there is no way to drive a real progress bar from it without
  streaming the request body — a much newer, less consistently supported feature for something this
  simple. onProgress is optional and defaults to doing nothing, so every other call site is
  unaffected; the [error, data] tuple shape matches every other sdk function regardless.
*/
export const uploadFile = (file, { directoryId, alt, public: isPublic, trusted, onProgress } = {}) => new Promise(resolve => {
  const form = new FormData();
  form.append('file', file, file.name);
  if(directoryId) form.append('directoryId', directoryId);
  if(alt) form.append('alt', alt);
  if(isPublic) form.append('public', 'true');
  if(trusted) form.append('trusted', 'true');

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${BASE}/files`);
  xhr.withCredentials = true;

  if(onProgress){
    xhr.upload.addEventListener('progress', e => {
      if(e.lengthComputable) onProgress(e.loaded, e.total);
    });
  }

  xhr.addEventListener('load', () => {
    let data = {};
    try { data = JSON.parse(xhr.responseText); } catch { /* an empty or non-JSON body still resolves below */ }
    if(xhr.status < 200 || xhr.status >= 300) resolve([{ code: xhr.status, msg: data.error || xhr.statusText }, null]);
    else resolve([null, data]);
  });

  xhr.addEventListener('error', () => resolve([{ code: 0, msg: 'Network error' }, null]));

  xhr.send(form);
});

export const replaceFileContent = async (id, file) => {
  const form = new FormData();
  form.append('file', file, file.name);
  return request(`/files/${id}/content`, { method: 'PUT', body: form });
};
