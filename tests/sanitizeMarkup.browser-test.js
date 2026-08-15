import { sanitizeSvgMarkup, sanitizeHtmlMarkup } from '../admin/utils/sanitizeMarkup.js';

export default {
  /*
    sanitizeSvgMarkup
  */
  'sanitizeSvgMarkup: returns null for content that does not parse as SVG': ({ pass, fail }) => {
    const result = sanitizeSvgMarkup('not svg at all, just some <b>html</b>');
    if(result !== null) return fail(`Expected null, got ${JSON.stringify(result)}`);
    pass('Non-SVG content returns null');
  },

  'sanitizeSvgMarkup: returns null for plain text with no markup': ({ pass, fail }) => {
    const result = sanitizeSvgMarkup('just some plain text, no tags whatsoever');
    if(result !== null) return fail(`Expected null, got ${JSON.stringify(result)}`);
    pass('Plain text returns null');
  },

  'sanitizeSvgMarkup: strips <script> elements': ({ pass, fail }) => {
    const result = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="5"/></svg>');
    if(!result) return fail('Expected a result, got null');
    if(result.markup.includes('<script')) return fail(`Script tag survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('<script> element removed and reported as stripped');
  },

  'sanitizeSvgMarkup: strips on* event-handler attributes': ({ pass, fail }) => {
    const result = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle r="5" onclick="alert(2)"/></svg>');
    if(!result) return fail('Expected a result, got null');
    if(/onload|onclick/i.test(result.markup)) return fail(`Event handler survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('on* attributes removed and reported as stripped');
  },

  'sanitizeSvgMarkup: strips javascript: URIs on href': ({ pass, fail }) => {
    const result = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text>click</text></a></svg>');
    if(!result) return fail('Expected a result, got null');
    if(/javascript:/i.test(result.markup)) return fail(`javascript: URI survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('javascript: URI removed and reported as stripped');
  },

  'sanitizeSvgMarkup: leaves benign SVG untouched and reports stripped:false': ({ pass, fail }) => {
    const result = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="5" fill="red"/></svg>');
    if(!result) return fail('Expected a result, got null');
    if(result.stripped) return fail('Expected stripped to be false for a clean SVG');
    if(!result.markup.includes('<circle')) return fail(`Expected the circle to survive: ${result.markup}`);
    pass('Clean SVG passes through with stripped:false');
  },

  'sanitizeSvgMarkup: preserves normal href attributes': ({ pass, fail }) => {
    const result = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg"><a href="https://example.com"><text>link</text></a></svg>');
    if(!result) return fail('Expected a result, got null');
    if(result.stripped) return fail('A normal https href should not be reported as stripped');
    if(!result.markup.includes('https://example.com')) return fail(`Normal href was removed: ${result.markup}`);
    pass('Normal https href left in place');
  },

  /*
    sanitizeHtmlMarkup
  */
  'sanitizeHtmlMarkup: never returns null, even for garbage input': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('not really html {{{ </broken');
    if(!result || typeof result.markup !== 'string') return fail(`Expected a result object, got ${JSON.stringify(result)}`);
    pass('Garbage input still produces a result');
  },

  'sanitizeHtmlMarkup: strips <script> elements': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('<p>hi</p><script>alert(1)</script>');
    if(result.markup.includes('<script')) return fail(`Script tag survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('<script> element removed and reported as stripped');
  },

  'sanitizeHtmlMarkup: strips <iframe>, <object> and <embed> elements': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('<iframe src="https://evil.example"></iframe><object data="x.swf"></object><embed src="y.swf">');
    if(/<iframe|<object|<embed/i.test(result.markup)) return fail(`Embedded content survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('<iframe>/<object>/<embed> all removed and reported as stripped');
  },

  'sanitizeHtmlMarkup: strips a refresh meta tag': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('<meta http-equiv="refresh" content="0;url=https://evil.example">');
    if(/http-equiv/i.test(result.markup)) return fail(`Refresh meta tag survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('Refresh meta tag removed and reported as stripped');
  },

  'sanitizeHtmlMarkup: strips on* event-handler attributes': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('<h1 onclick="alert(1)">hi</h1>');
    if(/onclick/i.test(result.markup)) return fail(`Event handler survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('on* attribute removed and reported as stripped');
  },

  'sanitizeHtmlMarkup: strips javascript: URIs on href': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('<a href="javascript:alert(1)">click</a>');
    if(/javascript:/i.test(result.markup)) return fail(`javascript: URI survived: ${result.markup}`);
    if(!result.stripped) return fail('Expected stripped to be true');
    pass('javascript: URI removed and reported as stripped');
  },

  'sanitizeHtmlMarkup: leaves benign HTML untouched and reports stripped:false': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('<h1>Hello</h1><p>This paragraph should survive sanitization.</p>');
    if(result.stripped) return fail('Expected stripped to be false for clean HTML');
    if(!result.markup.includes('Hello') || !result.markup.includes('should survive')) {
      return fail(`Expected content to survive: ${result.markup}`);
    }
    pass('Clean HTML passes through with stripped:false');
  },

  'sanitizeHtmlMarkup: preserves normal https href and img src attributes': ({ pass, fail }) => {
    const result = sanitizeHtmlMarkup('<a href="https://example.com">link</a><img src="https://example.com/pic.png">');
    if(result.stripped) return fail('Normal https href/src should not be reported as stripped');
    if(!result.markup.includes('https://example.com')) return fail(`Normal attributes were removed: ${result.markup}`);
    pass('Normal https href/src left in place');
  },
};
