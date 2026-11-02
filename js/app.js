/* ============================================================
   zeanDO · 应用壳
   职责：hash 路由（页签+次级页）、主题、⊕ 落笔半屏、Toast、存储横幅
   依据：PRD v0.2 §3（信息架构）/ §6（非功能）；手册 §8.1/§8.10
   ============================================================ */

(function () {
  'use strict';

  var App = {
    state: {
      tab: 'today',
      sheetOpen: false,
      sheetMode: 'types' // types | note | todo
    },
    views: {},
    _toastTimer: null
  };

  /* ---------- 视图注册 ---------- */
  var TABS = ['today', 'schedule', 'todos'];

  App.register = function (name, view) {
    App.views[name] = view;
  };

  /* ---------- 主题 ---------- */
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function resolvedTheme() {
    var setting = document.documentElement.dataset.themeSetting || 'system';
    if (setting === 'light' || setting === 'dark') return setting;
    return media.matches ? 'dark' : 'light';
  }

  function applyTheme(setting) {
    document.documentElement.dataset.themeSetting = setting;
    document.documentElement.dataset.theme = resolvedTheme();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', document.documentElement.dataset.theme === 'dark' ? '#1C1916' : '#FAF7F2');
  }

  App.getThemeSetting = function () {
    var s = window.storage.get('settings', null);
    return (s && s.theme) || 'system';
  };

  App.setThemeSetting = function (theme) {
    var s = window.storage.get('settings', window.storage.DEFAULT_SETTINGS);
    s.theme = theme;
    window.storage.set('settings', s);
    applyTheme(theme);
  };

  media.addEventListener('change', function () {
    if (App.getThemeSetting() === 'system') applyTheme('system');
  });

  /* ---------- 路由 ---------- */
  function viewFor(name) {
    return App.views[name] || null;
  }

  App.navigate = function (name) {
    if (!viewFor(name)) return;
    App.state.tab = name;
    render();
    window.location.hash = '#' + name;
  };

  function updateNav() {
    var inTab = TABS.indexOf(App.state.tab) !== -1;
    document.querySelectorAll('.tab[data-tab]').forEach(function (btn) {
      var isCurrent = inTab && btn.dataset.tab === App.state.tab;
      if (isCurrent) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    document.querySelector('.tab-plus').setAttribute('aria-current', 'false');
  }

  function render() {
    var host = document.getElementById('view');
    var view = viewFor(App.state.tab) || viewFor('today');
    host.innerHTML = '';
    view.render(host);
    updateNav();
    window.scrollTo(0, 0);
    /* 页签转场：轻浮入（手册 §9.2） */
    host.classList.remove('view-in');
    void host.offsetWidth;
    host.classList.add('view-in');
  }

  /* ---------- ⊕ 落笔半屏 ---------- */
  App.openSheet = function (mode) {
    App.state.sheetOpen = true;
    App.state.sheetMode = mode || 'types';
    var sheet = document.getElementById('sheet');
    sheet.hidden = false;
    sheet.setAttribute('aria-hidden', 'false');
    App.renderSheetContent();
    requestAnimationFrame(function () { sheet.classList.add('open'); });
    document.body.style.overflow = 'hidden';
  };

  App.closeSheet = function () {
    var sheet = document.getElementById('sheet');
    if (!App.state.sheetOpen) return;
    App.state.sheetOpen = false;
    sheet.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (!App.state.sheetOpen) {
        sheet.hidden = true;
        sheet.setAttribute('aria-hidden', 'true');
        document.getElementById('sheet-content').innerHTML = '';
      }
    }, 300);
  };

  App.sheetMode = function (mode) {
    App.state.sheetMode = mode;
    App.renderSheetContent();
  };

  /* 打开随手记详情（编辑/删除） */
  App.openNoteEdit = function (id) {
    App.state.noteId = id;
    App.openSheet('note-edit');
  };

  /* 打开待办详情（编辑/删除） */
  App.openTodoEdit = function (id) {
    App.state.todoId = id;
    App.openSheet('todo-edit');
  };

  /* 半屏内容按模式渲染：types 类型选择；note/todo/note-edit 由 capture 模块提供 */
  App.renderSheetContent = function () {
    var host = document.getElementById('sheet-content');
    var mode = App.state.sheetMode;
    if (mode === 'note' && App.capture) { App.capture.renderNote(host); return; }
    if (mode === 'todo' && App.capture) { App.capture.renderTodo(host, { date: App.state.presetDate }); App.state.presetDate = null; return; }
    if (mode === 'note-edit' && App.capture) { App.capture.renderNoteDetail(host, App.state.noteId); return; }
    if (mode === 'todo-edit' && App.capture) {
      var todos = window.storage.get('todos', []) || [];
      var t = todos.filter(function (x) { return x.id === App.state.todoId; })[0];
      App.capture.renderTodo(host, { todo: t });
      return;
    }
    if (mode === 'course-detail' && App.courseSheets) {
      App.courseSheets.renderCourseDetail(host, App.state.courseId);
      return;
    }
    if (mode === 'course-edit' && App.courseSheets) {
      App.courseSheets.renderCourseForm(host, App.state.coursePreset || {});
      return;
    }
    if (mode === 'semester' && App.courseSheets) {
      App.courseSheets.renderSemester(host);
      return;
    }
    host.innerHTML =
      '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<h2 class="t-h2 sheet-title">记点什么</h2>' +
      '<div class="type-grid">' +
      '  <button class="type-option" id="type-note">' +
      '    <strong>随手记</strong><span>一句话也可以（约 30 秒）</span>' +
      '  </button>' +
      '  <button class="type-option" id="type-todo">' +
      '    <strong>待办</strong><span>有日期要交的事</span>' +
      '  </button>' +
      '</div>';
    host.querySelector('#type-note').addEventListener('click', function () { App.sheetMode('note'); });
    host.querySelector('#type-todo').addEventListener('click', function () { App.sheetMode('todo'); });
  };

  /* 数据变更后重绘当前视图 */
  App.refresh = function () {
    if (App.state.sheetOpen) return;
    render();
  };

  /* ---------- Toast（§8.10） ---------- */
  App.toast = function (message, options) {
    var el = document.getElementById('toast');
    options = options || {};
    var duration = options.duration || 4000;
    el.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = message;
    el.appendChild(span);
    if (options.action) {
      var btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = options.action.label;
      btn.addEventListener('click', function () {
        options.action.onClick();
        hideToast();
      });
      el.appendChild(btn);
      duration = 5000; // 含撤销类操作停留 5s（§8.10）
    }
    el.classList.add('show');
    clearTimeout(App._toastTimer);
    App._toastTimer = setTimeout(hideToast, duration);
  };

  function hideToast() {
    document.getElementById('toast').classList.remove('show');
  }

  /* ---------- 启动 ---------- */
  App.init = function () {
    window.storage.migrate();

    /* 存储不可用 → 顶部常驻细条（状态与异常图 §6） */
    if (!window.storage.available) {
      var banner = document.getElementById('storage-banner');
      banner.hidden = false;
      banner.textContent = '记录无法保存：当前浏览环境禁用了本地存储';
    }

    applyTheme(App.getThemeSetting());

    /* 底部导航 */
    document.querySelectorAll('.tab[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { App.navigate(btn.dataset.tab); });
    });
    document.getElementById('btn-plus').addEventListener('click', function () { App.openSheet('types'); });

    /* 半屏关闭：遮罩点击 */
    document.querySelector('.sheet-backdrop').addEventListener('click', function () { App.closeSheet(); });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') App.closeSheet();
    });

    /* 刷新后恢复页签 */
    var initial = (window.location.hash || '').replace('#', '');
    if (initial && viewFor(initial)) App.state.tab = initial;
    render();

    /* 首次启动引导（PRD §5.1） */
    if (App.maybeShowOnboarding) App.maybeShowOnboarding();

    /* 外部改 hash（如直接访问 #notes）也能路由 */
    window.addEventListener('hashchange', function () {
      var target = (window.location.hash || '').replace('#', '');
      if (target && target !== App.state.tab && viewFor(target)) {
        App.state.tab = target;
        render();
      }
    });
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
})();