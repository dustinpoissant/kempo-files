import '../../public/components/FilesUpload.js';

export const page = './upload-test-page.html';

const create = async (attrs = '', uploader = null) => {
  const container = document.createElement('div');
  container.innerHTML = `<k-files-upload ${attrs}></k-files-upload>`;
  document.body.appendChild(container);
  const el = container.querySelector('k-files-upload');
  if(uploader) el.uploader = uploader;
  await el.updateComplete;
  return { container, el };
};

const cleanup = container => container?.parentNode?.removeChild(container);

const file = (name, type = 'image/png') => new File(['x'], name, { type });

const choose = (el, files, rejected = []) => el.shadowRoot.querySelector('k-dropzone').dispatchEvent(new CustomEvent('files', { detail: { files, rejected }, bubbles: true, composed: true }));

const settle = async el => {
  await new Promise(resolve => setTimeout(resolve, 50));
  await el.updateComplete;
};

const listen = (el, name) => {
  const seen = [];
  el.addEventListener(name, event => seen.push(event.detail));
  return seen;
};

export default {
  'passes what it was given to the dropzone': async ({ pass, fail }) => {
    const { container, el } = await create('multiple accept="image/*" label="Drop here" disabled');
    const zone = el.shadowRoot.querySelector('k-dropzone');
    const seen = { accept: zone.accept, multiple: zone.multiple, label: zone.label, disabled: zone.disabled };
    cleanup(container);
    if(seen.accept !== 'image/*' || !seen.multiple || seen.label !== 'Drop here' || !seen.disabled) return fail(JSON.stringify(seen));
    pass('');
  },

  'uploads each file in order with its uploader and reports each as uploaded': async ({ pass, fail }) => {
    const sent = [];
    const { container, el } = await create('multiple', async (item, report) => {
      sent.push(item.name);
      report(1);
      return [null, { id: `id-${item.name}` }];
    });
    const uploaded = listen(el, 'uploaded');
    choose(el, [file('a.png'), file('b.png')]);
    await settle(el);
    const rows = el.shadowRoot.querySelectorAll('.entry').length;
    cleanup(container);
    if(sent.join() !== 'a.png,b.png') return fail(`Sent ${sent}`);
    if(uploaded.map(item => item.result.id).join() !== 'id-a.png,id-b.png') return fail(JSON.stringify(uploaded.map(item => item.result)));
    if(uploaded[0].file.name !== 'a.png') return fail('The file should be reported with its result');
    if(rows) return fail('Finished files should leave no rows behind');
    pass('');
  },

  'shows how far a file has gone': async ({ pass, fail }) => {
    let release;
    const { container, el } = await create('', (item, report) => new Promise(resolve => {
      report(0.5);
      release = () => resolve([null, {}]);
    }));
    choose(el, [file('big.mp4', 'video/mp4')]);
    await settle(el);
    const bar = el.shadowRoot.querySelector('k-progress');
    const percentage = bar?.getAttribute('percentage');
    release();
    await settle(el);
    cleanup(container);
    if(percentage !== '50') return fail(`Expected 50, got ${percentage}`);
    pass('');
  },

  'reports a failure, shows it, and carries on with the next file': async ({ pass, fail }) => {
    const { container, el } = await create('multiple', async item => item.name === 'bad.png' ? [{ code: 403, msg: 'No permission' }, null] : [null, { ok: true }]);
    const failed = listen(el, 'uploadfailed');
    const uploaded = listen(el, 'uploaded');
    choose(el, [file('bad.png'), file('good.png')]);
    await settle(el);
    const text = el.shadowRoot.querySelector('.entry')?.textContent.replace(/\s+/g, ' ').trim();
    cleanup(container);
    if(failed.length !== 1 || failed[0].error.msg !== 'No permission' || failed[0].file.name !== 'bad.png') return fail(JSON.stringify(failed.map(item => item.error)));
    if(uploaded.length !== 1 || uploaded[0].file.name !== 'good.png') return fail('The next file should still go up');
    if(!text.includes('bad.png') || !text.includes('No permission')) return fail(`Row says "${text}"`);
    pass('');
  },

  'does not upload files the dropzone rejected, and says so': async ({ pass, fail }) => {
    let calls = 0;
    const { container, el } = await create('accept="image/*"', async () => { calls++; return [null, {}]; });
    const failed = listen(el, 'uploadfailed');
    choose(el, [], [file('notes.txt', 'text/plain')]);
    await settle(el);
    cleanup(container);
    if(calls) return fail('A rejected file must not be uploaded');
    if(failed.length !== 1 || failed[0].file.name !== 'notes.txt') return fail(JSON.stringify(failed));
    pass('');
  },

  'sends to kempo-files with its folder and visibility when it has no uploader': async ({ pass, fail }) => {
    const original = window.XMLHttpRequest;
    const requests = [];
    window.XMLHttpRequest = class {
      constructor(){
        this.upload = { addEventListener: () => {} };
        this.listeners = {};
        requests.push(this);
      }
      open(method, url){ this.method = method; this.url = url; }
      addEventListener(name, listener){ this.listeners[name] = listener; }
      send(form){
        this.form = form;
        this.status = 201;
        this.responseText = JSON.stringify({ file: { id: 'f1' } });
        this.listeners.load?.();
      }
    };
    try {
      const { container, el } = await create('public directory-id="dir-9"');
      const uploaded = listen(el, 'uploaded');
      choose(el, [file('logo.png')]);
      await settle(el);
      cleanup(container);
      const [request] = requests;
      if(!request || request.method !== 'POST' || !request.url.endsWith('/files')) return fail(`Request was ${request?.method} ${request?.url}`);
      if(request.form.get('directoryId') !== 'dir-9' || request.form.get('public') !== 'true') return fail('The folder and visibility should be sent');
      if(uploaded[0]?.result.file.id !== 'f1') return fail('The answer should be reported');
      pass('');
    } finally {
      window.XMLHttpRequest = original;
    }
  }
};
