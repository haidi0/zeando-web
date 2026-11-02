/* ============================================================
   zeanDO · 通用工具
   日期（周次/节次/倒计时）、转义、格式化
   依据：PRD v0.2 §4.3（下一节课卡五级决策链 / 倒计时格式）
   ============================================================ */

(function (global) {
  'use strict';

  var WEEK_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* 默认节次时间表：8:00~21:50 共 5 大节（含午休），每节可改（PRD §4.3） */
  var DEFAULT_PERIODS = [
    { start: '08:00', end: '09:35' },
    { start: '09:55', end: '11:30' },
    { start: '13:30', end: '15:05' },
    { start: '15:25', end: '17:00' },
    { start: '19:00', end: '21:50' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function todayStr() { return toDateStr(new Date()); }

  /* 'YYYY-MM-DD' → 本地零点的 Date */
  function parseDate(s) {
    var p = (s || '').split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function addDays(s, n) {
    var d = parseDate(s);
    d.setDate(d.getDate() + n);
    return toDateStr(d);
  }

  function diffDays(a, b) {
    return Math.round((parseDate(b) - parseDate(a)) / 86400000);
  }

  /* 周一=1 … 周日=7 */
  function dayIndex(dateStr) {
    var w = parseDate(dateStr).getDay();
    return w === 0 ? 7 : w;
  }

  function dayCn(dateStr) { return WEEK_CN[parseDate(dateStr).getDay()]; }

  function dateStamp(dateStr) {
    var d = parseDate(dateStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK_CN[d.getDay()];
  }

  function shortDate(dateStr) {
    var d = parseDate(dateStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  /* 当前是学期第几周（1 起）；不在学期内返回 null */
  function weekOf(semester, dateStr) {
    if (!semester || !semester.startDate) return null;
    dateStr = dateStr || todayStr();
    var w = Math.floor(diffDays(semester.startDate, dateStr) / 7) + 1;
    var total = semester.totalWeeks || 20;
    if (w < 1 || w > total) return null;
    return w;
  }

  /* 课程在某周某天是否上课；weekMode: all|odd|even|custom(weeks.from~to) */
  function courseOccurs(course, week, day) {
    if (!week || course.day !== day) return false;
    var mode = course.weekMode || 'all';
    if (mode === 'odd') return week % 2 === 1;
    if (mode === 'even') return week % 2 === 0;
    if (mode === 'custom') {
      var f = course.weeks && course.weeks.from;
      var t = course.weeks && course.weeks.to;
      return (f == null || week >= f) && (t == null || week <= t);
    }
    return true;
  }

  function minutesOf(hhmm) {
    var p = (hhmm || '00:00').split(':');
    return (+p[0]) * 60 + (+p[1]);
  }

  function nowMinutes() {
    var n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }

  /* 相对日期：今天/明天/后天/周X/下周X */
  function relativeDay(dateStr) {
    var today = todayStr();
    var d = diffDays(today, dateStr);
    if (d === 0) return '今天';
    if (d === 1) return '明天';
    if (d === 2) return '后天';
    var targetDow = dayIndex(dateStr);
    var todayDow = dayIndex(today);
    if (targetDow > todayDow && d < 7) return dayCn(dateStr);
    return '下' + dayCn(dateStr);
  }

  /* 倒计时文案（PRD §4.3）：<60 分钟显分钟；≥60 显「X 小时 X 分」；跨天显相对日期+时间 */
  function countdownText(dateStr, startHHMM) {
    var today = todayStr();
    var t = minutesOf(startHHMM);
    if (dateStr === today) {
      var mins = t - nowMinutes();
      if (mins <= 0) return '马上上课';
      if (mins < 60) return mins + ' 分钟';
      var h = Math.floor(mins / 60), m = mins % 60;
      return h + ' 小时' + (m > 0 ? ' ' + m + ' 分' : '');
    }
    return relativeDay(dateStr) + ' ' + startHHMM;
  }

  /* 下一节课五级决策链（PRD §4.3）：
     next → 今天下一节；done-today → 今天上完了；later → 逐日扫描的最近一节；
     due → 本学期无课/学期结束显示最近截止待办；empty → 无数据 */
  function nextClass(courses, semester, todos) {
    courses = courses || [];
    if (!semester || !semester.startDate) return { type: 'empty' };

    function dueOrEmpty() {
      var pending = (todos || []).filter(function (t) { return !t.done; })
        .sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
      if (pending.length > 0) return { type: 'due', todo: pending[0] };
      return { type: 'empty' };
    }

    if (courses.length === 0) return dueOrEmpty();

    var periods = semester.periods && semester.periods.length ? semester.periods : DEFAULT_PERIODS;
    var today = todayStr();
    var total = semester.totalWeeks || 20;
    var semesterEnd = addDays(semester.startDate, total * 7 - 1);

    for (var offset = 0; offset <= 130; offset++) {
      var dateStr = addDays(today, offset);
      if (dateStr > semesterEnd) break;
      var week = weekOf(semester, dateStr);
      if (week === null) continue; /* 开学前：向后找 */

      var day = dayIndex(dateStr);
      var list = courses.filter(function (c) { return courseOccurs(c, week, day); });
      if (list.length === 0) continue;

      var candidates = [];
      list.forEach(function (c) {
        var secs = (c.sections && c.sections.length ? c.sections : [1]).slice().sort(function (a, b) { return a - b; });
        var first = periods[secs[0] - 1] || periods[0];
        var last = periods[secs[secs.length - 1] - 1] || first;
        candidates.push({ course: c, start: first.start, end: last.end, secs: secs });
      });
      candidates.sort(function (a, b) { return minutesOf(a.start) - minutesOf(b.start); });

      if (offset === 0) {
        var now = nowMinutes();
        var unfinished = candidates.filter(function (c) { return minutesOf(c.end) > now; });
        if (unfinished.length > 0) {
          return { type: 'next', date: dateStr, entry: unfinished[0] };
        }
        return {
          type: 'done-today',
          date: dateStr,
          entry: null,
          tomorrow: findNextAfter(semester, courses, dateStr, periods, semesterEnd)
        };
      }
      return { type: 'later', date: dateStr, entry: candidates[0] };
    }

    return dueOrEmpty();
  }

  function findNextAfter(semester, courses, fromDate, periods, semesterEnd) {
    for (var offset = 1; offset <= 130; offset++) {
      var dateStr = addDays(fromDate, offset);
      if (semesterEnd && dateStr > semesterEnd) return null;
      var week = weekOf(semester, dateStr);
      if (week === null) continue;
      var day = dayIndex(dateStr);
      var list = courses.filter(function (c) { return courseOccurs(c, week, day); });
      if (list.length > 0) {
        var c = list[0];
        var secs = (c.sections && c.sections.length ? c.sections : [1]).slice().sort(function (a, b) { return a - b; });
        var first = periods[secs[0] - 1] || periods[0];
        return { course: c, date: dateStr, start: first.start };
      }
    }
    return null;
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* 待办五段分组（PRD §4.2 自然日边界）：
     逾期 < 今天 = 当日 < 明天 = 次自然日（可跨周） < 本周 = 自然周（周一~周日）内除今天/明天
     < 稍后 = 下周一起；已完成单列（按完成时间倒序） */
  function groupTodos(todos, dateStr) {
    var today = dateStr || todayStr();
    var tomorrow = addDays(today, 1);
    var weekday = dayIndex(today);            // 周一=1 … 周日=7
    var weekEnd = addDays(today, 7 - weekday); /* 本周日 */
    var g = { overdue: [], today: [], tomorrow: [], week: [], later: [], done: [] };

    (todos || []).forEach(function (t) {
      if (!t.date) return;
      if (t.done) { g.done.push(t); return; }
      if (t.date < today) g.overdue.push(t);
      else if (t.date === today) g.today.push(t);
      else if (t.date === tomorrow) g.tomorrow.push(t);
      else if (t.date <= weekEnd) g.week.push(t);
      else g.later.push(t);
    });

    function byTimeThenCreated(a, b) {
      var at = a.time || '99:99';
      var bt = b.time || '99:99';
      if (at !== bt) return at < bt ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    }
    ['overdue', 'today', 'tomorrow', 'week', 'later'].forEach(function (k) { g[k].sort(byTimeThenCreated); });
    g.done.sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
    return g;
  }

  /* 提醒到期检查（打开 App 时统一检查；PRD §4.2）
     sameDay9 → 当天 9:00；min30 → 时间前 30 分（无时间不提醒）；day1 → 前一天 9:00 */
  function dueReminders(todos) {
    var now = Date.now();
    return (todos || []).filter(function (t) {
      if (t.done || !t.reminder || t.reminder === 'off' || t.notifiedAt) return false;
      var when = null;
      if (t.reminder === 'sameDay9') {
        var d = parseDate(t.date); d.setHours(9, 0, 0, 0); when = d.getTime();
      } else if (t.reminder === 'min30' && t.time) {
        var m = minutesOf(t.time) - 30;
        var base = parseDate(t.date);
        base.setMinutes(m); when = base.getTime();
      } else if (t.reminder === 'day1') {
        var p = parseDate(addDays(t.date, -1)); p.setHours(9, 0, 0, 0); when = p.getTime();
      }
      return when !== null && when <= now;
    });
  }

  /* 从正文提取 #标签（最多 3 个，空格/换行结束；PRD §4.1） */
  function extractTags(text) {
    var tags = [];
    var re = /#([^\s#]{1,20})/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (tags.indexOf(m[1]) === -1) tags.push(m[1]);
      if (tags.length >= 3) break;
    }
    return tags;
  }

  global.util = {
    DEFAULT_PERIODS: DEFAULT_PERIODS,
    toDateStr: toDateStr,
    todayStr: todayStr,
    parseDate: parseDate,
    addDays: addDays,
    diffDays: diffDays,
    dayIndex: dayIndex,
    dayCn: dayCn,
    dateStamp: dateStamp,
    shortDate: shortDate,
    relativeDay: relativeDay,
    weekOf: weekOf,
    courseOccurs: courseOccurs,
    minutesOf: minutesOf,
    nowMinutes: nowMinutes,
    countdownText: countdownText,
    nextClass: nextClass,
    escapeHTML: escapeHTML,
    extractTags: extractTags,
    groupTodos: groupTodos,
    dueReminders: dueReminders
  };
})(window);