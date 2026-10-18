import { PRESETS, EFFORTS, presetIdByBase, effortLabel } from './providers.js';

/** Owns settings and model menus; page selection state is supplied by the caller. */
export function createSettingsController({ dot, who, banner, toast, beforeOpen }) {
  /* ================= 设置弹窗 ================= */
  var modal = document.getElementById('modal');
  var fProvider = document.getElementById('fProvider');
  var fKey = document.getElementById('fKey');
  var fModel = document.getElementById('fModel');
  var fBase = document.getElementById('fBase');
  var fSys = document.getElementById('fSys');
  var modalMsg = document.getElementById('modalMsg');
  var keyTip = document.getElementById('keyTip');
  var provTip = document.getElementById('provTip');
  var modalSave = document.getElementById('modalSave');

  /* 未保存标记：防止关弹窗时静默丢修改 */
  var dirty = false;
  function markDirty() {
    if (!dirty) {
      dirty = true;
      modalMsg.textContent = '● 有未保存的修改';
      modalMsg.style.color = '#ffc2d1';
    }
  }
  function clearDirty() {
    dirty = false;
    modalMsg.textContent = '';
    modalMsg.style.color = '';
  }

  function applyProviderUi(id) {
    var p = PRESETS[id] || PRESETS.custom;
    provTip.textContent = p.tip;
    fModel.placeholder = p.modelPh;
    fKey.placeholder = fKey.placeholder.indexOf('已配置') === 0 ? fKey.placeholder : p.keyPh;
    if (id !== 'custom') fBase.value = p.base;
  }

  fProvider.addEventListener('change', function () {
    applyProviderUi(fProvider.value);
    if (fProvider.value !== 'custom') fBase.value = PRESETS[fProvider.value].base;
  });

  /* 设置「供应商 · 模型」模块的显示 */
  function setModelInfo(provider, model) {
    var provEl = document.getElementById('mprov');
    var sepEl = document.getElementById('msep');
    if (!provEl || !sepEl) return;

    if (provider) {
      provEl.textContent = provider;
      provEl.style.display = '';
      sepEl.style.display = '';
    } else {
      provEl.textContent = '';
      provEl.style.display = 'none';
      sepEl.style.display = 'none';
    }
    who.textContent = model || '未配置';
    var box = document.getElementById('modelBox');
    if (box) box.title = (provider ? provider + ' · ' : '') + (model || '未配置');
  }

  /* ================= 模型 / 推理等级（两级菜单） ================= */
  var effortValue = '';
  var modelCatalog = null;

  function closeMenu2() {
    var p = document.querySelector('.mmenu2');
    if (p) p.remove();
  }

  function saveConfigField(patch, okMsg) {
    return fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res && res.ok) {
        refreshStatus();
        if (okMsg) toast(okMsg);
        return true;
      }
      toast('保存失败');
      return false;
    }).catch(function () {
      toast('保存失败');
      return false;
    });
  }

  function showModelMenu(anchor) {
    closeMenu2();

    var panel = document.createElement('div');
    panel.className = 'mmenu2';
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(panel);

    var r = anchor.getBoundingClientRect();
    panel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 336)) + 'px';
    panel.style.top = Math.min(r.bottom + 6, window.innerHeight - 190) + 'px';

    function makeRow(label, value, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mm-row';
      var l = document.createElement('span');
      l.className = 'mm-label'; l.textContent = label;
      var v = document.createElement('span');
      v.className = 'mm-value'; v.textContent = value;
      var c = document.createElement('span');
      c.className = 'mm-chev'; c.textContent = '›';
      b.appendChild(l); b.appendChild(v); b.appendChild(c);
      b.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      return b;
    }

    function makeHead(title, backFn) {
      var h = document.createElement('div');
      h.className = 'mm-head';
      var back = document.createElement('button');
      back.type = 'button';
      back.className = 'mm-back';
      back.textContent = '‹';
      back.title = '返回';
      back.addEventListener('click', function (e) { e.stopPropagation(); backFn(); });
      var t = document.createElement('span');
      t.textContent = title;
      h.appendChild(back); h.appendChild(t);
      return h;
    }

    /* ---- 一级 ---- */
    function showRoot() {
      panel.innerHTML = '';
      panel.appendChild(makeRow('模型', (who && who.textContent) || '未配置', showModels));
      panel.appendChild(makeRow('推理等级', effortLabel(effortValue), showEfforts));
    }

    /* ---- 二级：模型 ---- */
    function showModels() {
      panel.innerHTML = '';
      panel.appendChild(makeHead('选择模型', showRoot));

      var sw = document.createElement('div');
      sw.className = 'mm-search';
      var search = document.createElement('input');
      search.type = 'text';
      search.placeholder = '搜索，或直接输入模型名后回车';
      sw.appendChild(search);
      panel.appendChild(sw);

      var body = document.createElement('div');
      body.className = 'mm-body';
      panel.appendChild(body);

      var all = modelCatalog || [];
      var cur = (who && who.textContent) || '';
      var errMsg = '正在加载模型列表…';

      function paint() {
        var f = search.value.trim().toLowerCase();
        body.innerHTML = '';
        var shown = all.filter(function (m) { return !f || m.toLowerCase().indexOf(f) >= 0; });

        if (!shown.length) {
          var e = document.createElement('div');
          e.className = 'mm-empty';
          e.textContent = all.length
            ? '没有匹配的模型'
            : (errMsg + '\n\n在上面输入模型名后按回车可直接使用');
          body.appendChild(e);
          return;
        }

        shown.slice(0, 400).forEach(function (m) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'mm-item' + (m === cur ? ' on' : '');
          b.textContent = m;
          b.title = m;
          if (m === cur) {
            var t = document.createElement('span');
            t.className = 'tick'; t.textContent = '✓';
            b.appendChild(t);
          }
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            saveConfigField({ model: m }, '已切换模型：' + m);
            closeMenu2();
          });
          body.appendChild(b);
        });
      }

      search.addEventListener('input', paint);
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && search.value.trim()) {
          var v = search.value.trim();
          saveConfigField({ model: v }, '已切换模型：' + v);
          closeMenu2();
        }
      });

      paint();

      if (!modelCatalog) {
        fetch('/api/models').then(function (r2) { return r2.json(); }).then(function (d) {
          if (d && d.ok && Array.isArray(d.models)) {
            modelCatalog = d.models;
            all = modelCatalog;
            errMsg = '';
          } else {
            errMsg = '拉取失败：' + ((d && d.error) || '未知错误');
          }
          paint();
        }).catch(function () {
          errMsg = '拉取失败：服务未响应';
          paint();
        });
      }

      setTimeout(function () { search.focus(); }, 0);
    }

    /* ---- 二级：推理等级 ---- */
    function showEfforts() {
      panel.innerHTML = '';
      panel.appendChild(makeHead('推理等级', showRoot));

      var body = document.createElement('div');
      body.className = 'mm-body';
      panel.appendChild(body);

      EFFORTS.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mm-item' + (it.v === effortValue ? ' on' : '');
        b.textContent = it.label + (it.v ? '  (' + it.v + ')' : '');
        if (it.v === effortValue) {
          var t = document.createElement('span');
          t.className = 'tick'; t.textContent = '✓';
          b.appendChild(t);
        }
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          effortValue = it.v;
          saveConfigField({ reasoningEffort: it.v },
            it.v ? ('推理等级：' + it.label) : '推理等级：默认');
          closeMenu2();
        });
        body.appendChild(b);
      });
    }

    showRoot();

    setTimeout(function () {
      document.addEventListener('click', closeMenu2, { once: true });
    }, 0);
  }

  document.getElementById('modelBox').addEventListener('click', function (e) {
    e.stopPropagation();
    showModelMenu(this);
  });

  function applyStatus(st) {
    effortValue = (typeof st.reasoningEffort === 'string') ? st.reasoningEffort : '';
    var tag = document.getElementById('effTag');
    if (tag) tag.textContent = effortValue ? effortLabel(effortValue) : '';
    var pid = presetIdByBase(st.baseUrl);
    var pname = (PRESETS[pid] && PRESETS[pid].name) || 'AI';
    if (st.configured) {
      dot.classList.remove('off');
      setModelInfo(pname, st.model);
      banner.classList.remove('on');
    } else if (st.mock) {
      dot.classList.remove('off');
      setModelInfo('', '演示模式');
      banner.classList.remove('on');
    } else {
      dot.classList.add('off');
      setModelInfo('', '未配置');
      banner.classList.add('on');
      banner.innerHTML = '还没配置 API：点功能区里的 <code>设置</code> 选择供应商并填入 Key 和模型';
    }
  }

  function refreshStatus() {
    fetch('/api/status').then(function (r) { return r.json(); }).then(applyStatus).catch(function () {
      banner.classList.add('on');
      banner.innerHTML = '连不上本地服务：请确认已运行 <code>node server.mjs</code>，并通过 <code>http://127.0.0.1:8787</code> 打开本页';
    });
  }

  function openSettings() {
    modal.classList.add('on');
    modalMsg.textContent = '读取中…';
    fKey.value = '';
    fetch('/api/config').then(function (r) { return r.json(); }).then(function (c) {
      var pid = presetIdByBase(c.baseUrl);
      var p = PRESETS[pid];
      fProvider.value = pid;
      fModel.value = c.model || '';
      fBase.value = c.baseUrl || p.base;
      fSys.value = c.system || '';
      fKey.placeholder = c.hasKey ? '已配置，留空则不修改' : p.keyPh;
      keyTip.textContent = c.hasKey
        ? '已配置 Key；留空保持不变，输入新值则覆盖'
        : '还没有配置 Key';
      provTip.textContent = p.tip;
      fModel.placeholder = p.modelPh;
      fSys.value = c.system || '';
      fSys.placeholder = c.system
        ? ''
        : ('留空 = 使用默认：' + String(c.systemEffective || '').slice(0, 60));
      clearDirty();
    }).catch(function () {
      modalMsg.textContent = '读不到配置，检查服务是否在运行';
    });
  }

  function closeSettings(force) {
    if (!force && dirty) {
      if (!confirm('有未保存的修改，确定关闭？')) return;
    }
    clearDirty();
    modal.classList.remove('on');
  }

  function saveSettings() {
    modalSave.disabled = true;
    modalMsg.textContent = '保存中…';

    var pid = fProvider.value;
    var base = pid === 'custom' ? fBase.value : PRESETS[pid].base;

    var payload = {
      provider: pid,
      model: fModel.value,
      baseUrl: base,
      system: fSys.value
    };
    if (fKey.value.trim()) payload.apiKey = fKey.value.trim();

    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      modalSave.disabled = false;
      if (!res.ok) {
        modalMsg.textContent = (res.j && res.j.message) || '保存失败';
        return;
      }
      closeSettings(true);
      refreshStatus();
      toast(res.j.mock ? '已保存（仍为演示模式：缺 Key 或模型）' : '已保存，开始使用真实模型');
    }).catch(function (e) {
      modalSave.disabled = false;
      modalMsg.textContent = '保存失败：' + (e && e.message ? e.message : e);
    });
  }

  document.getElementById('btnSettings').addEventListener('click', function () {
    beforeOpen();
    openSettings();
  });
  document.getElementById('modalClose').addEventListener('click', function () { closeSettings(); });
  document.getElementById('modalCancel').addEventListener('click', function () { closeSettings(); });
  modalSave.addEventListener('click', saveSettings);
  /* 点弹窗外的空白区域不再关闭（避免误触丢修改），只能点 ✕ / 取消 / Esc */
  document.addEventListener('keydown', function (e) {
    if (!modal.classList.contains('on')) return;
    if (e.key === 'Escape') closeSettings();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveSettings(); }
  });

  /* 任何输入都标记为「未保存」 */
  [fProvider, fKey, fModel, fBase, fSys].forEach(function (el) {
    if (!el) return;
    el.addEventListener('input', markDirty);
    el.addEventListener('change', markDirty);
  });

  return { refreshStatus };
}
