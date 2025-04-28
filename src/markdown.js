import MarkdownIt from 'markdown-it';
import MarkdownItMath from 'markdown-it-math-loose';
import MarkdownItMergeCells from 'markdown-it-merge-cells';
import ObjectHash from 'object-hash';
import ObjectAssignDeep from 'object-assign-deep';

import MathRenderer from './internal/math-renderer';
import HighlightRenderer from './internal/highlight-renderer';

export default async function render(input, cache, callbackFilter, options = {}) {
  const cacheKey = cache && ObjectHash({ type: 'Markdown', task: input, options });

  if (cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const uuidReplaces = {};

  const mathRenderer = new MathRenderer(cache, (uuid, result) => {
    uuidReplaces[uuid] = result;
  });

  const highlightRenderer = new HighlightRenderer(cache, (uuid, result) => {
    uuidReplaces[uuid] = result;
  }, options.highlight);

  const mdOptions = ObjectAssignDeep({
    html: true,
    breaks: false,
    linkify: true,
    typographer: false,
    highlight: (code, lang) => highlightRenderer.addRenderTask(code, lang),
  }, options.markdownIt || {});

  const mathOptions = ObjectAssignDeep({
    inlineOpen: '$',
    inlineClose: '$',
    blockOpen: '$$',
    blockClose: '$$',
    inlineRenderer: str => mathRenderer.addRenderTask(str, false),
    blockRenderer: str => mathRenderer.addRenderTask(str, true),
  }, options.markdownItMath || {});

  const renderer = new MarkdownIt(mdOptions).use(MarkdownItMath, mathOptions);

  if (options.markdownItMergeCells !== false) {
    renderer.use(MarkdownItMergeCells);
  }

  let html = renderer.render(input);

  if (callbackFilter) {
    html = callbackFilter(html);
  }

  await Promise.all([
    mathRenderer.doRender(uuid => !html.includes(uuid)),
    highlightRenderer.doRender(uuid => !html.includes(uuid)),
  ]);

  for (const [uuid, content] of Object.entries(uuidReplaces)) {
    html = html.replace(uuid, content);
  }

  if (cache) {
    await cache.set(cacheKey, html);
  }

  return html;
}
