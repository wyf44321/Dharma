const Nav = (() => {
  let _tree = [];
  let _navTree = null;
  let _filterInput = null;

  function init(tree) {
    _tree = tree;
    _navTree = document.getElementById('nav-tree');
    _filterInput = document.getElementById('nav-search-input');
    _render(tree);
    _filterInput.addEventListener('input', _onFilter);
  }

  function _render(tree) {
    _navTree.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const node of tree) {
      frag.appendChild(_buildNode(node, 0));
    }
    _navTree.appendChild(frag);
  }

  function _buildNode(node, depth) {
    if (node.type === 'file') {
      const item = document.createElement('a');
      item.className = 'nav-file-item';
      item.href = '#' + node.path;
      item.dataset.path = node.path;
      item.style.paddingLeft = (12 + depth * 16) + 'px';
      item.textContent = node.name;

      item.addEventListener('click', () => {
        App.setNavClick(true);
        if (window.innerWidth <= 768) {
          document.body.classList.remove('sidebar-open');
        }
      });

      return item;
    }

    const dirEl = document.createElement('div');
    dirEl.className = 'nav-dir';
    dirEl.dataset.name = node.name;

    const header = document.createElement('div');
    header.className = 'nav-dir-header';
    header.style.paddingLeft = (12 + depth * 16) + 'px';
    header.innerHTML =
      '<svg class="arrow" viewBox="0 0 16 16" fill="none">' +
      '<path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>' +
      '<span class="nav-dir-name">' + _esc(node.name) + '</span>';

    header.addEventListener('click', () => {
      dirEl.classList.toggle('open');
    });

    const childList = document.createElement('div');
    childList.className = 'nav-dir-children';

    if (node.children) {
      for (const child of node.children) {
        childList.appendChild(_buildNode(child, depth + 1));
      }
    }

    dirEl.appendChild(header);
    dirEl.appendChild(childList);
    return dirEl;
  }

  function highlight(docPath) {
    const items = _navTree.querySelectorAll('.nav-file-item');
    for (const item of items) {
      item.classList.remove('active');
    }
    if (!docPath) return;

    const activeItem = _navTree.querySelector('.nav-file-item[data-path="' + CSS.escape(docPath) + '"]');
    if (activeItem) {
      activeItem.classList.add('active');
      let parent = activeItem.parentElement;
      while (parent && parent !== _navTree) {
        if (parent.classList.contains('nav-dir')) {
          parent.classList.add('open');
        }
        parent = parent.parentElement;
      }
      activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function clearHighlight() {
    const items = _navTree.querySelectorAll('.nav-file-item.active');
    for (const item of items) {
      item.classList.remove('active');
    }
  }

  function _onFilter() {
    const query = _filterInput.value.trim().toLowerCase();
    const dirEls = _navTree.querySelectorAll('.nav-dir');
    const fileEls = _navTree.querySelectorAll('.nav-file-item');

    if (!query) {
      dirEls.forEach(el => { el.style.display = ''; });
      fileEls.forEach(el => { el.style.display = ''; });
      return;
    }

    fileEls.forEach(el => {
      const name = el.textContent.toLowerCase();
      const pathStr = (el.dataset.path || '').toLowerCase();
      el.style.display = (name.includes(query) || pathStr.includes(query)) ? '' : 'none';
    });

    dirEls.forEach(dirEl => {
      const dirName = (dirEl.dataset.name || '').toLowerCase();
      const hasVisibleChild = dirEl.querySelector('.nav-file-item:not([style*="display: none"])');
      const dirMatch = dirName.includes(query);

      if (dirMatch || hasVisibleChild) {
        dirEl.style.display = '';
        if (hasVisibleChild) dirEl.classList.add('open');
        if (dirMatch) {
          dirEl.querySelectorAll('.nav-file-item').forEach(el => { el.style.display = ''; });
        }
      } else {
        dirEl.style.display = 'none';
      }
    });
  }

  function getTree() { return _tree; }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  return { init, highlight, clearHighlight, getTree };
})();
