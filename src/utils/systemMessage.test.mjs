import test from 'node:test';
import assert from 'node:assert/strict';
import ja from '../translations/ja.js';
import en from '../translations/en.js';
import { renderSystemText } from './systemMessage.js';

const tFor = (catalog) => (key, params = {}) => {
  const v = key.split('.').reduce((o, k) => o?.[k], catalog);
  return typeof v === 'string' ? v.replace(/\{\{(\w+)\}\}/g, (m, n) => params[n] ?? m) : key;
};

test('server booking lines read in Japanese', () => {
  const out = renderSystemText('New Booking Offer: Warehouse\n💰 Fee: 1500 EUR\n\nView details in the Bookings tab.', tFor(ja), null);
  assert.equal(out, '新しいブッキングオファー：Warehouse\n💰 ギャランティ：1500 EUR\n\n詳細はブッキングタブで確認できます。');
});

test('the viewer is "you", never "you-san"', () => {
  assert.equal(renderSystemText('Mika withdrew the offer', tFor(ja), 'Mika'), 'あなたがオファーを取り下げました');
  assert.equal(renderSystemText('Booking Confirmed! Mika accepted your offer', tFor(en), 'Mika'), 'Booking confirmed! You accepted the offer');
});

test('a line nobody templated is shown as stored', () => {
  assert.equal(renderSystemText('Ciao, see you Friday', tFor(ja), null), 'Ciao, see you Friday');
});
