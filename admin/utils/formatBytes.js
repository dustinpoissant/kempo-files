const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

/*
  1000-based (KB, not KiB) to match how every OS file browser and upload-limit setting already
  describes file sizes — matching that convention beats being technically correct in a way nobody
  else here uses.
*/
export const formatBytes = bytes => {
  if(typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if(bytes === 0) return '0 B';

  const exponent = Math.min(Math.floor(Math.log10(bytes) / 3), UNITS.length - 1);
  const value = bytes / 1000 ** exponent;
  const decimals = exponent === 0 ? 0 : value < 10 ? 2 : value < 100 ? 1 : 0;

  // parseFloat drops trailing zeros toFixed would otherwise pad in ("4.20" -> 4.2, not "4.20")
  return `${parseFloat(value.toFixed(decimals))} ${UNITS[exponent]}`;
};
