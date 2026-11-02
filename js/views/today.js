/* ============================================================
   视图 · 今日（页签 1）
   三段卡片流：下一节课大卡 / 今日待办 / 最近随手记 3 条
   依据：PRD v0.2 §3.2 / §4.3（五级决策链、倒计时每分钟刷新）；手册 §8.2 / §8.3
   ============================================================ */

(function () {
  'use strict';

  var countdownTimer = null;

  function icon(id, cls) {
    return '<svg class="' + (cls || 'icon') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  /* —— 下一节课大卡（五级决策链） —— */
  function nextCardHTML() {
    var semester = window.storage.get('semester', null);
    var courses = window.storage.get('courses', []) || [];
    var todos = window.storage.get('todos', []) || [];
    var next = util.nextClass(courses, semester, todos);

    if (next.type === 'empty') {
      return '<div class="empty">' +
        '<div class="illust-slot" aria-hidden="true">' + Illust.course() + '</div>' +
        '<p>今天没课。先把课表建起来，明天就不用猜了。</p>' +
        '<button class="btn-primary" data-nav="schedule">去课表</button>' +
        '</div>';
    }

    if (next.type === 'due') {
      var t = next.todo;
      return '<div class="card next-card due-card">' +
        '<div class="next-main">' +
        '<p class="t-caption">本学期没有课了，最近的截止是——</p>' +
        '<h3 class="t-h3">' + util.escapeHTML(t.title) + '</h3>' +
        '<p class="t-body-s">' + util.shortDate(t.date) + (t.time ? ' ' + t.time : '') + '</p>' +
        '</div>' +
        '</div>';
    }

    if (next.type === 'done-today') {
      var tm = next.tomorrow;
      return '<div class="card next-card">' +
        '<div class="next-main">' +
        '<p class="t-caption">今天的课</p>' +
        '<div class="t-count next-count">上完了</div>' +
        (tm ? '<p class="t-body-s">' + util.relativeDay(tm.date) + ' ' + tm.start + '「' + util.escapeHTML(tm.course.name) + '」</p>'
            : '<p class="t-body-s">接下来两天没有课。</p>') +
        '</div></div>';
    }

    /* next / later */
    var e = next.entry;
    var c = e.course;
    var colorVar = courseColorVar(c);
    var isToday = next.type === 'next';
    var countText = isToday ? util.countdownText(next.date, e.start) : util.countdownText(next.date, e.start);
    var label = isToday ? '还有' : '下一节';

    return '<div class="card next-card" style="--course-color: var(' + colorVar + ')">' +
      '<div class="next-main">' +
      '<p class="t-caption">' + (isToday ? '今天 · ' + (e.secs.length > 1 ? '第 ' + e.secs[0] + '-' + e.secs[e.secs.length - 1] + ' 节' : '第 ' + e.secs[0] + ' 节') : util.relativeDay(next.date) + ' · 下一节') + '</p>' +
      '<h3 class="t-h3">' + util.escapeHTML(c.name) + '</h3>' +
      '<p class="t-body-s">' + e.start + '–' + e.end + (c.location ? ' · ' + util.escapeHTML(c.location) : '') + '</p>' +
      '<div class="t-count next-count" data-countdown="' + next.date + '|' + e.start + '">' +
      (isToday ? '还有 ' + countText : countText) +
      '</div>' +
      '</div></div>';
  }

  function courseColorVar(c) {
    var idx = 1;
    if (typeof c.color === 'number') idx = ((c.color - 1) % 8) + 1;
    return '--course-' + idx;
  }

  /* —— 提醒横幅：打开 App 时检查到期项（PRD §4.2） —— */
  function reminderBannerHTML() {
    var todos = window.storage.get('todos', []) || [];
    var due = util.dueReminders(todos);
    if (due.length === 0) return '';
    var ids = due.map(function (t) { return t.id; });
    var list = window.storage.get('todos', []) || [];
    list.forEach(function (t) { if (ids.indexOf(t.id) !== -1) t.notifiedAt = Date.now(); });
    window.storage.set('todos', list);
    return '<button class="reminder-banner" id="banner-go">' +
      icon('i-alert', 'icon-20') +
      '<span>今天有 ' + due.length + ' 项提醒到点了</span>' +
      '<span class="banner-arrow" aria-hidden="true">›</span></button>';
  }

  /* —— 今日待办段（逾期 + 今天 + 明天临近，M3 完整分组在待办页） —— */
  function todosHTML() {
    var todos = window.storage.get('todos', []) || [];
    var today = util.todayStr();
    var tomorrow = util.addDays(today, 1);
    var list = todos.filter(function (t) {
      return !t.done && t.date && t.date <= tomorrow;
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.time || '99:99') < (b.time || '99:99') ? -1 : 1;
    }).slice(0, 3);

    if (list.length === 0) {
      return '<div class="empty">' +
        '<div class="illust-slot" aria-hidden="true">' + Illust.todo() + '</div>' +
        '<p>今天没有要交的事，记点什么吧。</p>' +
        '<button class="btn-primary" data-sheet="todo">记一条待办</button>' +
        '</div>';
    }

    var rows = list.map(function (t) {
      var overdue = t.date < today;
      var days = overdue ? util.diffDays(t.date, today) : 0;
      var label = overdue ? '逾期 ' + days + ' 天' : (t.date === tomorrow ? '明天' : (t.time ? t.time : '今天'));
      if (t.date === tomorrow && t.time) label = '明天 ' + t.time;
      var cls = overdue ? 'deadline overdue' : (t.date === today ? 'deadline today' : 'deadline future');
      return '<div class="todo-row" data-id="' + t.id + '">' +
        '<button class="check-btn" data-check="' + t.id + '" aria-label="完成：' + util.escapeHTML(t.title) + '" role="checkbox" aria-checked="false">' +
        '<span class="box">' + icon('i-check', 'icon') + '</span></button>' +
        '<div class="todo-main">' +
        '  <p class="todo-title t-h3">' + util.escapeHTML(t.title) + '</p>' +
        '  <p class="' + cls + ' t-caption">' + icon(overdue ? 'i-alert' : 'i-clock', 'icon-16') + '<span>' + label + '</span></p>' +
        '</div>' +
        '</div>';
    }).join('');

    return '<div class="plain-list has-stagger">' + rows + '</div>';
  }

  /* —— 最近随手记 3 条 —— */
  function notesHTML() {
    var notes = window.storage.get('notes', []) || [];
    if (notes.length === 0) {
      return '<div class="empty">' +
        '<div class="illust-slot" aria-hidden="true">' + Illust.note() + '</div>' +
        '<p>今天还没写点什么——一句也行。</p>' +
        '<button class="btn-primary" data-sheet="note">记一条</button>' +
        '</div>';
    }
    var items = notes.slice(0, 3).map(function (n) {
      return '<div class="note-card">' +
        '<p class="note-text">' + highlightTags(n.text) + '</p>' +
        '<p class="note-meta t-caption">' + util.shortDate(util.toDateStr(new Date(n.createdAt))) + '</p>' +
        '</div>';
    }).join('');
    return '<div class="plain-list note-list">' + items + '</div>';
  }

  function highlightTags(text) {
    return util.escapeHTML(text).replace(/#([^\s#]{1,20})/g, '<span class="tag-text">#$1</span>');
  }

  /* —— 事件绑定 —— */
  function wire(el) {
    el.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () { App.navigate(b.dataset.nav); });
    });
    el.querySelectorAll('[data-sheet]').forEach(function (b) {
      b.addEventListener('click', function () { App.openSheet(b.dataset.sheet); });
    });
    el.querySelectorAll('[data-check]').forEach(function (b) {
      b.addEventListener('click', function () { completeTodo(b.dataset.check, el); });
    });
    el.querySelector('#go-settings').addEventListener('click', function () { App.navigate('settings'); });
    el.querySelector('#go-notes').addEventListener('click', function () { App.navigate('notes'); });
    el.querySelector('#go-todos').addEventListener('click', function () { App.navigate('todos'); });
    var banner = el.querySelector('#banner-go');
    if (banner) banner.addEventListener('click', function () { App.navigate('todos'); });
  }

  /* 完成待办：划线 + 移出 + 5 秒撤销（PRD §4.2 / FR-T3） */
  function completeTodo(id, el) {
    var todos = window.storage.get('todos', []) || [];
    var t = todos.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    t.done = true;
    t.doneAt = Date.now();
    window.storage.set('todos', todos);
    var row = el.querySelector('[data-id="' + id + '"]');
    if (row) {
      row.classList.add('anim');
      row.classList.add('is-done');
      setTimeout(function () { App.refresh(); }, 420);
    }
    var left = todos.filter(function (x) { return !x.done && x.date && x.date <= util.todayStr(); }).length;
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
  }

  /* 倒计时每分钟刷新（不动 DOM 其他部分） */
  function startCountdown() {
    clearInterval(countdownTimer);
    countdownTimer = setInterval(function () {
      if (App.state.tab !== 'today' || App.state.sheetOpen) return;
      document.querySelectorAll('[data-countdown]').forEach(function (node) {
        var parts = node.dataset.countdown.split('|');
        var txt = util.countdownText(parts[0], parts[1]);
        node.textContent = '还有 ' + txt;
      });
    }, 60000);
  }

  App.register('today', {
    render: function (el) {
      var sem = window.storage.get('semester', null);
      var week = sem ? util.weekOf(sem, util.todayStr()) : null;
      var kicker = util.dayCn(util.todayStr()) + (week ? ' · 第 ' + week + ' 周' : '');

      el.innerHTML =
        '<header class="page-head">' +
        '  <div class="ph-main">' +
        '    <p class="kicker">' + kicker + '</p>' +
        '    <h1 class="t-title">' + util.shortDate(util.todayStr()) + '</h1>' +
        '    <p class="motto">把要做的事和想到的事，记下来。</p>' +
        '  </div>' +
        '  <button class="avatar-btn" id="go-settings" aria-label="我的与设置">' + icon('i-user') + '</button>' +
        '</header>' +
        reminderBannerHTML() +

        '<section class="section">' +
        '  <div class="section-head"><h2>下一节课</h2><span class="rule" aria-hidden="true"></span></div>' +
        nextCardHTML() +
        '</section>' +

        '<section class="section">' +
        '  <div class="section-head"><h2>今日待办</h2><span class="rule" aria-hidden="true"></span>' +
        '    <button class="more" id="go-todos">全部</button></div>' +
        todosHTML() +
        '</section>' +

        '<section class="section">' +
        '  <div class="section-head"><h2>最近随手记</h2><span class="rule" aria-hidden="true"></span>' +
        '    <button class="more" id="go-notes">全部</button></div>' +
        notesHTML() +
        '</section>';

      wire(el);
      startCountdown();
    }
  });
})();