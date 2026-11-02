/* ============================================================
   视图 · 课表（页签 2）
   节次格周视图 + 当前时间线插值 + 左右滑切周 + 学期结束态
   依据：PRD v0.2 §4.3（FR-C1~C6）；手册 §8.5
   ============================================================ */

(function () {
  'use strict';

  var ROW_H = 64;               /* 节次格高固定（PRD §4.3 节次格） */
  var weekOffset = 0;           /* 相对当前周的偏移 */

  function icon(id, cls) {
    return '<svg class="' + (cls || 'icon') + '" aria-hidden="true"><use href="#' + id + '"/></svg>';
  }

  function periodsOf(sem) {
    return (sem && sem.periods && sem.periods.length) ? sem.periods : util.DEFAULT_PERIODS;
  }

  function semEndDate(sem) {
    return util.addDays(sem.startDate, (sem.totalWeeks || 20) * 7 - 1);
  }

  function weekModeLabel(c) {
    if (c.weekMode === 'odd') return '单';
    if (c.weekMode === 'even') return '双';
    if (c.weekMode === 'custom') return '调';
    return '';
  }

  /* 同一天内把相互重叠（或相邻）的课程聚合成分列簇，避免互相遮挡 */
  function layoutDay(list, periods) {
    var items = list.map(function (c) {
      var secs = (c.sections || [1]).slice().sort(function (a, b) { return a - b; });
      return { course: c, secs: secs, top: (secs[0] - 1) * ROW_H, bottom: (secs[secs.length - 1]) * ROW_H };
    }).sort(function (a, b) { return a.top - b.top; });

    var clusters = [];
    items.forEach(function (it) {
      var last = clusters[clusters.length - 1];
      if (last && it.top < last.bottom) {
        last.items.push(it);
        last.bottom = Math.max(last.bottom, it.bottom);
      } else {
        clusters.push({ bottom: it.bottom, items: [it] });
      }
    });

    clusters.forEach(function (cl) {
      cl.items.forEach(function (it, idx) {
        it.col = idx;
        it.colCount = cl.items.length;
      });
    });
    return items;
  }

  function blocksHTML(dayCourses, periods) {
    var items = layoutDay(dayCourses, periods);
    return items.map(function (it) {
      var c = it.course;
      var span = (it.secs[it.secs.length - 1] - it.secs[0]) + 1;
      var height = span * ROW_H - 6;
      var colW = 100 / it.colCount;
      var colorIdx = ((typeof c.color === 'number' ? c.color - 1 : 0) % 8) + 1;
      var badge = weekModeLabel(c);
      return '<button class="course-block' + (span >= 2 ? ' cb-tall' : '') + '" data-course="' + c.id + '" ' +
        'style="top:' + (it.top + 3) + 'px;height:' + height + 'px;' +
        'left:calc(' + (it.col * colW) + '% + 2px);width:calc(' + colW + '% - 4px);' +
        '--cc: var(--course-' + colorIdx + ');--cc-text: var(--course-' + colorIdx + '-text)">' +
        '<span class="cb-name">' + util.escapeHTML(c.name) + '</span>' +
        '<span class="cb-meta">' + (c.location ? util.escapeHTML(c.location) : '') + '</span>' +
        (badge ? '<span class="cb-badge">' + badge + '</span>' : '') +
        '</button>';
    }).join('');
  }

  function nowLineHTML(periods) {
    var periodsCount = periods.length;
    var startMin = util.minutesOf(periods[0].start);
    var endMin = util.minutesOf(periods[periodsCount - 1].end);
    var now = util.nowMinutes();
    if (now < startMin || now > endMin) return '';
    var ratio = (now - startMin) / (endMin - startMin);
    return '<div class="now-line" style="top:' + Math.round(ratio * periodsCount * ROW_H) + 'px"><span class="now-dot"></span></div>';
  }

  function gridHTML(sem, showWeek, today) {
    var periods = periodsOf(sem);
    var todayDow = util.dayIndex(today);
    var isThisWeek = util.weekOf(sem, today) === showWeek;

    var head = '<div class="wg-head"><span class="wg-corner"></span>';
    ['一', '二', '三', '四', '五', '六', '日'].forEach(function (w, i) {
      var d = i + 1;
      head += '<span class="wg-day' + (isThisWeek && d === todayDow ? ' today' : '') + '">' + w + '</span>';
    });
    head += '</div>';

    var times = '<div class="wg-times">' + periods.map(function (p) {
      return '<div class="wg-time"><span>' + p.start + '</span><span>' + p.end + '</span></div>';
    }).join('') + '</div>';

    var all = window.storage.get('courses', []) || [];
    var cols = '';
    for (var day = 1; day <= 7; day++) {
      var dayCourses = all.filter(function (c) { return util.courseOccurs(c, showWeek, day); });
      var line = (isThisWeek && day === todayDow) ? nowLineHTML(periods) : '';
      cols += '<div class="wg-col' + (isThisWeek && day === todayDow ? ' today' : '') + '" data-day="' + day + '">' +
        blocksHTML(dayCourses, periods) + line + '</div>';
    }

    return '<div class="week-grid" id="week-grid" style="--row-h:' + ROW_H + 'px">' +
      head +
      '<div class="wg-main">' + times + '<div class="wg-cols">' + cols + '</div></div>' +
      '</div>';
  }

  App.register('schedule', {
    render: function (el) {
      var sem = window.storage.get('semester', null);
      if (sem && !sem.startDate) sem = null; /* 脏数据兜底：缺开学日期按未配置处理 */
      var courses = window.storage.get('courses', []) || [];
      var today = util.todayStr();
      var total = sem ? (sem.totalWeeks || 20) : 20;
      var realWeek = sem ? util.weekOf(sem, today) : null;
      var ended = sem ? (today > semEndDate(sem)) : false;
      var beforeStart = sem ? (today < sem.startDate) : false;

      /* 学期未配置 */
      if (!sem) {
        el.innerHTML =
          '<header class="page-head">' +
          '  <div class="ph-main">' +
          '    <p class="kicker">' + util.dateStamp(today) + '</p>' +
          '    <h1 class="t-title">课表</h1>' +
          '    <p class="motto">还不知道你上什么课。</p>' +
          '  </div>' +
          '  <button class="avatar-btn" id="open-semester" aria-label="学期设置">' + icon('i-gear') + '</button>' +
          '</header>' +
          '<section class="section"><div class="empty">' +
          '  <div class="illust-slot" aria-hidden="true">' + Illust.course() + '</div>' +
          '  <p>先把学期建起来：开学日期定了，周次和单双周才算得准。</p>' +
          '  <button class="btn-primary" id="setup-semester">设置学期</button>' +
          '</div></section>';
        el.querySelector('#setup-semester').addEventListener('click', function () { App.openSemester(); });
        el.querySelector('#open-semester').addEventListener('click', function () { App.openSemester(); });
        return;
      }

      var baseWeek = realWeek || (ended ? total : 1);
      var showWeek = Math.min(total, Math.max(1, baseWeek + weekOffset));

      var motto = ended ? '本学期已结束，设个新学期吧。'
        : (beforeStart ? '还没开学，先看看第一周。'
        : '这学期 ' + courses.length + ' 门课。');

      el.innerHTML =
        '<header class="page-head">' +
        '  <div class="ph-main">' +
        '    <p class="kicker">' + util.dateStamp(today) + '</p>' +
        '    <h1 class="t-title">课表</h1>' +
        '    <p class="motto">' + motto + '</p>' +
        '  </div>' +
        '  <button class="avatar-btn" id="open-semester" aria-label="学期设置">' + icon('i-gear') + '</button>' +
        '</header>' +
        (ended ? '<div class="ended-banner">' + icon('i-alert', 'icon-20') + '<span>本学期已结束，最后一周仍可翻看与补录。</span></div>' : '') +
        '<div class="week-bar">' +
        '  <button class="cal-nav" id="prev-week" aria-label="上一周">‹</button>' +
        '  <strong class="week-title">第 ' + showWeek + ' 周</strong>' +
        '  <button class="cal-nav" id="next-week" aria-label="下一周">›</button>' +
        (weekOffset !== 0 || ended ? '<button class="more" id="back-week">回到本周</button>' : '') +
        '</div>' +
        gridHTML(sem, showWeek, today) +
        '<div class="section" style="margin-top:var(--sp-5)">' +
        (courses.length === 0
          ? '<div class="empty slim">' +
            '<p>还没有课程。添加第一节，课表就活了。</p>' +
            '<button class="btn-primary" id="add-course">添加第一节</button></div>'
          : '<button class="btn-secondary" id="add-course" style="width:100%">添加课程</button>') +
        '<p class="import-note">导入课表下学期开放</p>' +
        '</div>';

      /* —— 事件 —— */
      el.querySelector('#open-semester').addEventListener('click', function () { App.openSemester(); });
      el.querySelector('#add-course').addEventListener('click', function () { App.openCourseForm({}); });

      el.querySelector('#prev-week').addEventListener('click', function () { weekOffset--; App.refresh(); });
      el.querySelector('#next-week').addEventListener('click', function () { weekOffset++; App.refresh(); });
      var backBtn = el.querySelector('#back-week');
      if (backBtn) backBtn.addEventListener('click', function () { weekOffset = 0; App.refresh(); });

      el.querySelectorAll('[data-course]').forEach(function (btn) {
        btn.addEventListener('click', function () { App.openCourseDetail(btn.dataset.course); });
      });
      el.querySelectorAll('.wg-col').forEach(function (col) {
        col.addEventListener('click', function (e) {
          if (e.target.closest('.course-block')) return;
          App.openCourseForm({ day: +col.dataset.day });
        });
      });

      /* 左右滑切周 */
      var grid = el.querySelector('#week-grid');
      var startX = null;
      grid.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
      grid.addEventListener('touchend', function (e) {
        if (startX === null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 48) { weekOffset += dx < 0 ? 1 : -1; App.refresh(); }
        startX = null;
      });
    }
  });
})();