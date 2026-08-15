import { formatBytes } from '../admin/utils/formatBytes.js';

export default {
  'formatBytes: 0 bytes': ({ pass, fail }) => {
    if(formatBytes(0) !== '0 B') return fail(`Expected "0 B", got "${formatBytes(0)}"`);
    pass('0 bytes formats as "0 B"');
  },

  'formatBytes: bytes under 1000 have no decimal': ({ pass, fail }) => {
    if(formatBytes(842) !== '842 B') return fail(`Expected "842 B", got "${formatBytes(842)}"`);
    pass('Sub-1000 byte count has no decimal places');
  },

  'formatBytes: kilobytes': ({ pass, fail }) => {
    const result = formatBytes(4200);
    if(result !== '4.2 KB') return fail(`Expected "4.2 KB", got "${result}"`);
    pass('4200 bytes formats as "4.2 KB"');
  },

  'formatBytes: megabytes': ({ pass, fail }) => {
    const result = formatBytes(3_500_000);
    if(result !== '3.5 MB') return fail(`Expected "3.5 MB", got "${result}"`);
    pass('3,500,000 bytes formats as "3.5 MB"');
  },

  'formatBytes: gigabytes': ({ pass, fail }) => {
    const result = formatBytes(2_100_000_000);
    if(result !== '2.1 GB') return fail(`Expected "2.1 GB", got "${result}"`);
    pass('2.1 billion bytes formats as "2.1 GB"');
  },

  'formatBytes: values >= 100 in a unit drop to no decimals': ({ pass, fail }) => {
    const result = formatBytes(150_000_000);
    if(result !== '150 MB') return fail(`Expected "150 MB", got "${result}"`);
    pass('150,000,000 bytes formats as "150 MB", no decimal clutter');
  },

  'formatBytes: null/unmeasurable size returns an em dash': ({ pass, fail }) => {
    if(formatBytes(null) !== '—') return fail(`Expected "—", got "${formatBytes(null)}"`);
    if(formatBytes(undefined) !== '—') return fail(`Expected "—", got "${formatBytes(undefined)}"`);
    if(formatBytes(NaN) !== '—') return fail(`Expected "—", got "${formatBytes(NaN)}"`);
    pass('Missing/invalid sizes render as an em dash rather than "NaN" or "0 B"');
  },

  'formatBytes: negative numbers are treated as invalid': ({ pass, fail }) => {
    if(formatBytes(-5) !== '—') return fail(`Expected "—", got "${formatBytes(-5)}"`);
    pass('Negative byte counts render as an em dash');
  },
};
