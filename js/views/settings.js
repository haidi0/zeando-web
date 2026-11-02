/* ============================================================
   视图 · 我的 / 设置（次级页，今日页右上角进入）
   主题 / 提醒默认档 / 数据导出（只导不回）/ 清空（输入「清空」双重确认）/ 关于
   依据：PRD v0.2 §3.2 / §6.1（FR-G2/G3）；手册 §8.6 / §8.10
   ============================================================ */

(function () {
  'use strict';

  var THEMES = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色（纸）' },
    { value: 'dark', label: '深色（夜纸）' }
  ];
  var REMINDERS = [
    { value: 'off', label: '不提醒（默认）' },
    { value: 'sameDay9', label: '当天 9:00' },
    { value: 'min30', label: '提前 30 分钟' },
    { value: 'day1', label: '提前 1 天' }
  ];

  App.register('settings', {
    render: function (el) {
      var settings = window.storage.get('settings', window.storage.DEFAULT_SETTINGS) || {};
      var current = App.getThemeSetting();

      var themeRows = THEMES.map(function (t) {
        return '<label class="theme-row">' +
          '<input type="radio" name="theme" value="' + t.value + '"' +
          (t.value === current ? ' checked' : '') + '> ' + t.label + '</label>';
      }).join('');

      var reminderOpts = REMINDERS.map(function (r) {
        return '<option value="' + r.value + '"' + ((settings.reminderDefault || 'off') === r.value ? ' selected' : '') + '>' +
          r.label + '</option>';
      }).join('');

      el.innerHTML =
        '<header class="page-head">' +
        '  <div class="ph-main">' +
        '    <button class="more back-link" id="back">‹ 今日</button>' +
        '    <p class="kicker">' + util.dateStamp(util.todayStr()) + '</p>' +
        '    <h1 class="t-title">我的</h1>' +
        '    <p class="motto">数据和样子，都由你定。</p>' +
        '  </div>' +
        '</header>' +

        '<section class="section">' +
        '  <div class="section-head"><h2>主题</h2><span class="rule" aria-hidden="true"></span></div>' +
        '  <div class="card theme-list">' + themeRows + '</div>' +
        '</section>' +

        '<section class="section">' +
        '  <div class="section-head"><h2>提醒</h2><span class="rule" aria-hidden="true"></span></div>' +
        '  <div class="card">' +
        '    <label class="field"><span class="field-label">新待办的默认提醒</span>' +
        '      <select id="default-reminder" class="input">' + reminderOpts + '</select></label>' +
        '    <p class="field-note" style="margin-top:var(--sp-2)">应用内提示：打开 App 时检查到期项，在今日页顶部提醒；不做后台推送。</p>' +
        '  </div>' +
        '</section>' +

        '<section class="section">' +
        '  <div class="section-head"><h2>数据</h2><span class="rule" aria-hidden="true"></span></div>' +
        '  <div class="card">' +
        '    <p class="t-body-s" style="margin-bottom:var(--sp-3)">所有记录只存在这台设备的浏览器里，随时可以带走。当前版本只支持导出，导入恢复留到下一版。</p>' +
        '    <button class="btn-secondary" id="export">导出 JSON</button>' +
        '    <button class="btn-text-danger" id="clear" style="margin-left:var(--sp-3)">清空所有数据</button>' +
        '    <div id="clear-zone"></div>' +
        '  </div>' +
        '</section>' +

        '<section class="section">' +
        '  <div class="section-head"><h2>关于</h2><span class="rule" aria-hidden="true"></span></div>' +
        '  <div class="card"><p class="t-body-s">zeanDO · 个人工作与生活记录 · 课程作业原型 v0.1<br>' +
        '无账号、无广告、离线可用。数据在你自己手里。</p></div>' +
        '</section>';

      el.querySelector('#back').addEventListener('click', function () { App.navigate('today'); });

      el.querySelectorAll('input[name="theme"]').forEach(function (radio) {
        radio.addEventListener('change', function () { App.setThemeSetting(radio.value); });
      });

      el.querySelector('#default-reminder').addEventListener('change', function (e) {
        var s = window.storage.get('settings', window.storage.DEFAULT_SETTINGS) || {};
        s.reminderDefault = e.target.value;
        window.storage.set('settings', s);
        App.toast('默认提醒改好了。');
      });

      el.querySelector('#export').addEventListener('click', function () {
        var ok = window.storage.downloadJSON();
        App.toast(ok ? '导出好了，文件在下载里。' : '导出没成功，再试一次？');
      });

      el.querySelector('#clear').addEventListener('click', function () {
        var zone = el.querySelector('#clear-zone');
        if (zone.querySelector('.clear-confirm')) return;
        var bar = document.createElement('div');
        bar.className = 'clear-confirm';
        bar.innerHTML = '<p class="t-body-s" style="margin:var(--sp-3) 0 var(--sp-2)">清空后无法恢复。确认请输入「清空」：</p>' +
          '<input id="clear-echo" class="input" placeholder="清空" autocomplete="off">' +
          '<div class="capture-actions" style="margin-top:var(--sp-2);justify-content:flex-start">' +
          '  <button class="btn-text-danger" id="clear-yes" disabled>确认清空</button>' +
          '  <button class="btn-secondary" id="clear-no">取消</button>' +
          '</div>';
        zone.appendChild(bar);
        var echo = bar.querySelector('#clear-echo');
        var yes = bar.querySelector('#clear-yes');
        echo.addEventListener('input', function () { yes.disabled = echo.value.trim() !== '清空'; });
        bar.querySelector('#clear-no').addEventListener('click', function () { bar.remove(); });
        yes.addEventListener('click', function () {
          window.storage.clearAll();
          App.toast('已清空。');
          setTimeout(function () {
            if (App.maybeShowOnboarding) {
              App.maybeShowOnboarding();
            }
            App.refresh();
          }, 300);
        });
        echo.focus();
      });
    }
  });
})();