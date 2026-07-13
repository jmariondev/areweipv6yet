export const STATUSES = ['full', 'partial', 'none', 'unknown'];

// Order services appear in api.json: best support first, then by name.
export const STATUS_ORDER = { full: 0, partial: 1, none: 2, unknown: 3 };

// Order groups appear on the page: worst first — the holdouts are the story.
export const GROUP_ORDER = ['none', 'partial', 'full', 'unknown'];

// The big answer at the top of the page, derived from the stats so the page
// can never contradict its own data. `key` doubles as a CSS class hook.
export function verdict(stats) {
  if (stats.none === 0 && stats.partial === 0) return { answer: 'Yes. Finally.', key: 'yes' };
  const pctFull = Math.round((stats.full / stats.total) * 100);
  if (pctFull >= 90) return { answer: 'Nearly.', key: 'nearly' };
  if (pctFull >= 75) return { answer: 'Almost. Annoyingly close.', key: 'almost' };
  if (pctFull >= 50) return { answer: 'Not yet.', key: 'notyet' };
  if (pctFull >= 25) return { answer: 'No.', key: 'no' };
  return { answer: 'No. Not even close.', key: 'nope' };
}

// The headline status is derived from the web DNS checks only. MX, NS, and
// HTTP results are auxiliary signals: they annotate a service but never
// change its headline status.
//
//   web pass  + www pass or n/a  -> full
//   web pass  + www fail         -> partial
//   web fail  + www pass         -> partial
//   web fail  + www fail or n/a  -> none
//   no web result                -> unknown
export function deriveStatus(checks) {
  const web = checks?.web?.pass;
  const www = checks?.www?.pass;

  if (web !== true && web !== false) return 'unknown';

  const wwwApplicable = www === true || www === false;
  if (web) return !wwwApplicable || www ? 'full' : 'partial';
  return wwwApplicable && www ? 'partial' : 'none';
}

// A human override (with reason) wins over the derived status.
export function effectiveStatus(service, checks) {
  const derived = deriveStatus(checks);
  return { derived, status: service.override?.status ?? derived };
}
