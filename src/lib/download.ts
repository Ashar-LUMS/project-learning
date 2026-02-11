import pako from 'pako';

function triggerBrowserDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads text as a file. If the filename ends with `.gz`, the contents are gzip-compressed
 * so the extension matches the actual file format.
 */
export function downloadTextAsFile(filename: string, text: string) {
  const lower = filename.toLowerCase();

  if (lower.endsWith('.gz')) {
    const gzBytes = pako.gzip(text);
    const blob = new Blob([gzBytes], { type: 'application/gzip' });
    triggerBrowserDownload(filename, blob);
    return;
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerBrowserDownload(filename, blob);
}
