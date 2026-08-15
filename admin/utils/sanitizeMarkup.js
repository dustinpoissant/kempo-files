/*
  Strips event-handler attributes and javascript: URIs from an element tree — shared by the SVG and
  HTML sanitizers below, which differ only in which tags they remove outright first. Reports whether
  it found anything, so the caller only warns when a preview genuinely differs from its source.
*/
const stripEventVectors = doc => {
  let stripped = false;
  for(const $el of doc.querySelectorAll('*')){
    for(const attr of [...$el.attributes]){
      const name = attr.name.toLowerCase();
      const isEventHandler = name.startsWith('on');
      const isScriptUri = ['href', 'xlink:href', 'action', 'formaction'].includes(name) && /^\s*javascript:/i.test(attr.value);
      if(isEventHandler || isScriptUri){ $el.removeAttribute(attr.name); stripped = true; }
    }
  }
  return stripped;
};

/*
  Renders via a blob: URL <img>, which cannot execute scripts regardless of what this misses — the
  stripping is what makes the *preview* honest about what was removed, not what makes it safe.
  Returns null when the content is not parseable SVG at all, so the caller falls back to source only.
*/
export const sanitizeSvgMarkup = markup => {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if(doc.querySelector('parsererror') || doc.documentElement.nodeName.toLowerCase() !== 'svg') return null;

  let stripped = false;
  for(const $script of doc.querySelectorAll('script')){ $script.remove(); stripped = true; }
  stripped = stripEventVectors(doc) || stripped;

  return { markup: new XMLSerializer().serializeToString(doc), stripped };
};

/*
  Renders into an <iframe sandbox=""> with no allow-scripts token, which refuses to execute anything
  regardless of what this misses. HTML parsing never fails outright, so there is no null case here.
*/
export const sanitizeHtmlMarkup = markup => {
  const doc = new DOMParser().parseFromString(markup, 'text/html');

  let stripped = false;
  for(const $el of doc.querySelectorAll('script, iframe, object, embed, meta[http-equiv="refresh" i]')){
    $el.remove();
    stripped = true;
  }
  stripped = stripEventVectors(doc) || stripped;

  return { markup: `<!DOCTYPE html>${doc.documentElement.outerHTML}`, stripped };
};
