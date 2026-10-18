import { svgIcon } from './icons.js';
import { createSettingsController } from './settings.js';
import { hhmm, esc, fmtTime, markdownOf } from './utils.js';
import { createInteractionTools } from './interactions.js';


(function () {
  'use strict';

  var MAX_CARDS = 12;
  var SPLITTER = 12;

  var cardsEl = document.getElementById('cards');
  var topEl = document.getElementById('top');
  var trashEl = document.getElementById('trash');
  var toastEl = document.getElementById('toast');

  var cards = [];
  var seed = Date.now();
  var nextId = 1;

  /* 选择删除 */
  var selecting = false;
  var selected = Object.create(null);

  function mk(title, html, t) {
    return { id: nextId++, title: title, html: html, t: t || Date.now(), weight: 1 };
  }

  /* 初始不预置任何卡片：内容全部来自 data.json / 你自己添加 */

  /* ---------- 功能区位置：<=3 右侧竖排，>3 顶部横排 ---------- */
  function syncToolbarMode() {
    var vertical = cards.length <= 3;
    topEl.classList.toggle('row', vertical);
    topEl.classList.toggle('col', !vertical);
  }

  /* ---------- 渲染 ---------- */
  function render() {
    cardsEl.innerHTML = '';

    cards.forEach(function (c, i) {
      var el = document.createElement('div');
      el.className = 'card';
      el.dataset.i = i;
      el.style.flexGrow = String(c.weight || 1);
      el.style.height = c.h ? (c.h + 'px') : '100%';

      if (selecting) {
        if (selected[c.id]) el.classList.add('selected');
        var pick = document.createElement('div');
        pick.className = 'pick';
        pick.textContent = '✓';
        el.appendChild(pick);
        el.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (selected[c.id]) { delete selected[c.id]; el.classList.remove('selected'); }
          else { selected[c.id] = true; el.classList.add('selected'); }
          updateDeleteLabel();
        });
      }

      var head = document.createElement('div');
      head.className = 'chead';
      head.draggable = !selecting;

      var idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = ('0' + (i + 1)).slice(-2);

      var title = document.createElement('input');
      title.className = 'title';
      title.value = c.title;
      title.placeholder = '知识点标题';
      title.readOnly = selecting;
      title.addEventListener('input', function () { c.title = title.value; scheduleSave(); });

      var tm = document.createElement('span');
      tm.className = 'time';
      tm.textContent = hhmm(c.t);

      var grip = document.createElement('span');
      grip.className = 'grip';
      grip.textContent = '⋮⋮';

      head.appendChild(idx); head.appendChild(title);

      /* 标题区小按钮：把这张卡的内容插入对话输入框 */
      var askBtn = document.createElement('button');
      askBtn.type = 'button';
      askBtn.className = 'cbtn';
      askBtn.title = '作为卡片附件插入对话';
      askBtn.draggable = false;
      askBtn.innerHTML = svgIcon('chat');
      askBtn.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      });
      askBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        attachCard(c);
      });

      head.appendChild(askBtn);
      head.appendChild(tm); head.appendChild(grip);

      head.title = '双击卡片标题栏 = 删除这张卡（可撤销）';

      /* 左键双击整条标题栏 = 直接删除这张卡片 */
      head.addEventListener('dblclick', function (e) {
        if (selecting) return;   /* 选择模式下双击仍交给点选逻辑 */
        e.preventDefault();
        e.stopPropagation();
        deleteCardAt(i);
      });

      var body = document.createElement('div');
      body.className = 'cbody';
      body.contentEditable = selecting ? 'false' : 'true';
      body.dataset.ph = '在这里记录这个知识点…';
      body.innerHTML = c.html || '';
      body.addEventListener('input', function () { c.html = body.innerHTML; scheduleSave(); });

      el.appendChild(head);
      el.appendChild(body);

      /* 底部拖拽改高度 */
      var hres = document.createElement('div');
      hres.className = 'hresize';
      hres.title = '拖动调整卡片高度';
      hres.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        cardResize = { el: el, card: c, y: ev.clientY, h: el.offsetHeight };
        el.classList.add('vresizing');
        document.body.classList.add('rowresize');
      });
      el.appendChild(hres);

      cardsEl.appendChild(el);

      head.addEventListener('dragstart', function (e) {
        dragFrom = i;
        el.classList.add('source');
        document.body.classList.add('dragging');
        cardsEl.classList.add('dragging');
        trashEl.classList.add('on');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) {}
      });
      head.addEventListener('dragend', function () {
        dragFrom = -1;
        el.classList.remove('source');
        resetDragUI();
      });

      el.addEventListener('dragover', function (e) {
        if (dragFrom < 0 || dragFrom === i) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        el.classList.add('drop-target');
      });
      el.addEventListener('dragleave', function () { el.classList.remove('drop-target'); });
      el.addEventListener('drop', function (e) {
        e.preventDefault();
        el.classList.remove('drop-target');
        if (dragFrom < 0 || dragFrom === i) return;
        var a = dragFrom;
        var tmp = cards[a];
        cards[a] = cards[i];
        cards[i] = tmp;
        dragFrom = -1;
        resetDragUI();
        render();
        scheduleSave();
        toast('已交换位置');
      });

      if (i < cards.length - 1) {
        var sp = document.createElement('div');
        sp.className = 'splitter';
        sp.addEventListener('pointerdown', function (e) {
          e.preventDefault();
          startColResize(i, e);
        });
        cardsEl.appendChild(sp);
      }
    });

    syncToolbarMode();
    syncToolbarButtons();
  }

  /* ---------- 选择删除 ---------- */
  function selectedCount() { return Object.keys(selected).length; }

  function updateDeleteLabel() {
    var n = selectedCount();
    var label = document.getElementById('delLabel');
    var btn = document.getElementById('btnDelete');
    if (label) label.textContent = (selecting && n > 0) ? ('删除 ' + n) : '删除';
    if (btn) btn.classList.toggle('active', selecting);
  }

  function syncToolbarButtons() {
    var add = document.getElementById('btnAdd');
    var even = document.getElementById('btnEven');
    var cancel = document.getElementById('btnCancel');
    if (add) add.classList.toggle('hide', selecting);
    if (even) even.classList.toggle('hide', selecting);
    if (cancel) cancel.classList.toggle('hide', !selecting);
    updateDeleteLabel();
  }

  function enterSelect() {
    selecting = true;
    selected = Object.create(null);
    cardsEl.classList.add('selecting');
    render();
    toast('点选要删除的卡片，再点「删除」');
  }

  /* 双击标题栏：快速选中 / 取消（自动进入选择模式） */
  function quickToggle(id) {
    if (!selecting) {
      selecting = true;
      selected = Object.create(null);
      cardsEl.classList.add('selecting');
    }
    if (selected[id]) delete selected[id];
    else selected[id] = true;

    render();
    var n = selectedCount();
    toast(n ? ('已选中 ' + n + ' 张，点「删除」确认') : '已取消选择');
  }

  function exitSelect() {
    selecting = false;
    selected = Object.create(null);
    cardsEl.classList.remove('selecting');
    render();
  }

  /* ---------- 列宽拖拽 ---------- */
  var colDrag = null;

  function startColResize(i, e) {
    var rowW = cardsEl.clientWidth;
    var totalSplit = SPLITTER * (cards.length - 1);
    var contentW = Math.max(200, rowW - totalSplit);
    var sumW = 0;
    cards.forEach(function (c) { sumW += (c.weight || 1); });
    var pxPerUnit = contentW / sumW;

    colDrag = {
      i: i, x: e.clientX,
      lw: cards[i].weight || 1,
      rw: cards[i + 1].weight || 1,
      pxPerUnit: pxPerUnit
    };
    document.body.classList.add('colresize');
  }

  window.addEventListener('pointermove', function (e) {
    if (!colDrag) return;
    var dx = e.clientX - colDrag.x;
    var dUnit = dx / colDrag.pxPerUnit;
    var total = colDrag.lw + colDrag.rw;
    var minUnit = 80 / colDrag.pxPerUnit;   /* 最窄 80px */

    var lw = Math.max(minUnit, Math.min(total - minUnit, colDrag.lw + dUnit));
    cards[colDrag.i].weight = lw;
    cards[colDrag.i + 1].weight = total - lw;

    var els = cardsEl.querySelectorAll('.card');
    cards.forEach(function (c, k) {
      if (els[k]) els[k].style.flexGrow = String(c.weight || 1);
    });
  });

  window.addEventListener('pointerup', function () {
    if (!colDrag) return;
    colDrag = null;
    document.body.classList.remove('colresize');
    scheduleSave();
  });

  /* ---------- 卡片高度拖拽 ---------- */
  var cardResize = null;

  window.addEventListener('pointermove', function (e) {
    if (!cardResize) return;
    var h = Math.max(120, cardResize.h + (e.clientY - cardResize.y));
    cardResize.el.style.height = h + 'px';
  });

  window.addEventListener('pointerup', function () {
    if (!cardResize) return;
    cardResize.card.h = cardResize.el.offsetHeight;
    cardResize.el.classList.remove('vresizing');
    document.body.classList.remove('rowresize');
    cardResize = null;
    scheduleSave();
  });

  /* ---------- 上下分隔条：卡片区 / 对话区 高度 ---------- */
  var wrapEl = document.querySelector('.wrap');
  var hsplitEl = document.getElementById('hsplit');
  var topH = 0;
  var hdrag = null;

  function availHeight() {
    return wrapEl.clientHeight - 28 - 12; /* 上下 padding + 分隔条行 */
  }

  function applyTopHeight() {
    var avail = availHeight();
    var maxTop = Math.max(170, avail - 170);
    topH = Math.max(130, Math.min(maxTop, topH));
    wrapEl.style.setProperty('--top-h', topH + 'px');
  }

  function initTopHeight() {
    topH = Math.round(availHeight() * 0.46);
    applyTopHeight();
  }

  hsplitEl.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    hdrag = { y: e.clientY, h: topH };
    document.body.classList.add('rowresize');
  });

  window.addEventListener('pointermove', function (e) {
    if (!hdrag) return;
    topH = hdrag.h + (e.clientY - hdrag.y);
    applyTopHeight();
  });

  window.addEventListener('pointerup', function () {
    if (!hdrag) return;
    hdrag = null;
    document.body.classList.remove('rowresize');
  });

  window.addEventListener('resize', function () {
    if (!topH) initTopHeight();
    else applyTopHeight();
  });

  /* ---------- 提示 ---------- */
  var toastTimer = null;
  function toast(text) {
    toastEl.style.pointerEvents = 'none';
    toastEl.textContent = text;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('on'); }, 1600);
  }

  /* ---------- 双击删除 + 撤销 ---------- */
  var undoState = null;

  function deleteCardAt(i) {
    var c = cards[i];
    if (!c) return;
    undoState = { card: c, index: i };
    cards.splice(i, 1);
    render();
    scheduleSave();
    showUndoToast('已删除「' + (c.title || '未命名') + '」');
  }

  function showUndoToast(text) {
    toastEl.innerHTML = '';
    toastEl.style.pointerEvents = 'auto';

    var span = document.createElement('span');
    span.textContent = text;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '撤销';
    btn.style.cssText =
      'margin-left:10px;border:1px solid rgba(139,124,246,.6);background:rgba(139,124,246,.18);' +
      'color:#d5cfff;border-radius:6px;padding:2px 10px;font-family:inherit;font-size:11.5px;' +
      'cursor:pointer;letter-spacing:.04em';
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      undoDelete();
    });

    toastEl.appendChild(span);
    toastEl.appendChild(btn);
    toastEl.classList.add('on');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('on');
      toastEl.style.pointerEvents = 'none';
      undoState = null;
    }, 5000);
  }

  function undoDelete() {
    if (!undoState) return;
    var idx = Math.min(undoState.index, cards.length);
    cards.splice(idx, 0, undoState.card);
    undoState = null;
    render();
    scheduleSave();
    toastEl.classList.remove('on');
    toastEl.style.pointerEvents = 'none';
    toast('已撤销删除');
  }

  /* ---------- 拖拽状态 ---------- */
  var dragFrom = -1;
  function resetDragUI() {
    document.body.classList.remove('dragging');
    cardsEl.classList.remove('dragging');
    trashEl.classList.remove('on', 'hot');
    Array.prototype.forEach.call(cardsEl.children, function (c) {
      c.classList.remove('drop-target', 'source');
    });
  }

  trashEl.addEventListener('dragover', function (e) {
    if (dragFrom < 0) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    trashEl.classList.add('hot');
  });
  trashEl.addEventListener('dragleave', function () { trashEl.classList.remove('hot'); });
  trashEl.addEventListener('drop', function (e) {
    e.preventDefault();
    if (dragFrom < 0) return;
    cards.splice(dragFrom, 1);
    dragFrom = -1;
    resetDragUI();
    render();
    scheduleSave();
    toast('卡片已删除');
  });

  /* ---------- 功能区按钮 ---------- */
  document.getElementById('btnAdd').addEventListener('click', function () {
    if (cards.length >= MAX_CARDS) { toast('最多 ' + MAX_CARDS + ' 张'); return; }
    cards.push({ id: nextId++, title: '', html: '', t: Date.now(), weight: 1 });
    render();
    scheduleSave();
  });

  document.getElementById('btnNewChat').addEventListener('click', function () {
    if (conversations.length >= 30) { toast('对话数已达上限（30）'); return; }
    createConversation();
  });

  document.getElementById('convSel').addEventListener('change', function (e) {
    if (e.target.value === activeId) return;
    activateConv(e.target.value);
    scheduleSave();
    toast('已切换对话');
  });

  document.getElementById('btnEven').addEventListener('click', function () {
    cards.forEach(function (c) { c.weight = 1; });
    var els = cardsEl.querySelectorAll('.card');
    cards.forEach(function (c, k) { if (els[k]) els[k].style.flexGrow = '1'; });
    scheduleSave();
    toast('已均分宽度');
  });

  document.getElementById('btnDelete').addEventListener('click', function () {
    if (!selecting) { enterSelect(); return; }

    var ids = Object.keys(selected);
    if (!ids.length) { exitSelect(); toast('没选中卡片，已退出'); return; }

    cards = cards.filter(function (c) { return !selected[c.id]; });
    scheduleSave();
    toast('已删除 ' + ids.length + ' 张');
    exitSelect();
  });

  document.getElementById('btnCancel').addEventListener('click', function () {
    exitSelect();
  });

  /* ---------- 存入卡片：标题 = 我的提问，正文 = AI 回答 ---------- */
  function saveByTime(answer, question) {
    if (!answer || !answer.trim()) { toast('这条还没有内容'); return; }

    var q = String(question || '').replace(/\s+/g, ' ').trim();
    var title = q
      ? q.slice(0, 60)
      : answer.split('\n')[0].trim().replace(/^[•\-\u25CF\s]+/, '').slice(0, 60);
    var content = esc(answer);

    if (cards.length >= MAX_CARDS) {
      var oldest = 0;
      for (var i = 1; i < cards.length; i++) if ((cards[i].t || 0) < (cards[oldest].t || 0)) oldest = i;
      cards[oldest].title = title;
      cards[oldest].html = content;
      cards[oldest].t = Date.now();
      render();
      scheduleSave();
      toast('已达上限，覆盖了最早的第 ' + (oldest + 1) + ' 张');
      return;
    }

    cards.push({ id: nextId++, title: title, html: content, t: Date.now(), weight: 1 });
    render();

    var last = cardsEl.querySelectorAll('.card')[cards.length - 1];
    if (last) last.classList.add('flash');
    scheduleSave();
    toast('已存入第 ' + cards.length + ' 张');
  }

  /* ---------- 卡片附件（插入对话） ---------- */
  var attachments = [];

  function makeChip(title, onRemove) {
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = svgIcon('card');
    var lbl = document.createElement('span');
    lbl.className = 'lbl';
    lbl.textContent = title || '未命名卡片';
    chip.appendChild(lbl);
    if (onRemove) {
      var x = document.createElement('button');
      x.type = 'button';
      x.textContent = '×';
      x.title = '移除';
      x.addEventListener('click', function (e) { e.stopPropagation(); onRemove(); });
      chip.appendChild(x);
    }
    return chip;
  }

  function renderAttach() {
    var box = document.getElementById('attach');
    if (!box) return;
    box.innerHTML = '';
    attachments.forEach(function (a, i) {
      box.appendChild(makeChip(a.title, function () {
        attachments.splice(i, 1);
        renderAttach();
      }));
    });
    box.classList.toggle('on', attachments.length > 0);
  }

  function attachCard(c) {
    var text = cardPlainText(c) || String((c && c.title) || '').trim();
    if (!text) { toast('这张卡片还是空的'); return; }

    for (var i = 0; i < attachments.length; i++) {
      if (attachments[i].cardId === c.id) { toast('这张卡片已经在附件里了'); input.focus(); return; }
    }
    if (attachments.length >= 5) { toast('最多附带 5 张卡片'); return; }

    attachments.push({
      cardId: c.id,
      title: String(c.title || '').trim() || '未命名卡片',
      text: text
    });
    renderAttach();
    input.focus();
    toast('已添加卡片附件');
  }

  /* ---------- 把卡片内容插入对话输入框（旧版：直接插文本） ---------- */
  function cardPlainText(c) {
    var tmp = document.createElement('div');
    tmp.innerHTML = (c && c.html) || '';
    return String(tmp.textContent || '').replace(/\u00a0/g, ' ').trim();
  }

  function insertToChat(c) {
    var text = cardPlainText(c) || String((c && c.title) || '').trim();
    if (!text) { toast('这张卡片还是空的'); return; }
    if (text.length > 2000) text = text.slice(0, 2000) + '…';

    var cur = input.value;
    input.value = cur.trim() ? (cur.replace(/\s+$/, '') + '\n\n' + text) : text;

    input.focus();
    try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}

    var chatEl = document.querySelector('.chat');
    if (chatEl) chatEl.scrollIntoView({ block: 'nearest' });

    toast('已插入输入框，补充问题后发送');
  }

  /* ================= 对话 ================= */
  var msgsEl = document.getElementById('msgs');
  var composer = document.getElementById('composer');
  var input = document.getElementById('input');
  var sendBtn = document.getElementById('sendBtn');
  var dot = document.getElementById('dot');
  var who = document.getElementById('who');
  var banner = document.getElementById('banner');

  var history = [];   /* { role, content, ts, q?, vote? } */
  var busy = false;

  function scrollBottom() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  function setBusy(v) {
    busy = v;
    sendBtn.disabled = v;
    input.disabled = v;
    if (!v) input.focus();
  }

  const { copyText, fallbackCopy, toggleSpeak, closeMenu, showMenu } = createInteractionTools(toast);

  /* ---------- 渲染一条消息 ---------- */
  function mkBtn(icon, title, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mbtn';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svgIcon(icon);
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); });
    return b;
  }

  function renderMsg(role, text, question, rec) {
    var row = document.createElement('div');
    row.className = 'msg ' + role;

    var av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = role === 'user' ? '我' : 'AI';

    var col = document.createElement('div');
    col.className = 'col';

    if (role === 'user' && rec && rec.attachments && rec.attachments.length) {
      var att = document.createElement('div');
      att.className = 'attlist';
      rec.attachments.forEach(function (a) {
        att.appendChild(makeChip(a.title, null));
      });
      col.appendChild(att);
    }

    var bub = document.createElement('div');
    bub.className = 'bubble';
    bub.textContent = text || '';
    col.appendChild(bub);

    var bar = document.createElement('div');
    bar.className = 'mtools';

    if (role === 'ai') {
      bar.appendChild(mkBtn('copy', '复制', function () { copyText(bub.textContent); }));
      bar.appendChild(mkBtn('speak', '朗读', function (b) { toggleSpeak(bub.textContent, b); }));

      var upBtn = mkBtn('up', '有帮助', function (b) {
        if (!rec) return;
        rec.vote = rec.vote === 'up' ? null : 'up';
        dnBtn.classList.remove('bad');
        b.classList.toggle('ok', rec.vote === 'up');
      });
      var dnBtn = mkBtn('down', '没帮助', function (b) {
        if (!rec) return;
        rec.vote = rec.vote === 'down' ? null : 'down';
        upBtn.classList.remove('ok');
        b.classList.toggle('bad', rec.vote === 'down');
      });
      if (rec && rec.vote === 'up') upBtn.classList.add('ok');
      if (rec && rec.vote === 'down') dnBtn.classList.add('bad');
      bar.appendChild(upBtn);
      bar.appendChild(dnBtn);

      bar.appendChild(mkBtn('card', '存入卡片', function () { saveByTime(bub.textContent, question); }));
      bar.appendChild(mkBtn('regen', '重新生成', function () { regenerate(rec, question); }));
      bar.appendChild(mkBtn('code', '复制为 Markdown', function () {
        copyText(markdownOf({ content: bub.textContent }, question));
      }));
      bar.appendChild(mkBtn('more', '更多', function (b) {
        showMenu(b, [
          { label: '复制原文', action: function () { copyText(bub.textContent); } },
          { label: '存入卡片', action: function () { saveByTime(bub.textContent, question); } },
          {
            label: '删除这条问答', danger: true, action: function () {
              var i = history.indexOf(rec);
              if (i < 0) return;
              if (i > 0 && history[i - 1] && history[i - 1].role === 'user') history.splice(i - 1, 2);
              else history.splice(i, 1);
              rerender();
              scheduleSave();
              toast('已删除');
            }
          }
        ]);
      }));

    } else {
      bar.appendChild(mkBtn('copy', '复制', function () { copyText(bub.textContent); }));
    }

    var tEl = document.createElement('span');
    tEl.className = 'mtime';
    tEl.textContent = fmtTime(rec && rec.ts);
    bar.appendChild(tEl);

    col.appendChild(bar);
    row.appendChild(av);
    row.appendChild(col);
    msgsEl.appendChild(row);

    return { row: row, bubble: bub, rec: rec };
  }

  function rerender() {
    msgsEl.innerHTML = '';
    var lastQ = '';
    history.forEach(function (m) {
      var shown = (m.role === 'user' && typeof m.display === 'string') ? m.display : m.content;
      if (m.role === 'user') lastQ = shown;
      /* 存储里用 assistant，界面里用 ai —— 这里统一映射 */
      var uiRole = m.role === 'user' ? 'user' : 'ai';
      renderMsg(uiRole, shown, uiRole === 'ai' ? (m.q || lastQ) : null, m);
    });
    scrollBottom();
  }

  /* ---------- 请求回答（流式） ---------- */
  async function requestAnswer(question) {
    var rec = { role: 'assistant', content: '', ts: Date.now(), q: question };
    history.push(rec);

    var ai = renderMsg('ai', '', question, rec);
    ai.bubble.textContent = '…';
    scrollBottom();

    var acc = '';
    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history
            .filter(function (m) { return m.content || m.role === 'user'; })
            .map(function (m) { return { role: m.role, content: m.content }; })
        })
      });

      if (!res.ok) {
        var err = {};
        try { err = await res.json(); } catch (e) {}
        ai.bubble.classList.add('err');
        ai.bubble.textContent = '⚠ ' + (err.message || ('HTTP ' + res.status));
        history.splice(history.indexOf(rec), 1);
        ai.row.remove();
        return;
      }

      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var buf = '';
      ai.bubble.textContent = '';

      while (true) {
        var r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop();

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || line.indexOf('data:') !== 0) continue;
          var data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            var j = JSON.parse(data);
            var d = j.choices && j.choices[0] && j.choices[0].delta;
            var piece = d && (d.content || '');
            if (piece) {
              acc += piece;
              ai.bubble.textContent = acc;
              scrollBottom();
            }
          } catch (e) {}
        }
      }

      if (acc) {
        rec.content = acc;
        rec.ts = Date.now();
        var te = ai.row.querySelector('.mtime');
        if (te) te.textContent = fmtTime(rec.ts);
        scheduleSave();
      } else {
        ai.bubble.textContent = '（没有收到内容）';
        history.splice(history.indexOf(rec), 1);
      }
    } catch (e) {
      ai.bubble.classList.add('err');
      ai.bubble.textContent = '⚠ 请求失败：' + (e && e.message ? e.message : e);
      history.splice(history.indexOf(rec), 1);
    }
  }

  async function send(text) {
    if (busy) return;

    var atts = attachments.slice();
    attachments = [];
    renderAttach();

    var apiContent = atts.map(function (a) {
      return '【卡片：' + a.title + '】\n' + a.text;
    }).join('\n\n');
    if (text) apiContent = apiContent ? (apiContent + '\n\n' + text) : text;
    if (!apiContent) return;

    setBusy(true);

    var urec = {
      role: 'user',
      content: apiContent,
      display: text,
      attachments: atts,
      ts: Date.now()
    };
    history.push(urec);
    renderMsg('user', text, null, urec);
    scheduleSave();
    scrollBottom();

    await requestAnswer(text || (atts.length ? atts[0].title : ''));

    setBusy(false);
    scrollBottom();
  }

  async function regenerate(rec, question) {
    if (busy) return;
    var i = history.indexOf(rec);
    if (i < 0) { toast('这条已不在记录里'); return; }

    history.splice(i);
    rerender();
    scheduleSave();

    setBusy(true);
    await requestAnswer(question || rec.q || '');
    setBusy(false);
    scrollBottom();
  }

  composer.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text && !attachments.length) return;
    input.value = '';
    send(text);
  });

  const { refreshStatus } = createSettingsController({
    dot, who, banner, toast,
    beforeOpen: function () { if (selecting) exitSelect(); }
  });

  /* ================= 会话（多对话） ================= */
  var conversations = [];   /* { id, title, createdAt, updatedAt, cards:[], messages:[] } */
  var activeId = null;

  function newConvId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function currentConv() {
    for (var i = 0; i < conversations.length; i++) {
      if (conversations[i].id === activeId) return conversations[i];
    }
    return null;
  }

  function convTitle(c) {
    if (c.title) return c.title;
    var ms = c.messages || [];
    for (var i = 0; i < ms.length; i++) {
      if (ms[i].role === 'user') {
        var t = String(ms[i].content).replace(/\s+/g, ' ').trim().slice(0, 18);
        if (t) return t;
      }
    }
    return '新对话';
  }

  /* 把当前编辑中的卡片/消息写回它所属的会话 */
  function flushActive() {
    var c = currentConv();
    if (!c) return;
    c.cards = cards.map(function (x) {
      return { id: x.id, title: x.title, html: x.html, t: x.t, weight: x.weight || 1, h: x.h || 0 };
    });
    c.messages = history.slice();
    c.updatedAt = Date.now();
    if (!c.title) {
      for (var i = 0; i < c.messages.length; i++) {
        if (c.messages[i].role === 'user') {
          c.title = String(c.messages[i].content).replace(/\s+/g, ' ').trim().slice(0, 24);
          break;
        }
      }
    }
  }

  function refreshConvSelect() {
    var sel = document.getElementById('convSel');
    if (!sel) return;
    sel.innerHTML = '';
    conversations.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id;
      o.textContent = convTitle(c);
      sel.appendChild(o);
    });
    if (activeId) sel.value = activeId;
  }

  /* 切到某个会话：先存当前，再载入目标 */
  function activateConv(id, skipFlush) {
    if (!skipFlush) flushActive();
    activeId = id;

    var c = currentConv();
    cards = ((c && c.cards) || []).map(function (x) {
      return {
        id: Number(x.id) || nextId++,
        title: x.title || '',
        html: x.html || '',
        t: x.t || Date.now(),
        weight: x.weight || 1,
        h: Number(x.h) || 0
      };
    });

    var maxId = 0;
    cards.forEach(function (x) { if (x.id > maxId) maxId = x.id; });
    nextId = maxId + 1;

    history = ((c && c.messages) || []).slice();
    rerender();

    render();
    refreshConvSelect();
    scrollBottom();
  }

  function createConversation() {
    flushActive();
    var c = {
      id: newConvId(),
      title: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cards: [],
      messages: []
    };
    conversations.push(c);
    activateConv(c.id, true);
    scheduleSave();
    input.value = '';
    input.focus();
    toast('已新建对话');
  }

  /* ================= 本地持久化 ================= */
  var saveTimer = null;
  var saving = false;
  var saveAgain = false;

  function snapshot() {
    flushActive();
    return { version: 2, activeId: activeId, conversations: conversations };
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 600);
  }

  function flashSaved() {
    var el = document.getElementById('saved');
    if (!el) return;
    el.textContent = '已保存';
    el.classList.add('on');
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.textContent = '就绪';
      el.classList.remove('on');
    }, 1400);
  }

  function saveNow() {
    clearTimeout(saveTimer);
    if (saving) { saveAgain = true; return; }
    saving = true;
    fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot())
    }).then(function (r) { return r.json(); }).then(function (res) {
      saving = false;
      if (res && res.ok) flashSaved();
      if (saveAgain) { saveAgain = false; saveNow(); }
    }).catch(function () {
      saving = false;
    });
  }

  function loadDataFromServer() {
    fetch('/api/data').then(function (r) { return r.json(); }).then(function (d) {
      if (!d) return;

      /* 新格式：多会话 */
      if (Array.isArray(d.conversations) && d.conversations.length) {
        conversations = d.conversations.filter(Boolean).map(function (c) {
          return {
            id: String(c.id || newConvId()),
            title: c.title || '',
            createdAt: c.createdAt || Date.now(),
            updatedAt: c.updatedAt || Date.now(),
            cards: Array.isArray(c.cards) ? c.cards : [],
            messages: Array.isArray(c.messages) ? c.messages : []
          };
        });
        var hit = false;
        for (var i = 0; i < conversations.length; i++) if (conversations[i].id === d.activeId) hit = true;
        activeId = hit ? d.activeId : conversations[0].id;
        activateConv(activeId, true);
        return;
      }

      /* 老格式（单对话）迁移 */
      if (Array.isArray(d.cards) || Array.isArray(d.messages)) {
        var c2 = {
          id: newConvId(),
          title: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          cards: Array.isArray(d.cards) ? d.cards : [],
          messages: Array.isArray(d.messages) ? d.messages : []
        };
        conversations = [c2];
        activeId = c2.id;
        activateConv(activeId, true);
        return;
      }

      /* 完全没有数据 → 开一个新的空对话 */
      createConversation();
    }).catch(function () {});
  }

  /* 关页面前尽量把未保存的写回去 */
  window.addEventListener('beforeunload', function () {
    if (!saveTimer && !saveAgain) return;
    try {
      var blob = new Blob([JSON.stringify(snapshot())], { type: 'application/json' });
      navigator.sendBeacon('/api/data', blob);
    } catch (e) {}
  });

  /* ---------- 启动 ---------- */
  (function fillToolbarIcons() {
    var nodes = document.querySelectorAll('[data-icon]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-icon');
      nodes[i].innerHTML = svgIcon(key);
    }
  })();

  initTopHeight();
  render();
  refreshStatus();
  loadDataFromServer();

  /* 从别的窗口切回来时刷新状态（比如刚手动改过 config.json） */
  window.addEventListener('focus', refreshStatus);
})();
