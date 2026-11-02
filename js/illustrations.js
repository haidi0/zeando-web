/* ============================================================
   内联手绘感插画（降级方案：imagegen 会员不可用）
   风格：铅笔线稿 + 极浅平涂，用色仅限色板；无文字；随主题自动换色
   白名单位置：空态 / 首次引导（手册 §7）；不在列表、表单、导航内出现
   ============================================================ */

(function () {
  'use strict';

  var INK = 'var(--ink-secondary)';
  var LINE = 'var(--line-strong)';
  var BRICK = 'var(--brick)';
  var BRICK_T = 'var(--brick-text)';
  var MOSS = 'var(--moss)';
  var STRAW = 'var(--straw)';
  var DAI = 'var(--dai)';
  var PAPER_CARD = 'var(--card)';
  var TINT_O = 'var(--brick-tint)';

  function svg(inner) {
    return '<svg viewBox="0 0 200 140" role="img" aria-hidden="true" ' +
      'style="width:160px;height:auto;display:block">' + inner + '</svg>';
  }

  var S = 'fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

  /* 欢迎：摊开的手帐本 + 铅笔 + 小盆栽 */
  function welcome() {
    return svg(
      '<g transform="rotate(-2 100 72)" ' +
        'stroke="' + INK + '" ' + S + '>' +
        '<rect x="44" y="26" width="112" height="90" rx="4" fill="' + PAPER_CARD + '"/>' +
        '<line x1="100" y1="26" x2="100" y2="116"/>' +
        '<line x1="56" y1="44" x2="88" y2="44" stroke="' + LINE + '"/>' +
        '<line x1="56" y1="54" x2="88" y2="54" stroke="' + LINE + '"/>' +
        '<line x1="56" y1="64" x2="80" y2="64" stroke="' + LINE + '"/>' +
        '<line x1="56" y1="82" x2="88" y2="82" stroke="' + LINE + '"/>' +
        '<line x1="112" y1="44" x2="144" y2="44" stroke="' + LINE + '"/>' +
        '<line x1="112" y1="54" x2="144" y2="54" stroke="' + LINE + '"/>' +
        '<line x1="112" y1="72" x2="136" y2="72" stroke="' + LINE + '"/>' +
        '<circle cx="100" cy="71" r="2.2"/>' +
      '</g>' +
      '<g transform="rotate(26 150 108)">' +
        '<rect x="126" y="104" width="40" height="6.5" rx="2" fill="' + BRICK + '" stroke="' + BRICK_T + '" stroke-width="1.2"/>' +
        '<path d="M126 104 l-7 3.25 7 3.25z" fill="' + STRAW + '" stroke="' + STRAW + '" stroke-width="1"/>' +
      '</g>' +
      '<g stroke="' + MOSS + '" ' + S + '>' +
        '<path d="M38 112 q5 -12 15 -10 q-2 12 -15 10z" fill="var(--paper-sunken)"/>' +
        '<path d="M45 118 v-8"/>' +
      '</g>' +
      '<path d="M30 122 h140" stroke="' + LINE + '" stroke-width="1.5" stroke-linecap="round"/>'
    );
  }

  /* 完成：纸上一枚手绘对勾 + 胶带 */
  function done() {
    return svg(
      '<g transform="rotate(2 100 74)" stroke="' + INK + '" ' + S + '>' +
        '<rect x="52" y="30" width="96" height="84" rx="3" fill="' + PAPER_CARD + '"/>' +
        '<rect x="66" y="52" width="14" height="14" rx="3"/>' +
        '<path d="M69 59 l4 4 8 -9" stroke="' + MOSS + '"/>' +
        '<line x1="90" y1="58" x2="132" y2="58" stroke="' + LINE + '"/>' +
        '<line x1="90" y1="66" x2="120" y2="66" stroke="' + LINE + '"/>' +
        '<rect x="66" y="82" width="14" height="14" rx="3"/>' +
        '<line x1="90" y1="88" x2="132" y2="88" stroke="' + LINE + '"/>' +
        '<line x1="90" y1="96" x2="112" y2="96" stroke="' + LINE + '"/>' +
      '</g>' +
      '<g transform="rotate(-8 60 34)">' +
        '<rect x="44" y="28" width="30" height="11" rx="2" fill="' + TINT_O + '" stroke="' + BRICK + '" stroke-width="1" opacity="0.9"/>' +
      '</g>' +
      '<path d="M38 122 h124" stroke="' + LINE + '" stroke-width="1.5" stroke-linecap="round"/>'
    );
  }

  /* 空课表：格纸 */
  function course() {
    var g = '<g stroke="' + INK + '" ' + S + '>' +
      '<rect x="46" y="26" width="108" height="88" rx="3" fill="' + PAPER_CARD + '"/>';
    var i;
    for (i = 1; i < 6; i++) g += '<line x1="' + (46 + i * 15.4) + '" y1="26" x2="' + (46 + i * 15.4) + '" y2="114" stroke="' + LINE + '"/>';
    for (i = 1; i < 4; i++) g += '<line x1="46" y1="' + (26 + i * 22) + '" x2="154" y2="' + (26 + i * 22) + '" stroke="' + LINE + '"/>';
    g += '</g>';
    return svg(
      g +
      '<g stroke="' + DAI + '" ' + S + ' transform="rotate(1 148 116)">' +
        '<path d="M152 106 l24 8"/>' +
      '</g>' +
      '<g stroke="' + BRICK + '" ' + S + '>' +
        '<path d="M40 118 q-2 -10 6 -14"/>' +
        '<path d="M40 118 q6 -8 12 -6"/>' +
      '</g>'
    );
  }

  /* 空待办：清单纸 */
  function todo() {
    return svg(
      '<g transform="rotate(-1.5 100 72)" stroke="' + INK + '" ' + S + '>' +
        '<rect x="52" y="24" width="96" height="92" rx="3" fill="' + PAPER_CARD + '"/>' +
        '<rect x="64" y="44" width="13" height="13" rx="3"/>' +
        '<line x1="86" y1="50" x2="134" y2="50" stroke="' + LINE + '"/>' +
        '<rect x="64" y="66" width="13" height="13" rx="3"/>' +
        '<line x1="86" y1="72" x2="126" y2="72" stroke="' + LINE + '"/>' +
        '<rect x="64" y="88" width="13" height="13" rx="3"/>' +
        '<line x1="86" y1="94" x2="118" y2="94" stroke="' + LINE + '"/>' +
      '</g>' +
      '<g stroke="' + BRICK + '" ' + S + ' transform="rotate(30 152 100)">' +
        '<rect x="132" y="96" width="40" height="6.5" rx="2" fill="' + TINT_O + '"/>' +
        '<path d="M132 96 l-7 3.25 7 3.25z" fill="' + STRAW + '" stroke="' + STRAW + '" stroke-width="1"/>' +
      '</g>' +
      '<path d="M34 122 h132" stroke="' + LINE + '" stroke-width="1.5" stroke-linecap="round"/>'
    );
  }

  /* 空随手记：便签卡 */
  function note() {
    return svg(
      '<g transform="rotate(2 100 74)" stroke="' + INK + '" ' + S + '>' +
        '<rect x="56" y="34" width="88" height="72" rx="4" fill="' + PAPER_CARD + '"/>' +
        '<line x1="70" y1="56" x2="130" y2="56" stroke="' + LINE + '"/>' +
        '<line x1="70" y1="68" x2="130" y2="68" stroke="' + LINE + '"/>' +
        '<line x1="70" y1="80" x2="108" y2="80" stroke="' + LINE + '"/>' +
      '</g>' +
      '<g stroke="' + BRICK + '" ' + S + '>' +
        '<path d="M138 40 l6 6"/>' +
      '</g>' +
      '<g stroke="' + DAI + '" ' + S + '>' +
        '<path d="M44 96 q-6 10 2 18"/>' +
      '</g>' +
      '<path d="M36 122 h128" stroke="' + LINE + '" stroke-width="1.5" stroke-linecap="round"/>'
    );
  }

  window.Illust = {
    welcome: welcome,
    done: done,
    course: course,
    todo: todo,
    note: note
  };
})();