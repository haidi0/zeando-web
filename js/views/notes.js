/* ============================================================
   视图 · 随手记流（次级页，自今日页「最近随手记 → 全部」进入）
   倒序卡片流 + 标签条筛选 + 点卡片编辑（详情走 ⊕ 半屏 note-edit 模式）
   依据：PRD v0.2 §4.1 / FR-N1~N4；手册 §8.4
   ============================================================ */

(function () {
  'use strict';

  var filterTag = '';

  function highlightTags(text) {
    return util.escapeHTML(text).replace(/#([^\s#]{1,20})/g, '<span class="tag-text">#$1</span>');
  }

  function dateLabel(ts) {
    var d = util.toDateStr(new Date(ts));
    var today = util.todayStr();
    if (d === today) return '今天';
    if (d === util.addDays(today, -1)) return '昨天';
    return util.shortDate(d);
  }

  function renderTagBar(notes) {
    var freq = {};
    notes.forEach(function (n) {
      (n.tags || []).forEach(function (t) { freq[t] = (freq[t] || 0) + 1; });
    });
    var tags = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; });
    if (tags.length === 0) return '';
    var chips = tags.map(function (t) {
      return '<button class="tag-chip' + (t === filterTag ? ' on' : '') + '" data-tag="' + util.escapeHTML(t) + '">#' +
        util.escapeHTML(t) + '<span class="tag-count">' + freq[t] + '</span></button>';
    }).join('');
    return '<div class="tag-bar">' + chips + '</div>';
  }

  function renderStream(notes) {
    var list = filterTag ? notes.filter(function (n) { return (n.tags || []).indexOf(filterTag) !== -1; }) : notes;
    if (list.length === 0) {
      if (filterTag) {
        return '<div class="empty">' +
          '<div class="illust-slot" aria-hidden="true">' + Illust.note() + '</div>' +
          '<p>这个标签下还没有记录。</p>' +
          '<button class="btn-secondary" id="clear-filter">看看全部</button>' +
          '</div>';
      }
      return '<div class="empty">' +
        '<div class="illust-slot" aria-hidden="true">' + Illust.note() + '</div>' +
        '<p>今天还没写点什么——一句也行。</p>' +
        '<button class="btn-primary" id="capture">记一条</button>' +
        '</div>';
    }

    var rows = '';
    var lastLabel = '';
    list.forEach(function (n) {
      var label = dateLabel(n.createdAt);
      if (label !== lastLabel) {
        rows += '<p class="date-sep t-caption">' + label + '</p>';
        lastLabel = label;
      }
      rows += '<div class="note-card" data-note="' + n.id + '">' +
        '<p class="note-text">' + highlightTags(n.text) + '</p>' +
        '<p class="note-meta t-caption">' +
        (n.createdAt ? new Date(n.createdAt).toTimeString().slice(0, 5) : '') + '</p>' +
        '</div>';
    });
    return '<div class="plain-list note-list">' + rows + '</div>';
  }

  App.register('notes', {
    render: function (el) {
      var notes = window.storage.get('notes', []) || [];
      var count = notes.length;

      el.innerHTML =
        '<header class="page-head">' +
        '  <div class="ph-main">' +
        '    <button class="more back-link" id="back">‹ 今日</button>' +
        '    <p class="kicker">' + util.dateStamp(util.todayStr()) + '</p>' +
        '    <h1 class="t-title">随手记</h1>' +
        '    <p class="motto">' + (count > 0 ? '记过 ' + count + ' 条，都在这。' : '想到什么，随时落笔。') + '</p>' +
        '  </div>' +
        '</header>' +
        renderTagBar(notes) +
        '<section class="section">' + renderStream(notes) + '</section>';

      el.querySelector('#back').addEventListener('click', function () {
        filterTag = '';
        App.navigate('today');
      });

      var captureBtn = el.querySelector('#capture');
      if (captureBtn) captureBtn.addEventListener('click', function () { App.openSheet('note'); });
      var clearBtn = el.querySelector('#clear-filter');
      if (clearBtn) clearBtn.addEventListener('click', function () { filterTag = ''; LayoutRefresh(el); });

      el.querySelectorAll('.tag-chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          filterTag = (filterTag === chip.dataset.tag) ? '' : chip.dataset.tag;
          LayoutRefresh(el);
        });
      });

      el.querySelectorAll('[data-note]').forEach(function (card) {
        card.addEventListener('click', function () { App.openNoteEdit(card.dataset.note); });
      });
    }
  });

  /* 局部重绘（筛选切换不刷新整页，避免丢滚动位置） */
  function LayoutRefresh(el) {
    var notes = window.storage.get('notes', []) || [];
    var barHost = el.querySelector('.tag-bar');
    var section = el.querySelector('.section');
    var newBar = renderTagBar(notes);
    if (barHost) {
      if (newBar) barHost.outerHTML = newBar;
      else barHost.remove();
    } else if (newBar) {
      section.insertAdjacentHTML('beforebegin', newBar);
    }
    section.innerHTML = renderStream(notes);

    /* 重新绑定 */
    var captureBtn = section.querySelector('#capture');
    if (captureBtn) captureBtn.addEventListener('click', function () { App.openSheet('note'); });
    var clearBtn = section.querySelector('#clear-filter');
    if (clearBtn) clearBtn.addEventListener('click', function () { filterTag = ''; LayoutRefresh(el); });
    el.querySelectorAll('.tag-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        filterTag = (filterTag === chip.dataset.tag) ? '' : chip.dataset.tag;
        LayoutRefresh(el);
      });
    });
    section.querySelectorAll('[data-note]').forEach(function (card) {
      card.addEventListener('click', function () { App.openNoteEdit(card.dataset.note); });
    });
  }
})();