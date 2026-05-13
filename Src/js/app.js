const App = (() => {
  let _tree = [];
  let _previousHash = null;
  let _scrollPositions = {};
  let _isPopState = false;
  let _isNavClick = false;

  async function init() {
    DocRenderer.init();
    Search.init();
    ThemeSwitcher.init();
    _setupSidebarToggle();
    _setupMobileDefaults();
    _setupBackToTop();

    try {
      const resp = await fetch('/api/tree');
      if (!resp.ok) throw new Error('Failed to load tree');
      _tree = await resp.json();
      Nav.init(_tree);
    } catch (err) {
      console.error('Failed to load navigation tree:', err);
      document.getElementById('doc-content').innerHTML =
        '<p style="color:red;">无法加载目录结构，请检查服务器是否运行。</p>';
      _hideLoading();
      return;
    }

    window.addEventListener('popstate', () => { _isPopState = true; });
    window.addEventListener('hashchange', _onHashChange);
    _onHashChange();
  }

  function setNavClick(val) { _isNavClick = val; }

  function _setupSidebarToggle() {
    const toggle = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    const navTree = document.getElementById('nav-tree');

    toggle.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });

    overlay.addEventListener('click', () => {
      document.body.classList.remove('sidebar-open');
    });

    sidebar.addEventListener('wheel', (e) => {
      if (!navTree.contains(e.target)) {
        e.preventDefault();
        return;
      }
      const atTop = navTree.scrollTop <= 0 && e.deltaY < 0;
      const atBottom = navTree.scrollTop + navTree.clientHeight >= navTree.scrollHeight && e.deltaY > 0;
      if (atTop || atBottom) {
        e.preventDefault();
      }
    }, { passive: false });

    let touchStartY = 0;
    sidebar.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    sidebar.addEventListener('touchmove', (e) => {
      if (!navTree.contains(e.target)) {
        e.preventDefault();
        return;
      }
      const deltaY = touchStartY - e.touches[0].clientY;
      const atTop = navTree.scrollTop <= 0 && deltaY < 0;
      const atBottom = navTree.scrollTop + navTree.clientHeight >= navTree.scrollHeight && deltaY > 0;
      if (atTop || atBottom) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  function _setupMobileDefaults() {
    if (window.innerWidth <= 768) {
      document.body.classList.remove('sidebar-open');
    }
  }

  function _setupBackToTop() {
    const btn = document.createElement('button');
    btn.id = 'back-to-top';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none">' +
      '<path d="M10 4v12M5 9l5-5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
    document.body.appendChild(btn);

    btn.addEventListener('click', () => _scrollToTop());

    window.addEventListener('scroll', () => {
      btn.classList.toggle('visible', window.scrollY > 300);
    }, { passive: true });
  }

  function _getRouteKey(hash) {
    if (!hash || hash === 'home') return 'home';
    return hash.split('__')[0];
  }

  function _resolveScroll(fullHash, anchor) {
    if (_isPopState && !_isNavClick) {
      const saved = _scrollPositions[fullHash];
      if (saved !== undefined) {
        setTimeout(() => window.scrollTo({ top: saved, behavior: 'instant' }), 50);
        return;
      }
    }
    if (anchor) {
      _scrollToAnchor(anchor);
    } else {
      _scrollToTop();
    }
  }

  function _commitNavigation(fullHash) {
    _previousHash = fullHash;
    _isPopState = false;
    _isNavClick = false;
  }

  async function _onHashChange() {
    let fullHash;
    try {
      fullHash = decodeURIComponent(window.location.hash.slice(1)) || 'home';
    } catch (_) {
      fullHash = window.location.hash.slice(1) || 'home';
    }
    const routeKey = _getRouteKey(fullHash);
    const prevRouteKey = _previousHash ? _getRouteKey(_previousHash) : null;

    if (_previousHash !== null) {
      _scrollPositions[_previousHash] = window.scrollY;
    }

    const parts = fullHash.split('__');
    const routePart = parts[0];
    const anchor = parts[1] || null;

    if (fullHash.startsWith('search?')) {
      const params = new URLSearchParams(fullHash.substring(fullHash.indexOf('?')));
      const query = params.get('q') || '';
      Nav.clearHighlight();
      _hideLoading();
      if (query) {
        document.getElementById('top-search-input').value = query;
        await Search.executeSearch(query);
      }
      _resolveScroll(fullHash, null);
      _commitNavigation(fullHash);
      return;
    }

    if (routePart === 'home' || routePart === '') {
      Nav.clearHighlight();

      if (prevRouteKey === 'home' && !_isNavClick) {
        _resolveScroll(fullHash, anchor);
        _commitNavigation(fullHash);
        return;
      }

      await _loadHome();
      _resolveScroll(fullHash, anchor);
      _commitNavigation(fullHash);
      return;
    }

    // Any other route is a document path
    const docPath = routePart;

    if (prevRouteKey === routeKey && !_isNavClick) {
      _resolveScroll(fullHash, anchor);
      _commitNavigation(fullHash);
      return;
    }

    Nav.highlight(docPath);
    await _loadDoc(docPath, anchor);
    _resolveScroll(fullHash, anchor);
    _commitNavigation(fullHash);
  }

  async function _loadHome() {
    _showLoading();
    try {
      const resp = await fetch('/api/home');
      if (!resp.ok) throw new Error('Failed to load home');
      const markdown = await resp.text();
      const container = document.getElementById('doc-content');
      container.innerHTML = DocRenderer.render(markdown, {
        basePath: [],
        route: 'home'
      });
      _hideLoading();
      await DocRenderer.postRender(container);
    } catch (err) {
      document.getElementById('doc-content').innerHTML =
        '<p style="color:red;">加载首页失败。</p>';
      _hideLoading();
    }
  }

  async function _loadDoc(docPath, anchor) {
    _showLoading();
    try {
      const encodedPath = docPath.split('/').map(s => encodeURIComponent(s)).join('/');
      const resp = await fetch('/api/doc/' + encodedPath);
      if (!resp.ok) throw new Error('Document not found');
      const markdown = await resp.text();
      const container = document.getElementById('doc-content');

      const pathParts = docPath.split('/');
      const basePath = pathParts.slice(0, -1);

      container.innerHTML = DocRenderer.render(markdown, {
        basePath: basePath,
        route: docPath
      });
      _hideLoading();
      await DocRenderer.postRender(container);
    } catch (err) {
      document.getElementById('doc-content').innerHTML =
        '<div style="text-align:center;padding:60px 20px;color:#6b7280;">' +
        '<p style="font-size:1.2rem;">文档未找到</p>' +
        '<p style="margin-top:8px;"><a href="#home">返回首页</a></p>' +
        '</div>';
      _hideLoading();
    }
  }

  function _showLoading() {
    const el = document.getElementById('loading');
    if (el) el.classList.remove('hidden');
  }

  function _hideLoading() {
    const el = document.getElementById('loading');
    if (el) el.classList.add('hidden');
  }

  function _scrollToTop() {
    document.getElementById('content').scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function _scrollToAnchor(anchor) {
    setTimeout(() => {
      const decoded = decodeURIComponent(anchor);
      let target = document.getElementById(decoded);
      if (!target) {
        const lower = decoded.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '');
        target = document.getElementById(lower);
      }
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  return { init, setNavClick };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
