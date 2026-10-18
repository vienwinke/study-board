export function createInteractionTools(toast) {
  /* ---------- 小工具 ---------- */
  function copyText(t) {
    var s = String(t || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(s).then(function () { toast('已复制'); }, function () { fallbackCopy(s); });
    } else {
      fallbackCopy(s);
    }
  }
  function fallbackCopy(s) {
    try {
      var ta = document.createElement('textarea');
      ta.value = s;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      toast('已复制');
    } catch (e) { toast('复制失败'); }
  }

  var speakingBtn = null;
  function toggleSpeak(text, btn) {
    if (!('speechSynthesis' in window)) { toast('当前浏览器不支持朗读'); return; }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (speakingBtn) speakingBtn.classList.remove('on');
      if (speakingBtn === btn) { speakingBtn = null; return; }
    }
    var u = new SpeechSynthesisUtterance(String(text || ''));
    u.lang = 'zh-CN';
    u.rate = 1.05;
    u.onend = function () { btn.classList.remove('on'); if (speakingBtn === btn) speakingBtn = null; };
    btn.classList.add('on');
    speakingBtn = btn;
    window.speechSynthesis.speak(u);
  }

  function closeMenu() {
    var m = document.querySelector('.mmenu');
    if (m) m.remove();
  }
  function showMenu(anchor, items) {
    closeMenu();
    var menu = document.createElement('div');
    menu.className = 'mmenu';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it.label;
      if (it.danger) b.className = 'danger';
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        closeMenu();
        it.action();
      });
      menu.appendChild(b);
    });
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(r.left, window.innerWidth - 170) + 'px';
    menu.style.top = Math.min(r.bottom + 6, window.innerHeight - menu.offsetHeight - 8) + 'px';
    setTimeout(function () { document.addEventListener('click', closeMenu, { once: true }); }, 0);
  }


  return { copyText, fallbackCopy, toggleSpeak, closeMenu, showMenu };
}
