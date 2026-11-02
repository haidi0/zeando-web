/* ============================================================
   ⊕ 落笔半屏 · 两种记录表单（随手记 / 待办）
   依据：PRD v0.2 §4.1 / §4.2 / §5.2 / §5.3；手册 §8.4 / §8.6 / §10
   ============================================================ */

(function () {
  'use strict';

  var SAVE_PHRASES = ['记下了。', '落笔为安。', '收好了。', '记下来了。'];
  var SAVE_TODO_PHRASES = ['收进待办了。', '记下了，到点提醒。'];
  var CATEGORIES = [
    { id: 'study', label: '学习', color: '--course-3' },   /* 黛蓝 */
    { id: 'work', label: '工作', color: '--course-4' },    /* 藤黄 */
    { id: 'life', label: '生活', color: '--course-2' },    /* 苔绿 */
    { id: 'club', label: '社团', color: '--course-5' }     /* 绛紫 */
  ];
  var DRAFT_TTL = 10 * 60 * 1000;

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function backBar(title) {
    return '<button class="sheet-back" id="sheet-back" aria-label="返回类型选择">‹ 返回</button>' +
      '<h2 class="t-h2 sheet-title">' + title + '</h2>';
  }

  function wireBack() {
    var b = document.getElementById('sheet-back');
    if (b) b.addEventListener('click', function () { App.sheetMode('types'); });
  }

  /* ---------- 随手记 ---------- */
  function renderNote(host) {
    var draft = window.storage.get('draft', null);
    var useDraft = draft && draft.type === 'note' && (Date.now() - (draft.savedAt || 0) < DRAFT_TTL);
    var text = useDraft ? draft.text : '';

    host.innerHTML =
      backBar('随手记') +
      '<div class="mirror-wrap">' +
      '  <div class="mirror" id="note-mirror" aria-hidden="true"></div>' +
      '  <textarea id="note-text" class="capture-textarea" rows="4" maxlength="600" placeholder="记点什么……"></textarea>' +
      '</div>' +
      '<div class="capture-meta">' +
      '  <span id="tag-hint" class="t-caption"></span>' +
      '  <span id="note-count" class="t-caption t-num">0/500</span>' +
      '</div>' +
      '<div class="capture-actions">' +
      '  <button class="btn-secondary" id="note-cancel">取消</button>' +
      '  <button class="btn-primary" id="note-save" disabled>记下</button>' +
      '</div>';

    var ta = document.getElementById('note-text');
    var mirror = document.getElementById('note-mirror');
    var count = document.getElementById('note-count');
    var hint = document.getElementById('tag-hint');
    var saveBtn = document.getElementById('note-save');

    function paint() {
      var v = ta.value;
      var tags = util.extractTags(v);
      /* 统计全部去重标签（超 3 提示，PRD §4.1 第 4 个不识别轻提示） */
      var allTags = [];
      var re = /#([^\s#]{1,20})/g, mm;
      while ((mm = re.exec(v)) !== null) {
        if (allTags.indexOf(mm[1]) === -1) allTags.push(mm[1]);
        if (allTags.length > 4) break;
      }
      /* 行内高亮镜像：#标签 砖橘文字级 */
      var html = v === '' ? '<span class="ph">记点什么……</span>'
        : util.escapeHTML(v).replace(/#([^\s#]{1,20})/g, '<span class="tag-hl">#$1</span>');
      mirror.innerHTML = html + '<br>';
      mirror.scrollTop = ta.scrollTop;

      var len = v.length;
      count.textContent = len + '/500';
      count.classList.toggle('over', len > 500);
      hint.textContent = allTags.length > 3 ? '最多 3 个标签' : '';
      saveBtn.disabled = v.trim() === '' || len > 500;
    }

    function saveDraft() {
      var v = ta.value;
      if (v.trim() === '') { window.storage.remove('draft'); return; }
      window.storage.set('draft', { type: 'note', text: v, savedAt: Date.now() });
    }

    var draftTimer = null;
    ta.addEventListener('input', function () {
      /* 超过 500 字：截断并提示（PRD：计数变红，禁止继续输入） */
      if (ta.value.length > 500) {
        ta.value = ta.value.slice(0, 500);
        App.toast('最多 500 字。');
      }
      paint();
      clearTimeout(draftTimer);
      draftTimer = setTimeout(saveDraft, 400);
    });
    ta.addEventListener('scroll', function () { mirror.scrollTop = ta.scrollTop; });

    if (text) { ta.value = text; }
    paint();
    ta.focus();
    /* 光标移到末尾 */
    ta.setSelectionRange(ta.value.length, ta.value.length);

    document.getElementById('note-cancel').addEventListener('click', function () {
      requestClose(ta, saveDraft);
    });

    saveBtn.addEventListener('click', function () {
      var v = ta.value.trim();
      if (!v) return;
      var notes = window.storage.get('notes', []) || [];
      notes.unshift({ id: uid(), text: v, tags: util.extractTags(v), createdAt: Date.now() });
      window.storage.set('notes', notes);
      window.storage.remove('draft');
      App.closeSheet();
      App.toast(pick(SAVE_PHRASES));
      App.refresh();
    });

    wireBack();
  }

  /* 有内容点关闭 → 确认；无论选哪边，草稿保留 10 分钟（PRD §5.2） */
  function requestClose(ta, saveDraft) {
    if (ta.value.trim() === '') { window.storage.remove('draft'); App.closeSheet(); return; }
    saveDraft();
    var bar = document.createElement('div');
    bar.className = 'confirm-bar';
    bar.innerHTML = '<span>这条还没记，关掉会留在草稿里。</span>' +
      '<button class="toast-action" id="cf-no">继续写</button>' +
      '<button class="toast-action" id="cf-yes">先放着</button>';
    var panel = document.getElementById('sheet-content');
    panel.appendChild(bar);
    bar.querySelector('#cf-no').addEventListener('click', function () { bar.remove(); ta.focus(); });
    bar.querySelector('#cf-yes').addEventListener('click', function () { App.closeSheet(); });
  }

  /* ---------- 待办（新建 / 编辑共用；preset: {todo?, date?}） ---------- */
  function renderTodo(host, preset) {
    preset = preset || {};
    var isEdit = !!preset.todo;
    var editing = preset.todo || null;
    var courses = window.storage.get('courses', []) || [];
    var defaultDate = editing ? editing.date : (preset.date || util.todayStr());

    var catRows = CATEGORIES.map(function (c) {
      var checked = editing ? editing.category === c.id : c.id === 'study';
      return '<label class="cat-chip" style="--cat-color: var(' + c.color + ')">' +
        '<input type="radio" name="cat" value="' + c.id + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="dot" aria-hidden="true"></span>' + c.label + '</label>';
    }).join('');

    var courseField;
    if (courses.length === 0) {
      courseField = '<div class="field-note">还没有课程 —— <button class="link-btn" id="go-add-course">去课表页添加</button></div>';
    } else {
      var opts = courses.map(function (c) {
        var sel = editing && editing.courseId === c.id ? ' selected' : '';
        return '<option value="' + util.escapeHTML(c.id) + '"' + sel + '>' + util.escapeHTML(c.name) + '</option>';
      }).join('');
      courseField = '<select id="todo-course" class="input"><option value="">不关联</option>' + opts + '</select>';
    }

    var defaultReminder = (window.storage.get('settings', {}) || {}).reminderDefault || 'off';
    var reminderVal = editing ? editing.reminder || 'off' : defaultReminder;

    host.innerHTML =
      backBar(isEdit ? '这条待办' : '待办') +
      '<div class="form">' +
      '  <label class="field"><span class="field-label">标题 <b>*</b></span>' +
      '    <input id="todo-title" class="input" type="text" maxlength="60" placeholder="要做什么？" value="' +
      (editing ? util.escapeHTML(editing.title) : '') + '"></label>' +
      '  <div class="field-row">' +
      '    <label class="field"><span class="field-label">日期 <b>*</b></span>' +
      '      <input id="todo-date" class="input" type="date" value="' + defaultDate + '"></label>' +
      '    <label class="field"><span class="field-label">时间（可选）</span>' +
      '      <input id="todo-time" class="input" type="time" value="' + (editing && editing.time ? editing.time : '') + '"></label>' +
      '  </div>' +
      '  <div class="field"><span class="field-label">分类</span>' +
      '    <div class="cat-row" id="cat-row">' + catRows + '</div></div>' +
      '  <label class="field"><span class="field-label">关联课程</span>' + courseField + '</label>' +
      '  <label class="field"><span class="field-label">提醒</span>' +
      '    <select id="todo-reminder" class="input">' +
      '      <option value="off">不提醒</option>' +
      '      <option value="sameDay9">当天 9:00</option>' +
      '      <option value="min30">提前 30 分钟</option>' +
      '      <option value="day1">提前 1 天</option>' +
      '    </select>' +
      '    <span class="field-note" id="reminder-note"></span></label>' +
      '  <label class="field"><span class="field-label">备注（可选）</span>' +
      '    <textarea id="todo-note" class="input textarea" rows="2" maxlength="200" placeholder="补充点什么">' +
      (editing && editing.note ? util.escapeHTML(editing.note) : '') + '</textarea></label>' +
      '</div>' +
      '<div class="capture-actions detail-actions">' +
      (isEdit ? '<button class="btn-text-danger" id="todo-delete">删除</button><span class="detail-spacer"></span>' : '') +
      '  <button class="btn-secondary" id="todo-cancel">取消</button>' +
      '  <button class="btn-primary" id="todo-save" disabled>' + (isEdit ? '保存' : '记下') + '</button>' +
      '</div>';

    var titleEl = document.getElementById('todo-title');
    var timeEl = document.getElementById('todo-time');
    var dateEl = document.getElementById('todo-date');
    var reminderEl = document.getElementById('todo-reminder');
    var noteEl = document.getElementById('reminder-note');
    var saveBtn = document.getElementById('todo-save');
    reminderEl.value = reminderVal;

    var autoResetReminder = false; /* 因无时间被自动回落时记下，补上时间后恢复 */

    function refreshForm() {
      saveBtn.disabled = titleEl.value.trim() === '';
      /* 无时间待办：「提前 30 分钟」无参照点，置灰（PRD §4.2） */
      var opt30 = reminderEl.querySelector('option[value="min30"]');
      opt30.disabled = !timeEl.value;
      if (!timeEl.value && reminderEl.value === 'min30') {
        reminderEl.value = 'off';
        autoResetReminder = (defaultReminder === 'min30');
      }
      if (timeEl.value && autoResetReminder && !opt30.disabled && reminderEl.dataset.touched !== '1') {
        reminderEl.value = 'min30';
        autoResetReminder = false;
      }
      /* 当天 9:00 已过 → 本次不提醒 */
      noteEl.textContent = '';
      if (reminderEl.value === 'sameDay9' && dateEl.value === util.todayStr() && util.nowMinutes() > 540) {
        noteEl.textContent = '今天 9:00 已过，这次不提醒。';
      }
    }

    titleEl.addEventListener('input', refreshForm);
    timeEl.addEventListener('input', refreshForm);
    dateEl.addEventListener('change', refreshForm);
    reminderEl.addEventListener('change', function () {
      reminderEl.dataset.touched = '1';
      autoResetReminder = false;
      refreshForm();
    });
    refreshForm();
    titleEl.focus();

    document.getElementById('todo-cancel').addEventListener('click', function () { App.closeSheet(); });

    var goAdd = document.getElementById('go-add-course');
    if (goAdd) goAdd.addEventListener('click', function () { App.closeSheet(); App.navigate('schedule'); });

    saveBtn.addEventListener('click', function () {
      var title = titleEl.value.trim();
      if (!title) return;
      var cat = (host.querySelector('input[name="cat"]:checked') || {}).value || 'study';
      var courseSel = document.getElementById('todo-course');
      var todos = window.storage.get('todos', []) || [];
      var payload = {
        title: title,
        date: dateEl.value || util.todayStr(),
        time: timeEl.value || '',
        category: cat,
        courseId: courseSel ? courseSel.value : '',
        reminder: reminderEl.value,
        note: (document.getElementById('todo-note') || {}).value || ''
      };
      if (isEdit) {
        var target = todos.filter(function (x) { return x.id === editing.id; })[0];
        if (target) { Object.assign(target, payload); target.notifiedAt = null; }
        window.storage.set('todos', todos);
        App.closeSheet();
        App.toast('改好了。');
        App.refresh();
      } else {
        todos.unshift(Object.assign({ id: uid(), done: false, createdAt: Date.now() }, payload));
        window.storage.set('todos', todos);
        App.closeSheet();
        App.toast(pick(SAVE_TODO_PHRASES));
        App.refresh();
      }
    });

    if (isEdit) {
      document.getElementById('todo-delete').addEventListener('click', function () {
        var confirmBar = document.createElement('div');
        confirmBar.className = 'confirm-bar';
        confirmBar.innerHTML = '<span>删除这条待办？</span>' +
          '<button class="toast-action" id="tdel-cancel">先留着</button>' +
          '<button class="btn-text-danger" id="tdel-yes">删除</button>';
        document.getElementById('sheet-content').appendChild(confirmBar);
        confirmBar.querySelector('#tdel-cancel').addEventListener('click', function () { confirmBar.remove(); });
        confirmBar.querySelector('#tdel-yes').addEventListener('click', function () {
          var list = window.storage.get('todos', []) || [];
          var idx = -1;
          list.forEach(function (x, i) { if (x.id === editing.id) idx = i; });
          if (idx < 0) { App.closeSheet(); return; }
          var removed = list[idx];
          list.splice(idx, 1);
          window.storage.set('todos', list);
          App.closeSheet();
          App.toast('已删除。', {
            action: {
              label: '撤销',
              onClick: function () {
                var cur = window.storage.get('todos', []) || [];
                cur.splice(Math.min(idx, cur.length), 0, removed);
                window.storage.set('todos', cur);
                App.refresh();
              }
            }
          });
          setTimeout(function () { App.refresh(); }, 300);
        });
      });
    }

    wireBack();
  }

  /* ---------- 随手记详情（编辑/删除，note-edit 模式） ---------- */
  function renderNoteDetail(host, id) {
    var notes = window.storage.get('notes', []) || [];
    var note = notes.filter(function (n) { return n.id === id; })[0];
    if (!note) { App.sheetMode('types'); return; }

    host.innerHTML =
      backBar('这条记录') +
      '<div class="mirror-wrap">' +
      '  <div class="mirror" id="note-mirror" aria-hidden="true"></div>' +
      '  <textarea id="note-text" class="capture-textarea" rows="4" maxlength="600"></textarea>' +
      '</div>' +
      '<div class="capture-meta">' +
      '  <span id="tag-hint" class="t-caption"></span>' +
      '  <span id="note-count" class="t-caption t-num"></span>' +
      '</div>' +
      '<div class="capture-actions detail-actions">' +
      '  <button class="btn-text-danger" id="note-delete">删除</button>' +
      '  <span class="detail-spacer"></span>' +
      '  <button class="btn-secondary" id="note-cancel">取消</button>' +
      '  <button class="btn-primary" id="note-save">保存</button>' +
      '</div>';

    var ta = document.getElementById('note-text');
    var mirror = document.getElementById('note-mirror');
    var count = document.getElementById('note-count');
    var hint = document.getElementById('tag-hint');

    function paint() {
      var v = ta.value;
      var allTags = [];
      var re = /#([^\s#]{1,20})/g, mm;
      while ((mm = re.exec(v)) !== null) {
        if (allTags.indexOf(mm[1]) === -1) allTags.push(mm[1]);
        if (allTags.length > 4) break;
      }
      mirror.innerHTML = (v === '' ? '' : util.escapeHTML(v).replace(/#([^\s#]{1,20})/g, '<span class="tag-hl">#$1</span>')) + '<br>';
      mirror.scrollTop = ta.scrollTop;
      count.textContent = v.length + '/500';
      count.classList.toggle('over', v.length > 500);
      hint.textContent = allTags.length > 3 ? '最多 3 个标签' : '';
    }

    ta.value = note.text;
    paint();
    ta.addEventListener('input', function () {
      if (ta.value.length > 500) { ta.value = ta.value.slice(0, 500); App.toast('最多 500 字。'); }
      paint();
    });
    ta.addEventListener('scroll', function () { mirror.scrollTop = ta.scrollTop; });
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);

    document.getElementById('note-cancel').addEventListener('click', function () { App.closeSheet(); });

    document.getElementById('note-save').addEventListener('click', function () {
      var v = ta.value.trim();
      if (!v) { App.toast('空记录不能保存。'); return; }
      var list = window.storage.get('notes', []) || [];
      var target = list.filter(function (n) { return n.id === id; })[0];
      if (target) {
        target.text = v;
        target.tags = util.extractTags(v);
        window.storage.set('notes', list);
      }
      App.closeSheet();
      App.toast('改好了。');
      App.refresh();
    });

    document.getElementById('note-delete').addEventListener('click', function () {
      var confirmBar = document.createElement('div');
      confirmBar.className = 'confirm-bar';
      confirmBar.innerHTML = '<span>删除这条记录？删了就找回来了，除非 5 秒内撤销。</span>' +
        '<button class="toast-action" id="del-cancel">先留着</button>' +
        '<button class="btn-text-danger" id="del-yes">删除</button>';
      document.getElementById('sheet-content').appendChild(confirmBar);
      confirmBar.querySelector('#del-cancel').addEventListener('click', function () { confirmBar.remove(); });
      confirmBar.querySelector('#del-yes').addEventListener('click', function () {
        var list = window.storage.get('notes', []) || [];
        var idx = -1;
        list.forEach(function (n, i) { if (n.id === id) idx = i; });
        if (idx < 0) { App.closeSheet(); return; }
        var removed = list[idx];
        list.splice(idx, 1);
        window.storage.set('notes', list);
        App.closeSheet();
        App.toast('已删除。', {
          action: {
            label: '撤销',
            onClick: function () {
              var cur = window.storage.get('notes', []) || [];
              cur.splice(Math.min(idx, cur.length), 0, removed);
              window.storage.set('notes', cur);
              App.refresh();
            }
          }
        });
        setTimeout(function () { if (App.state.tab === 'notes') App.refresh(); }, 300);
      });
    });

    wireBack();
  }

  App.capture = { renderNote: renderNote, renderTodo: renderTodo, renderNoteDetail: renderNoteDetail, CATEGORIES: CATEGORIES };
})();