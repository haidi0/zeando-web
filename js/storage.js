/* ============================================================
   zeanDO · 数据层
   依据：PRD v0.2 §6.2（zd1: 键族）与状态与异常图 §6（数据层异常）
   原则：本地优先、无网络依赖；接口抽象为 storage.get/set，后续换
        IndexedDB 不动上层；localStorage 不可用时降级只读并暴露横幅。
   ============================================================ */

(function (global) {
  'use strict';

  var PREFIX = 'zd1:';
  var SCHEMA_VERSION = 1;

  var KEYS = {
    semester: PREFIX + 'semester',
    courses: PREFIX + 'courses',
    todos: PREFIX + 'todos',
    notes: PREFIX + 'notes',
    draft: PREFIX + 'draft',
    settings: PREFIX + 'settings'
  };

  var DEFAULT_SETTINGS = {
    theme: 'system',        // system | light | dark
    reminderDefault: 'off', // off | sameDay9 | min30 | day1
    firstRunDone: false,
    schemaVersion: SCHEMA_VERSION
  };

  /* —— 可用性检测：隐私模式/配额满等场景 localStorage 会抛错 —— */
  var available = (function () {
    try {
      var probeKey = PREFIX + '__probe__';
      global.localStorage.setItem(probeKey, '1');
      global.localStorage.removeItem(probeKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  /* 不可用时退化为内存存储：本次会话可用，但刷新丢失，配合横幅提示 */
  var memoryFallback = Object.create(null);

  function readRaw(key) {
    if (!available) return memoryFallback[key] != null ? memoryFallback[key] : null;
    try {
      return global.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function writeRaw(key, value) {
    if (!available) {
      memoryFallback[key] = value;
      return false;
    }
    try {
      global.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function get(key, fallback) {
    var raw = readRaw(KEYS[key] || key);
    if (raw == null) return fallback;
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
    /* 类型守卫：脏数据（被写成字符串/null/对象）不向上层泄漏，按默认值降级 */
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    if (fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback)) {
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;
    }
    return parsed;
  }

  function set(key, value) {
    return writeRaw(KEYS[key] || key, JSON.stringify(value));
  }

  function remove(key) {
    var full = KEYS[key] || key;
    if (!available) {
      delete memoryFallback[full];
      return;
    }
    try {
      global.localStorage.removeItem(full);
    } catch (e) { /* 忽略 */ }
  }

  /* —— 迁移占位：结构变更时在此按 schemaVersion 升级 —— */
  function migrate() {
    var settings = get('settings', null);
    if (!settings) {
      set('settings', DEFAULT_SETTINGS);
      return;
    }
    var v = settings.schemaVersion || 0;
    if (v < SCHEMA_VERSION) {
      /* v0 → v1：补齐默认字段；后续版本在此追加迁移分支 */
      settings = Object.assign({}, DEFAULT_SETTINGS, settings, { schemaVersion: SCHEMA_VERSION });
      set('settings', settings);
    }
  }

  /* —— 导出（PRD §6.1：v0.1 只导不回） —— */
  function exportAll() {
    return {
      app: 'zeanDO',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        semester: get('semester', null),
        courses: get('courses', []),
        todos: get('todos', []),
        notes: get('notes', []),
        settings: get('settings', DEFAULT_SETTINGS)
      }
    };
  }

  /* 导出为 JSON 文件下载；返回是否成功 */
  function downloadJSON(filename) {
    try {
      var payload = JSON.stringify(exportAll(), null, 2);
      var blob = new Blob([payload], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || ('zeanDO-backup-' + new Date().toISOString().slice(0, 10) + '.json');
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* 清空所有 zd1: 键（调用方负责双重确认） */
  function clearAll() {
    Object.keys(KEYS).forEach(function (k) { remove(k); });
    if (available) {
      try {
        Object.keys(global.localStorage).forEach(function (k) {
          if (k.indexOf(PREFIX) === 0) global.localStorage.removeItem(k);
        });
      } catch (e) { /* 忽略 */ }
    } else {
      memoryFallback = Object.create(null);
    }
  }

  global.storage = {
    available: available,
    KEYS: KEYS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    get: get,
    set: set,
    remove: remove,
    migrate: migrate,
    exportAll: exportAll,
    downloadJSON: downloadJSON,
    clearAll: clearAll
  };
})(window);