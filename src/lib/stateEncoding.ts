export type LabelMap = Record<string, string>;

export const decodeState = (value: number, target: Uint8Array): void => {
  for (let index = 0; index < target.length; index += 1) {
    // eslint-disable-next-line no-bitwise
    target[index] = (value >> index) & 1;
  }
};

export const encodeState = (source: Uint8Array): number => {
  let result = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index]) {
      // eslint-disable-next-line no-bitwise
      result |= (1 << index);
    }
  }
  return result;
};

export const formatState = (
  value: number,
  nodeOrder: string[],
  labels: LabelMap,
): { binary: string; values: Record<string, 0 | 1> } => {
  const values: Record<string, 0 | 1> = {};
  for (let index = 0; index < nodeOrder.length; index += 1) {
    const nodeId = nodeOrder[index];
    // eslint-disable-next-line no-bitwise
    const bit = (value >> index) & 1;
    values[nodeId] = bit ? 1 : 0;
    const label = labels[nodeId];
    if (label && label !== nodeId) {
      values[label] = bit ? 1 : 0;
    }
  }
  const binary = value.toString(2).padStart(nodeOrder.length, '0');
  return { binary, values };
};
