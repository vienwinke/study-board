import fs from 'node:fs';
import path from 'node:path';

export function createLegacyCardStore(__dirname) {
  const DATA_FILE = path.join(__dirname, 'cards.json');

  function readCards() {
    try {
      if (!fs.existsSync(DATA_FILE)) return null;
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      console.error('[cards] 读取失败：', e.message);
      return null;
    }
  }

  function writeCards(obj) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
      return true;
    } catch (e) {
      console.error('[cards] 写入失败：', e.message);
      return false;
    }
  }


  return { readCards, writeCards };
}
