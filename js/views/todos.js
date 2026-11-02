/* ============================================================
   视图 · 待办（页签 3）
   五段分组（自然日边界）/ 日历视图 / 完成与撤销 / 逾期徽标
   依据：PRD v0.2 §4.2 / FR-T1~T6；手册 §8.3 / §8.6
   ============================================================ */

(function () {
  'use strict';

  var viewMode = 'list';          /* list | month */
  var monthCursor = null;         /* {y, m} 0-based m */
  var selectedDate = null;        /* 日历视图选中的日期 */

  var GROUP_LABELS = {
    overdue: '逾期', today: '今天', tomorrow: '明天', week: '本周', later: '稍后', done: '已完成'
  };

  function icon(id, cls) {
    return '<svg class="' + (cls || 'icon') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  function whenLabel(t, today) {
    if (t.done) return '';
    if (t.date < today) {
      return { cls: 'overdue', icon: 'i-alert', text: '逾期 ' + util.diffDays(t.date, today) + ' 天' };
    }
    if (t.date === today) return { cls: 'today', icon: 'i-clock', text: t.time ? '今天 ' + t.time : '今天' };
    if (t.date === util.addDays(today, 1)) return { cls: 'future', icon: 'i-clock', text: t.time ? '明天 ' + t.time : '明天' };
    return { cls: 'future', icon: 'i-clock', text: util.shortDate(t.date) + (t.time ? ' ' + t.time : '') };
  }

  /* 分类：色点必配文字（手册 §2.7 色块不单独表意） */
  var CAT_LABELS = { study: '学习', work: '工作', life: '生活', club: '社团' };
  function categoryDot(cat) {
    if (!CAT_LABELS[cat]) return '';
    var map = { study: '--course-3', work: '--course-4', life: '--course-2', club: '--course-5' };
    return '<span class="cat-tag"><span class="cat-dot" style="background: var(' + map[cat] + ')" aria-hidden="true"></span>' +
      CAT_LABELS[cat] + '</span>';
  }

  function todoRow(t, today) {
    var when = whenLabel(t, today);
    var courses = window.storage.get('courses', []) || [];
    var course = t.courseId ? courses.filter(function (c) { return c.id === t.courseId; })[0] : null;
    return '<div class="todo-row' + (t.done ? ' is-done' : '') + '" data-id="' + t.id + '">' +
      '<button class="check-btn" data-check="' + t.id + '" aria-label="' + (t.done ? '恢复' : '完成') + '：' +
      util.escapeHTML(t.title) + '" role="checkbox" aria-checked="' + (t.done ? 'true' : 'false') + '">' +
      '<span class="box">' + icon('i-check', 'icon') + '</span></button>' +
      '<div class="todo-main" data-edit="' + t.id + '">' +
      '  <p class="todo-title t-h3">' + util.escapeHTML(t.title) + '</p>' +
      '  <p class="todo-meta t-caption">' +
      (when ? '<span class="deadline ' + when.cls + '">' + icon(when.icon, 'icon-16') + '<span>' + when.text + '</span></span>' : '') +
      categoryDot(t.category) +
      (course ? '<span class="course-tag">' + util.escapeHTML(course.name) + '</span>' : '') +
      '  </p>' +
      '</div>' +
      '</div>';
  }

  function groupsHTML(todos, today) {
    var g = util.groupTodos(todos, today);
    var order = ['overdue', 'today', 'tomorrow', 'week', 'later'];
    var html = '<div class="overdue-badge-wrap">' +
      (g.overdue.length > 0 ? '<span class="overdue-badge">' + icon('i-alert', 'icon-16') + '逾期 ' + g.overdue.length + ' 件</span>' : '') +
      '</div>';

    order.forEach(function (key) {
      var list = g[key];
      if (list.length === 0) return; /* 空组整组隐藏（PRD §4.2） */
      html += '<div class="todo-group">' +
        '<div class="group-head"><span class="group-title">' + GROUP_LABELS[key] + '</span>' +
        '<span class="group-count t-caption">' + list.length + '</span>' +
        '<span class="rule" aria-hidden="true"></span></div>' +
        '<div class="plain-list has-stagger">' + list.map(function (t) { return todoRow(t, today); }).join('') + '</div>' +
        '</div>';
    });

    if (g.done.length > 0) {
      html += '<div class="todo-group">' +
        '<div class="group-head"><span class="group-title">已完成</span>' +
        '<span class="group-count t-caption">' + g.done.length + '</span>' +
        '<span class="rule" aria-hidden="true"></span></div>' +
        '<div class="plain-list done-card">' +
        g.done.slice(0, 10).map(function (t) { return todoRow(t, today); }).join('') +
        '</div></div>';
    }

    if (g.overdue.length + g.today.length + g.tomorrow.length + g.week.length + g.later.length + g.done.length === 0) {
      html += '<div class="empty">' +
        '<div class="illust-slot" aria-hidden="true">' + Illust.todo() + '</div>' +
        '<p>这周还没有安排。有要交的事，从 ⊕ 记一条。</p>' +
        '<button class="btn-primary" data-sheet-todo>记一条待办</button>' +
        '</div>';
    }
    return html;
  }

  /* ---------- 日历视图 ---------- */
  function monthHTML(todos, today) {
    var cur = monthCursor;
    var first = new Date(cur.y, cur.m, 1);
    var startDow = first.getDay() === 0 ? 7 : first.getDay(); /* 周一为第一列 */
    var daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();
    var prevDays = startDow - 1;

    var cells = '';
    for (var i = 0; i < prevDays; i++) cells += '<span class="cal-cell empty"></span>';

    var byDate = {};
    todos.forEach(function (t) {
      if (!t.date || t.done) return;
      byDate[t.date] = (byDate[t.date] || 0) + 1;
    });

    for (var d = 1; d <= daysInMonth; d++) {
      var ds = cur.y + '-' + ('0' + (cur.m + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
      var cls = 'cal-cell';
      if (ds === today) cls += ' today';
      if (ds === selectedDate) cls += ' selected';
      var dots = '';
      var n = byDate[ds] || 0;
      if (n > 0) {
        dots = '<span class="cal-dots">' +
          '<i style="background:var(--brick)"></i>' +
          (n > 1 ? '<i style="background:var(--brick)"></i>' : '') +
          (n > 2 ? '<i style="background:var(--brick)"></i>' : '') +
          '</span>';
      }
      cells += '<button class="' + cls + '" data-day="' + ds + '"><span class="cal-num">' + d + '</span>' + dots + '</button>';
    }

    var dayList = todos.filter(function (t) { return t.date === selectedDate; });
    var dayHTML = dayList.length > 0
      ? '<div class="plain-list">' + dayList.map(function (t) { return todoRow(t, today); }).join('') + '</div>'
      : '<div class="empty slim">' +
        '<p>这天没有安排。</p>' +
        '<button class="btn-secondary" data-quick-add="' + selectedDate + '">给这天记一条</button>' +
        '</div>';

    return '<div class="cal">' +
      '<div class="cal-head">' +
      '  <button class="cal-nav" data-month="-1" aria-label="上一月">‹</button>' +
      '  <strong class="cal-title">' + cur.y + '年' + (cur.m + 1) + '月</strong>' +
      '  <button class="cal-nav" data-month="1" aria-label="下一月">›</button>' +
      '</div>' +
      '<div class="cal-week">' + ['一', '二', '三', '四', '五', '六', '日'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
      '<div class="cal-grid">' + cells + '</div>' +
      '</div>' +
      '<div class="section-head" style="margin-top:var(--sp-6)">' +
      '  <h2>' + util.shortDate(selectedDate) + '</h2><span class="rule" aria-hidden="true"></span>' +
      '</div>' + dayHTML;
  }

  /* ---------- 交互 ---------- */
  function toggleDone(id, el) {
    var todos = window.storage.get('todos', []) || [];
    var t = todos.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (t.done) {
      t.done = false;
      delete t.doneAt;
      window.storage.set('todos', todos);
      App.refresh();
      App.toast('放回来了。');
      return;
    }
    t.done = true;
    t.doneAt = Date.now();
    window.storage.set('todos', todos);
    var row = el.querySelector('[data-id="' + id + '"]');
    if (row) {
      row.classList.add('anim');
      row.classList.add('is-done');
    }
    var left = (window.storage.get('todos', []) || []).filter(function (x) {
      return !x.done && x.date && x.date <= util.todayStr();
    }).length;
    App.toast(left > 0 ? '搞定一件，还剩 ' + left + ' 件。' : '搞定，今天清空了。', {
      action: {
        label: '撤销',
        onClick: function () {
          var list = window.storage.get('todos', []) || [];
          var item = list.filter(function (x) { return x.id === id; })[0];
          if (item) { item.done = false; delete item.doneAt; window.storage.set('todos', list); }
          App.refresh();
        }
      }
    });
    setTimeout(function () { App.refresh(); }, 420);
  }

  function wire(el) {
    el.querySelectorAll('[data-check]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleDone(b.dataset.check, el);
      });
    });
    el.querySelectorAll('[data-edit]').forEach(function (main) {
      main.addEventListener('click', function () { App.openTodoEdit(main.dataset.edit); });
    });
    el.querySelectorAll('[data-sheet-todo]').forEach(function (b) {
      b.addEventListener('click', function () { App.openSheet('todo'); });
    });
    el.querySelectorAll('[data-quick-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        App.state.presetDate = b.dataset.quickAdd;
        App.openSheet('todo');
      });
    });
    el.querySelectorAll('[data-day]').forEach(function (b) {
      b.addEventListener('click', function () {
        selectedDate = b.dataset.day;
        App.refresh();
      });
    });
    el.querySelectorAll('[data-month]').forEach(function (b) {
      b.addEventListener('click', function () {
        var delta = +b.dataset.month;
        var m = monthCursor.m + delta;
        var y = monthCursor.y;
        if (m < 0) { m = 11; y--; }
        if (m > 11) { m = 0; y++; }
        monthCursor = { y: y, m: m };
        App.refresh();
      });
    });
    el.querySelector('#view-list').addEventListener('click', function () { viewMode = 'list'; App.refresh(); });
    el.querySelector('#view-month').addEventListener('click', function () {
      viewMode = 'month';
      selectedDate = selectedDate || util.todayStr();
      App.refresh();
    });
    el.querySelector('#add-todo').addEventListener('click', function () { App.openSheet('todo'); });
  }

  App.register('todos', {
    render: function (el) {
      var todos = window.storage.get('todos', []) || [];
      var today = util.todayStr();
      if (!monthCursor) {
        var d = new Date();
        monthCursor = { y: d.getFullYear(), m: d.getMonth() };
      }
      if (!selectedDate) selectedDate = today;

      var open = todos.filter(function (t) { return !t.done; }).length;

      el.innerHTML =
        '<header class="page-head">' +
        '  <div class="ph-main">' +
        '    <p class="kicker">' + util.dateStamp(today) + '</p>' +
        '    <h1 class="t-title">待办</h1>' +
        '    <p class="motto">' + (open > 0 ? '还有 ' + open + ' 件要做的事。' : '这周还没有安排。') + '</p>' +
        '  </div>' +
        '  <button class="avatar-btn" id="add-todo" aria-label="添加待办">' + icon('i-plus') + '</button>' +
        '</header>' +
        '<div class="view-switch">' +
        '  <button class="seg' + (viewMode === 'list' ? ' on' : '') + '" id="view-list">清单</button>' +
        '  <button class="seg' + (viewMode === 'month' ? ' on' : '') + '" id="view-month">日历</button>' +
        '</div>' +
        (viewMode === 'list' ? groupsHTML(todos, today) : monthHTML(todos, today));

      wire(el);
    },

    /* ⊕ 半屏「待办」入口的落点 */
    create: function () {
      App.openSheet('todo');
    }
  });
})();