/* ============================================================
   首次引导（PRD v0.2 §5.1 / FR-G1）
   三步：欢迎 → 学期设置 → 完成；可「先逛逛」跳过；跳过后课表首用补配置
   ============================================================ */

(function () {
  'use strict';

  var step = 0;
  var TOTAL = 3;

  function slideWelcome() {
    return '<div class="ob-slide">' +
      '<p class="ob-brand">zeanDO</p>' +
      '<div class="ob-illust" aria-hidden="true">' + Illust.welcome() + '</div>' +
      '<h1 class="ob-title">记下要做的事<br>和想到的事</h1>' +
      '<p class="ob-sub">课表、待办、随手记，都在这张纸上。<br>不用登录，也不用联网。</p>' +
      '<button class="btn-primary ob-main" id="ob-next">开始</button>' +
      '<button class="ob-skip" id="ob-skip">先逛逛</button>' +
      '</div>';
  }

  function slideSemester() {
    return '<div class="ob-slide">' +
      '<h1 class="ob-title">先定个学期</h1>' +
      '<p class="ob-sub">开学日期决定现在是第几周，单双周和下一节课才算得准。</p>' +
      '<div class="form ob-form">' +
      '  <label class="field"><span class="field-label">开学日期 <b>*</b></span>' +
      '    <input id="ob-start" class="input" type="date" value="' + util.todayStr() + '"></label>' +
      '  <label class="field"><span class="field-label">总周数</span>' +
      '    <input id="ob-weeks" class="input" type="number" min="1" max="30" value="20"></label>' +
      '</div>' +
      '<p class="field-note ob-hint">节次时间表用默认的就好，之后可在课表页右上角修改。</p>' +
      '<button class="btn-primary ob-main" id="ob-next">下一步</button>' +
      '<button class="ob-skip" id="ob-skip">先逛逛</button>' +
      '</div>';
  }

  function slideDone() {
    return '<div class="ob-slide">' +
      '<div class="ob-illust" aria-hidden="true">' + Illust.done() + '</div>' +
      '<h1 class="ob-title">都准备好了</h1>' +
      '<p class="ob-sub">学期信息之后可以在课表页右上角随时修改。<br>先记一条试试？</p>' +
      '<button class="btn-primary ob-main" id="ob-finish">进入 zeanDO</button>' +
      '</div>';
  }

  function render() {
    var host = document.getElementById('onboard-body');
    host.innerHTML = step === 0 ? slideWelcome() : (step === 1 ? slideSemester() : slideDone());
    host.classList.remove('ob-enter');
    void host.offsetWidth;
    host.classList.add('ob-enter');

    var next = host.querySelector('#ob-next');
    if (next) next.addEventListener('click', function () {
      if (step === 1) saveSemester();
      step = Math.min(TOTAL - 1, step + 1);
      render();
    });
    var skip = host.querySelector('#ob-skip');
    if (skip) skip.addEventListener('click', finish);
    var fin = host.querySelector('#ob-finish');
    if (fin) fin.addEventListener('click', finish);

    /* 进度点 */
    var dots = document.getElementById('ob-dots');
    dots.innerHTML = '';
    for (var i = 0; i < TOTAL; i++) {
      var d = document.createElement('span');
      d.className = 'ob-dot' + (i === step ? ' on' : '');
      dots.appendChild(d);
    }
  }

  function saveSemester() {
    var startEl = document.getElementById('ob-start');
    var weeksEl = document.getElementById('ob-weeks');
    if (!startEl || !startEl.value) return; /* 未填则不保存，课表首用时补 */
    window.storage.set('semester', {
      name: '本学期',
      startDate: startEl.value,
      totalWeeks: Math.min(30, Math.max(1, +weeksEl.value || 20)),
      periods: util.DEFAULT_PERIODS.slice()
    });
  }

  function finish() {
    var s = window.storage.get('settings', window.storage.DEFAULT_SETTINGS);
    s.firstRunDone = true;
    window.storage.set('settings', s);
    document.getElementById('onboard').remove();
    document.body.style.overflow = '';
    App.refresh();
  }

  App.maybeShowOnboarding = function () {
    var s = window.storage.get('settings', window.storage.DEFAULT_SETTINGS);
    if (s && s.firstRunDone) return;
    var overlay = document.createElement('div');
    overlay.id = 'onboard';
    overlay.className = 'onboard';
    overlay.innerHTML =
      '<div class="onboard-body" id="onboard-body"></div>' +
      '<div class="onboard-dots" id="ob-dots"></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    step = 0;
    render();
  };
})();