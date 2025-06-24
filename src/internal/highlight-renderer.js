import syntect from '@syntect/node';
import escapeHTML from 'escape-html';
import objectHash from 'object-hash';
import objectAssignDeep from 'object-assign-deep';

import AsyncRenderer from './async-renderer';

const languageMap = {
  'c++': 'cpp',
  'js': 'javascript',
  'python': 'py',
  'rb': 'ruby',
  'sh': 'bash',
  'c#': 'csharp',
  'cs': 'csharp',
  'ts': 'typescript',
  'md': 'markdown',
  'plaintext': 'plain',
  'text': 'plain',
  'txt': 'plain'
};

export async function highlight(code, language, cache, options = {}) {
  language = language?.toLowerCase();
  language = languageMap[language] || language;

  const defaultOptions = {
    wrapper: ['<pre><code>', '</code></pre>'],
    expandTab: null,
    highlighter: null
  };

  options = objectAssignDeep({}, defaultOptions, options);

  let cacheKey;
  if (cache) {
    cacheKey = objectHash({
      type: 'Highlight',
      task: {
        code,
        language,
        options
      }
    });

    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) return cachedResult;
  }

  let result;
  try {
    if (typeof options.highlighter === 'function') {
      result = await options.highlighter(code, language);
    } else {
      result = syntect.highlight(code, language, 'hl-').html;
    }
  } catch (e) {
    console.error(`Highlighting error for language "${language}":`, e);
  }

  if (typeof result !== 'string' || result.length === 0) {
    result = escapeHTML(code);
  }

  const [startWrapper, endWrapper] = Array.isArray(options.wrapper) ? options.wrapper : ['', ''];
  result = `${startWrapper}${result}${endWrapper}`;

  if (typeof options.expandTab === 'number' && options.expandTab > 0) {
    result = result.replace(/\t/g, ' '.repeat(options.expandTab));
  }

  if (cache && cacheKey) {
    await cache.set(cacheKey, result);
  }

  return result;
}

export default class HighlightRenderer extends AsyncRenderer {
  constructor(cache, callbackAddReplace, options = {}) {
    super(cache, callbackAddReplace);
    this.options = options;
  }

  addRenderTask(code, language) {
    return this._addRenderTask({
      code,
      language,
      options: this.options
    });
  }

  _generateUUID(uuidGenerator) {
    return `<pre>${uuidGenerator()}</pre>`;
  }

  _shouldCache(task) {
    return task.language !== 'plain';
  }

  async _doRender(task) {
    return await highlight(task.code, task.language, this.cache, this.options);
  }
}
