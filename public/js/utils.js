export function hhmm(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  var h = d.getHours(), m = d.getMinutes();
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}
export function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fmtTime(ts) {
  var d = new Date(ts || Date.now());
  var n = new Date();
  var hh = ('0' + d.getHours()).slice(-2);
  var mm = ('0' + d.getMinutes()).slice(-2);
  var same = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return (same ? '今天 ' : (d.getMonth() + 1) + '/' + d.getDate() + ' ') + hh + ':' + mm;
}

export function markdownOf(rec, question) {
  var out = '';
  if (question) out += '**问：** ' + String(question).trim() + '\n\n';
  out += '**答：**\n\n' + String((rec && rec.content) || '').trim() + '\n';
  return out;
}
