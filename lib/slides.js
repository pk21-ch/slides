(async () => {
  const baseUrl = new URL('.', document.currentScript.src);
  const nodeModulesUrl = new URL('../node_modules/', baseUrl);
  const revealUrl = new URL('reveal.js/dist/', nodeModulesUrl);
  const highlightUrl = new URL('highlight.js/', nodeModulesUrl);
  const resourceFallbacks = [
    [revealUrl.href, 'reveal.js', 'dist/'],
    [highlightUrl.href, 'highlight.js', ''],
  ];
  let packageJsonPromise;
  const cssResources = [
    new URL('reset.css', revealUrl).href,
    new URL('reveal.css', revealUrl).href,
    new URL('theme.css', baseUrl).href,
    new URL('styles/github.css', highlightUrl).href,
  ];
  const jsResources = ['reveal.js', 'plugin/notes.js', 'plugin/markdown.js', 'plugin/highlight.js'];

  function loadResource(tagName, attributes) {
    return new Promise((resolve, reject) => {
      const element = Object.assign(document.createElement(tagName), attributes);
      element.onload = resolve;
      element.onerror = async () => {
        const url = element.src || element.href;
        const fallback = resourceFallbacks.find(([localUrl]) => url.startsWith(localUrl));
        element.remove();
        if (!fallback) {
          reject(new Error(`Failed to load ${url}`));
          return;
        }
        try {
          packageJsonPromise ??= fetch(new URL('../package.json', baseUrl)).then(response => {
            if (!response.ok) {
              throw new Error(`Failed to load package.json: ${response.status}`);
            }
            return response.json();
          });
          const { dependencies } = await packageJsonPromise;
          const [localUrl, packageName, packagePath] = fallback;
          const version = dependencies?.[packageName];
          if (typeof version !== 'string' || !version.trim()) {
            throw new Error(`Missing dependency version for ${packageName} in package.json`);
          }
          const cdnUrl = `https://cdn.jsdelivr.net/npm/${packageName}@${encodeURIComponent(version)}/${packagePath}`;
          const urlAttribute = tagName === 'script' ? 'src' : 'href';
          await loadResource(tagName, { ...attributes, [urlAttribute]: cdnUrl + url.slice(localUrl.length) });
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      document.head.appendChild(element);
    });
  }

  await Promise.all(cssResources.map(href => loadResource('link', { rel: 'stylesheet', href })));

  for (const path of jsResources) {
    await loadResource('script', { src: new URL(path, revealUrl).href });
  }

  Reveal.on('pdf-ready', () => {
    const slides = Reveal.getSlidesElement();
    const chrome = slides.querySelectorAll(':scope > header, :scope > footer');
    const { height } = Reveal.getComputedSlideSize(window.innerWidth, window.innerHeight);

    slides.querySelectorAll('.pdf-page > section').forEach(slide => {
      slide.style.height = `${height}px`;
      chrome.forEach(element => slide.appendChild(element.cloneNode(true)));
    });
    chrome.forEach(element => element.remove());
  });

  await Reveal.initialize({
    width: 1280,
    height: 720,
    scrollActivationWidth: 0,
    hash: true,
    margin: new URLSearchParams(location.search).has('print-pdf') ? 0 : 0.04,
    pdfPageHeightOffset: 0,
    transition: 'fade',
    slideNumber: 'c/t',
    center: false,
    plugins: [RevealMarkdown, RevealHighlight, RevealNotes],
  });
})().catch(error => console.error('Failed to initialize slides:', error));
