/* ============================================================
   课表域半屏：课程详情 / 课程表单（新增·编辑·冲突检查）/ 学期设置
   依据：PRD v0.2 §4.3（FR-C1/C2/C5/C6）、§5.4；手册 §8.5 / §8.6
   ============================================================ */

(function () {
  'use strict';

  var COLOR_NAMES = ['砖橘', '苔绿', '黛蓝', '藤黄', '绛紫', '青灰', '橄榄', '栗棕'];

  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function snapshotCourses() { return JSON.stringify(window.storage.get('courses', []) || []); }
  function restoreCourses(snap) { window.storage.set('courses', JSON.parse(snap)); }

  function periodsOf(sem) { return (sem && sem.periods && sem.periods.length) ? sem.periods : util.DEFAULT_PERIODS; }

  function occursInWeek(c, w) {
    var mode = c.weekMode || 'all';
    if (mode === 'odd') return w % 2 === 1;
    if (mode === 'even') return w % 2 === 0;
    if (mode === 'custom') {
      var f = (c.weeks && c.weeks.from) || 1;
      var t = (c.weeks && c.weeks.to) || 99;
      return w >= f && w <= t;
    }
    return true;
  }

  function weeksOverlap(a, b, total) {
    for (var w = 1; w <= total; w++) {
      if (occursInWeek(a, w) && occursInWeek(b, w)) return true;
    }
    return false;
  }

  function findConflict(candidate, courses, total) {
    return courses.filter(function (c) {
      if (c.id === candidate.id) return false;
      if (c.day !== candidate.day) return false;
      var intersect = (c.sections || []).some(function (s) { return candidate.sections.indexOf(s) !== -1; });
      return intersect && weeksOverlap(c, candidate, total);
    })[0] || null;
  }

  function weekModeText(c) {
    if (c.weekMode === 'odd') return '单周';
    if (c.weekMode === 'even') return '双周';
    if (c.weekMode === 'custom') {
      return '第 ' + ((c.weeks && c.weeks.from) || 1) + '–' + ((c.weeks && c.weeks.to) || '末') + ' 周';
    }
    return '每周';
  }

  /* ---------- 课程详情 ---------- */
  function renderCourseDetail(host, id) {
    var courses = window.storage.get('courses', []) || [];
    var c = courses.filter(function (x) { return x.id === id; })[0];
    if (!c) { App.sheetMode('types'); return; }
    var sem = window.storage.get('semester', null);
    var periods = periodsOf(sem);
    var todos = window.storage.get('todos', []) || [];
    var related = todos.filter(function (t) { return t.courseId === id && !t.done; });
    var secs = (c.sections || [1]).slice().sort(function (a, b) { return a - b; });
    var colorIdx = ((typeof c.color === 'number' ? c.color - 1 : 0) % 8) + 1;

    var todoRows = related.length > 0
      ? '<div class="related-list">' + related.map(function (t) {
          return '<button class="related-item" data-todo="' + t.id + '">' +
            '<span class="cat-dot" style="background: var(--brick)"></span>' +
            '<span>' + util.escapeHTML(t.title) + '</span>' +
            '<span class="t-caption">' + util.shortDate(t.date) + (t.time ? ' ' + t.time : '') + '</span>' +
            '</button>';
        }).join('') + '</div>'
      : '<p class="t-body-s">还没有挂在这门课上的待办。</p>';

    host.innerHTML =
      '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<div class="course-detail-head" style="--cc: var(--course-' + colorIdx + ')">' +
      '  <h2 class="t-h2">' + util.escapeHTML(c.name) + '</h2>' +
      '  <p class="t-body-s">' + util.dayCn(util.addDays(util.todayStr(), (c.day || 1) - util.dayIndex(util.todayStr()))) +
      ' · 第 ' + secs[0] + (secs.length > 1 ? '–' + secs[secs.length - 1] : '') + ' 节 · ' + weekModeText(c) + '</p>' +
      '  <p class="t-body-s">' + (c.location ? util.escapeHTML(c.location) : '未填地点') +
      (c.teacher ? ' · ' + util.escapeHTML(c.teacher) : '') + '</p>' +
      '</div>' +
      (c.note ? '<p class="course-note t-body-s">' + util.escapeHTML(c.note) + '</p>' : '') +
      '<div class="section-head" style="margin-top:var(--sp-4)"><h3 class="t-h3">关联待办</h3></div>' +
      todoRows +
      '<div class="capture-actions detail-actions">' +
      '  <button class="btn-text-danger" id="course-delete">删除</button>' +
      '  <span class="detail-spacer"></span>' +
      '  <button class="btn-secondary" id="course-close">关闭</button>' +
      '  <button class="btn-primary" id="course-edit">编辑</button>' +
      '</div>';

    host.querySelector('#course-close').addEventListener('click', function () { App.closeSheet(); });
    host.querySelector('#course-edit').addEventListener('click', function () {
      App.openCourseForm({ id: id });
    });
    host.querySelectorAll('[data-todo]').forEach(function (b) {
      b.addEventListener('click', function () { App.closeSheet(); App.openTodoEdit(b.dataset.todo); });
    });

    host.querySelector('#course-delete').addEventListener('click', function () {
      var bar = document.createElement('div');
      bar.className = 'confirm-bar';
      bar.innerHTML = '<span>删除这门课？它会从周视图消失，关联待办会保留。</span>' +
        '<button class="toast-action" id="cdel-cancel">先留着</button>' +
        '<button class="btn-text-danger" id="cdel-yes">删除</button>';
      host.appendChild(bar);
      bar.querySelector('#cdel-cancel').addEventListener('click', function () { bar.remove(); });
      bar.querySelector('#cdel-yes').addEventListener('click', function () {
        var snapCourses = snapshotCourses();
        var list = window.storage.get('courses', []) || [];
        list = list.filter(function (x) { return x.id !== id; });
        window.storage.set('courses', list);
        /* 关联待办保留但清除关联标记（FR-T4） */
        var todos2 = window.storage.get('todos', []) || [];
        var cleared = 0;
        todos2.forEach(function (t) { if (t.courseId === id) { t.courseId = ''; cleared++; } });
        window.storage.set('todos', todos2);
        App.closeSheet();
        App.toast(cleared > 0 ? '已删除，' + cleared + ' 条关联待办保留了。' : '已删除。', {
          action: {
            label: '撤销',
            onClick: function () { restoreCourses(snapCourses); App.refresh(); }
          }
        });
        setTimeout(function () { App.refresh(); }, 300);
      });
    });
  }

  /* ---------- 课程表单（新增 / 编辑） ---------- */
  function renderCourseForm(host, preset) {
    preset = preset || {};
    var sem = window.storage.get('semester', null);
    var periods = periodsOf(sem);
    var total = sem ? (sem.totalWeeks || 20) : 20;
    var courses = window.storage.get('courses', []) || [];
    var editing = preset.id ? courses.filter(function (c) { return c.id === preset.id; })[0] : null;
    if (preset.id && !editing) { App.sheetMode('types'); return; }

    var dayVal = editing ? editing.day : (preset.day || util.dayIndex(util.todayStr()));
    var secsVal = editing ? (editing.sections || [1]) : (preset.sections || [1]);
    var modeVal = editing ? (editing.weekMode || 'all') : 'all';
    var colorVal = editing ? (editing.color || 1) : ((courses.length % 8) + 1);
    var weeksVal = editing && editing.weeks ? editing.weeks : { from: 1, to: total };

    var dayOpts = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(function (d, i) {
      return '<option value="' + (i + 1) + '"' + (dayVal === i + 1 ? ' selected' : '') + '>' + d + '</option>';
    }).join('');

    var secChips = periods.map(function (p, i) {
      var n = i + 1;
      var on = secsVal.indexOf(n) !== -1;
      return '<label class="sec-chip' + (on ? ' on' : '') + '">' +
        '<input type="checkbox" name="sec" value="' + n + '"' + (on ? ' checked' : '') + '>' +
        '<span>第 ' + n + ' 节</span><span class="sec-time">' + p.start + '</span></label>';
    }).join('');

    var modeSeg = [['all', '每周'], ['odd', '单周'], ['even', '双周'], ['custom', '自定义']].map(function (m) {
      return '<button type="button" class="seg' + (modeVal === m[0] ? ' on' : '') + '" data-mode="' + m[0] + '">' + m[1] + '</button>';
    }).join('');

    var swatches = COLOR_NAMES.map(function (name, i) {
      var n = i + 1;
      return '<button type="button" class="swatch' + (colorVal === n ? ' on' : '') + '" data-color="' + n + '" ' +
        'style="--sw: var(--course-' + n + ')" aria-label="' + name + '"></button>';
    }).join('');

    host.innerHTML =
      '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<h2 class="t-h2 sheet-title">' + (editing ? '编辑课程' : '添加课程') + '</h2>' +
      '<div class="form">' +
      '  <label class="field"><span class="field-label">课名 <b>*</b></span>' +
      '    <input id="c-name" class="input" maxlength="20" placeholder="如：数据结构" value="' +
      (editing ? util.escapeHTML(editing.name) : '') + '"></label>' +
      '  <div class="field-row">' +
      '    <label class="field"><span class="field-label">教师</span>' +
      '      <input id="c-teacher" class="input" maxlength="12" value="' + (editing && editing.teacher ? util.escapeHTML(editing.teacher) : '') + '"></label>' +
      '    <label class="field"><span class="field-label">地点</span>' +
      '      <input id="c-location" class="input" maxlength="20" value="' + (editing && editing.location ? util.escapeHTML(editing.location) : '') + '"></label>' +
      '  </div>' +
      '  <div class="field-row">' +
      '    <label class="field"><span class="field-label">星期 <b>*</b></span>' +
      '      <select id="c-day" class="input">' + dayOpts + '</select></label>' +
      '    <div class="field"><span class="field-label">颜色</span>' +
      '      <div class="swatches" id="c-colors">' + swatches + '</div></div>' +
      '  </div>' +
      '  <div class="field"><span class="field-label">节次 <b>*</b>（可多选跨节）</span>' +
      '    <div class="sec-chips" id="c-secs">' + secChips + '</div></div>' +
      '  <div class="field"><span class="field-label">周模式</span>' +
      '    <div class="seg-group" id="c-mode">' + modeSeg + '</div>' +
      '    <div class="field-row" id="c-weeks" ' + (modeVal === 'custom' ? '' : 'hidden') + '>' +
      '      <label class="field"><span class="field-label">从第几周</span>' +
      '        <input id="c-week-from" class="input" type="number" min="1" max="' + total + '" value="' + weeksVal.from + '"></label>' +
      '      <label class="field"><span class="field-label">到第几周</span>' +
      '        <input id="c-week-to" class="input" type="number" min="1" max="' + total + '" value="' + weeksVal.to + '"></label>' +
      '    </div>' +
      '  </div>' +
      '  <label class="field"><span class="field-label">备注</span>' +
      '    <textarea id="c-note" class="input textarea" rows="2" maxlength="120">' + (editing && editing.note ? util.escapeHTML(editing.note) : '') + '</textarea></label>' +
      '</div>' +
      '<div class="capture-actions">' +
      '  <button class="btn-secondary" id="c-cancel">取消</button>' +
      '  <button class="btn-primary" id="c-save" disabled>保存</button>' +
      '</div>';

    var nameEl = host.querySelector('#c-name');
    var saveBtn = host.querySelector('#c-save');
    var modeEl = host.querySelector('#c-mode');
    var weeksRow = host.querySelector('#c-weeks');
    var currentMode = modeVal;
    var currentColor = colorVal;

    function refreshSave() { saveBtn.disabled = nameEl.value.trim() === ''; }
    nameEl.addEventListener('input', refreshSave);
    refreshSave();

    host.querySelectorAll('#c-secs input').forEach(function (cb) {
      cb.addEventListener('change', function () {
        cb.closest('.sec-chip').classList.toggle('on', cb.checked);
      });
    });
    modeEl.querySelectorAll('[data-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentMode = btn.dataset.mode;
        modeEl.querySelectorAll('[data-mode]').forEach(function (b) { b.classList.toggle('on', b === btn); });
        weeksRow.hidden = currentMode !== 'custom';
      });
    });
    host.querySelectorAll('.swatch').forEach(function (sw) {
      sw.addEventListener('click', function () {
        currentColor = +sw.dataset.color;
        host.querySelectorAll('.swatch').forEach(function (s) { s.classList.toggle('on', s === sw); });
      });
    });

    host.querySelector('#c-cancel').addEventListener('click', function () { App.closeSheet(); });

    function collect() {
      var secs = Array.prototype.slice.call(host.querySelectorAll('#c-secs input:checked'))
        .map(function (cb) { return +cb.value; }).sort(function (a, b) { return a - b; });
      return {
        id: editing ? editing.id : uid(),
        name: nameEl.value.trim(),
        teacher: host.querySelector('#c-teacher').value.trim(),
        location: host.querySelector('#c-location').value.trim(),
        day: +host.querySelector('#c-day').value,
        sections: secs.length ? secs : [1],
        weekMode: currentMode,
        weeks: currentMode === 'custom'
          ? { from: +host.querySelector('#c-week-from').value || 1, to: +host.querySelector('#c-week-to').value || total }
          : null,
        color: currentColor,
        note: host.querySelector('#c-note').value.trim()
      };
    }

    saveBtn.addEventListener('click', function () {
      var payload = collect();
      if (payload.sections.length === 0) { App.toast('至少选一节。'); return; }
      var conflict = findConflict(payload, courses, total);
      if (conflict) {
        var old = host.querySelector('.confirm-bar');
        if (old) old.remove();
        var bar = document.createElement('div');
        bar.className = 'confirm-bar';
        bar.innerHTML = '<span>与《' + util.escapeHTML(conflict.name) + '》重叠，仍要保存吗？</span>' +
          '<button class="toast-action" id="conf-back">返回修改</button>' +
          '<button class="toast-action" id="conf-save">仍要保存</button>';
        host.appendChild(bar);
        bar.querySelector('#conf-back').addEventListener('click', function () { bar.remove(); });
        bar.querySelector('#conf-save').addEventListener('click', function () { doSave(payload); });
        return;
      }
      doSave(payload);
    });

    function doSave(payload) {
      var snap = snapshotCourses();
      var list = window.storage.get('courses', []) || [];
      if (editing) {
        var idx = -1;
        list.forEach(function (c, i) { if (c.id === payload.id) idx = i; });
        if (idx >= 0) list[idx] = payload;
      } else {
        list.push(payload);
      }
      window.storage.set('courses', list);
      App.closeSheet();
      App.toast(editing ? '改好了，课表已更新。' : '课程添加好了。', {
        action: {
          label: '撤销',
          onClick: function () { restoreCourses(snap); App.refresh(); }
        }
      });
      /* 周视图与大卡同帧更新：refresh 立即重绘当前视图 */
      App.refresh();
    }
  }

  /* ---------- 学期设置 ---------- */
  function renderSemester(host) {
    var sem = window.storage.get('semester', null) || {
      name: '本学期', startDate: util.todayStr(), totalWeeks: 20, periods: util.DEFAULT_PERIODS.slice()
    };
    var periods = periodsOf(sem);

    var rows = periods.map(function (p, i) {
      return '<div class="period-row">' +
        '<span class="period-idx">' + (i + 1) + '</span>' +
        '<input class="input" type="time" data-pstart="' + i + '" value="' + p.start + '">' +
        '<span class="period-sep">–</span>' +
        '<input class="input" type="time" data-pend="' + i + '" value="' + p.end + '">' +
        '</div>';
    }).join('');

    host.innerHTML =
      '<div class="sheet-handle" aria-hidden="true"></div>' +
      '<h2 class="t-h2 sheet-title">学期设置</h2>' +
      '<p class="field-note" style="margin-bottom:var(--sp-4)">开学日期决定周次与单双周；填错了改这里，不用重建。</p>' +
      '<div class="form">' +
      '  <label class="field"><span class="field-label">学期名</span>' +
      '    <input id="s-name" class="input" maxlength="20" value="' + util.escapeHTML(sem.name || '本学期') + '"></label>' +
      '  <div class="field-row">' +
      '    <label class="field"><span class="field-label">开学日期 <b>*</b></span>' +
      '      <input id="s-start" class="input" type="date" value="' + sem.startDate + '"></label>' +
      '    <label class="field"><span class="field-label">总周数</span>' +
      '      <input id="s-weeks" class="input" type="number" min="1" max="30" value="' + (sem.totalWeeks || 20) + '"></label>' +
      '  </div>' +
      '  <div class="field"><span class="field-label">节次时间表（每节可改）</span>' +
      '    <div class="period-list">' + rows + '</div></div>' +
      '</div>' +
      '<div class="capture-actions">' +
      '  <button class="btn-secondary" id="s-cancel">取消</button>' +
      '  <button class="btn-primary" id="s-save">保存</button>' +
      '</div>';

    host.querySelector('#s-cancel').addEventListener('click', function () { App.closeSheet(); });
    host.querySelector('#s-save').addEventListener('click', function () {
      var newPeriods = periods.map(function (p, i) {
        return {
          start: host.querySelector('[data-pstart="' + i + '"]').value || p.start,
          end: host.querySelector('[data-pend="' + i + '"]').value || p.end
        };
      });
      var next = {
        name: host.querySelector('#s-name').value.trim() || '本学期',
        startDate: host.querySelector('#s-start').value || util.todayStr(),
        totalWeeks: Math.min(30, Math.max(1, +host.querySelector('#s-weeks').value || 20)),
        periods: newPeriods
      };
      window.storage.set('semester', next);
      App.closeSheet();
      App.toast('学期信息更新好了。');
      App.refresh();
    });
  }

  App.courseSheets = {
    renderCourseDetail: renderCourseDetail,
    renderCourseForm: renderCourseForm,
    renderSemester: renderSemester
  };

  App.openCourseDetail = function (id) {
    App.state.courseId = id;
    App.openSheet('course-detail');
  };
  App.openCourseForm = function (preset) {
    App.state.coursePreset = preset || {};
    App.openSheet('course-edit');
  };
  App.openSemester = function () {
    App.openSheet('semester');
  };
})();