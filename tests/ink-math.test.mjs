import test from 'node:test';
import assert from 'node:assert/strict';
import {enterProgress, drainProgress, packAtlas, baseline} from '../public/ink-math.js';

test('enterProgress floods between 88% and 42% of the viewport', () => {
 assert.equal(enterProgress(900, 1000), 0);
 assert.equal(enterProgress(420, 1000), 1);
 const middle = enterProgress(650, 1000);
 assert.ok(middle > 0 && middle < 1);
});

test('drainProgress empties the hero between 4% and 50% of its height', () => {
 assert.equal(drainProgress(0, 1000), 1);
 assert.equal(drainProgress(40, 1000), 1);
 assert.equal(drainProgress(500, 1000), 0);
 for (let y = 10; y <= 600; y += 10) assert.ok(drainProgress(y, 1000) <= drainProgress(y - 10, 1000));
});

test('packAtlas shelf-packs cells into rows no wider than maxW', () => {
 const packed = packAtlas([{w:100, h:50}, {w:100, h:60}, {w:100, h:40}], 220);
 assert.deepEqual([packed[0].y, packed[1].y], [0, 0]);
 assert.equal(packed[2].y, 60);
 assert.equal(packed.width, 200);
 assert.equal(packed.height, 100);
});

test('baseline centres the font box in the line box', () => {
 assert.equal(baseline(100, 100, 90, 25), 182.5);
});

