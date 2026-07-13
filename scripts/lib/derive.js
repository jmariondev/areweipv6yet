export const STATUSES = ['full', 'partial', 'none', 'unknown'];

// Order services appear on the page: best support first, then by name.
export const STATUS_ORDER = { full: 0, partial: 1, none: 2, unknown: 3 };

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
