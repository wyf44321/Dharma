const Search = (() => {

  function init() {
    const input = document.getElementById('top-search-input');
    const btn = document.getElementById('top-search-btn');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        _doSearch(input.value.trim());
      }
    });

    btn.addEventListener('click', () => {
      _doSearch(input.value.trim());
    });
  }

  function _doSearch(query) {
    if (!query) return;
    window.location.hash = '#search?q=' + encodeURIComponent(query);
  }

  async function executeSearch(query) {
    const container = document.getElementById('doc-content');

    container.innerHTML =
      '<div class="search-results-header">' +
      '<h2>搜索结果</h2>' +
      '<p>搜索: <strong>' + _esc(query) + '</strong> ...</p>' +
      '</div>' +
      '<div class="loading"><div class="loading-spinner"></div></div>';

    try {
      const resp = await fetch('/api/search?q=' + encodeURIComponent(query));
      if (!resp.ok) throw new Error('Search failed');
      const results = await resp.json();
      _renderResults(container, query, results);
    } catch (err) {
      container.innerHTML =
        '<div class="search-results-header">' +
        '<h2>搜索结果</h2>' +
        '<p>搜索出错，请重试。</p>' +
        '</div>';
    }
  }

  function _renderResults(container, query, results) {
    let html = '<div class="search-results-header">' +
      '<h2>搜索结果</h2>' +
      '<p>搜索 "<strong>' + _esc(query) + '</strong>"，找到 ' + results.length + ' 个文档</p>' +
      '</div>';

    if (results.length === 0) {
      html += '<div class="search-no-results">' +
        '<p>未找到匹配的结果</p>' +
        '<p style="font-size:0.9rem;margin-top:8px;">请尝试其他关键词</p>' +
        '</div>';
      container.innerHTML = html;
      return;
    }

    for (const result of results) {
      html += '<div class="search-result-item" data-href="#' + _esc(result.path) + '">';
      html += '<span class="search-result-module">' + _esc(result.dirPath) + '</span>';
      html += '<span class="search-result-title">' +
        _highlight(_esc(result.fileName), query) + '</span>';

      if (result.matches && result.matches.length > 0) {
        for (const m of result.matches) {
          html += '<div class="search-result-match">' +
            '<span class="line-num">L' + m.line + '</span>' +
            _highlight(_esc(m.text), query) +
            '</div>';
        }
      }

      html += '</div>';
    }

    container.innerHTML = html;
    _bindCardClick(container);
  }

  function _bindCardClick(container) {
    let touchMoved = false;
    container.addEventListener('touchstart', () => { touchMoved = false; }, { passive: true });
    container.addEventListener('touchmove', () => { touchMoved = true; }, { passive: true });

    container.addEventListener('click', (e) => {
      if (touchMoved) return;
      const item = e.target.closest('.search-result-item[data-href]');
      if (item) {
        window.location.hash = item.dataset.href;
      }
    });
  }

  function _highlight(htmlText, query) {
    if (!query) return htmlText;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + escapedQuery + ')', 'gi');
    return htmlText.replace(regex, '<span class="search-highlight">$1</span>');
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  return { init, executeSearch };
})();
