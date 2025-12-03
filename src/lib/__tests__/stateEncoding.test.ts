import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, formatState } from '../stateEncoding';

describe('stateEncoding helpers', () => {
  it('round-trips encode/decode', () => {
    const vec = new Uint8Array([1,0,1,1]);
    const encoded = encodeState(vec);
    const out = new Uint8Array(4);
    decodeState(encoded, out);
    expect(Array.from(out)).toEqual([1,0,1,1]);
  });

  it('formatState returns binary and values map', () => {
    const vec = new Uint8Array([1,0,1]);
    const encoded = encodeState(vec);
    const nodeOrder = ['A','B','C'];
    const nodeLabels = { A: 'A', B: 'B', C: 'C' };
    const formatted = formatState(encoded, nodeOrder, nodeLabels);
    expect(formatted.binary).toMatch(/^[01]{3}$/);
    expect(formatted.values).toMatchObject({ A: 1, B: 0, C: 1 });
  });
});
