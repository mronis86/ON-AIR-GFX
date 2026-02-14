/**
 * Escape a value for CSV (quote if needed).
 */
function escapeCsv(s: string): string {
  const t = String(s ?? '').replace(/"/g, '""');
  return t.includes(',') || t.includes('"') || t.includes('\n') || t.includes('\r') ? `"${t}"` : t;
}

/** One Q&A item for CSV (question + name). */
export interface QaCsvItem {
  question: string;
  submitterName?: string;
}

/**
 * Build a CSV with 6 columns: Question ACTIVE, Name ACTIVE, Question Cue, Name Cue, Question Next, Name Next.
 */
export function buildLiveQaCsv6(data: {
  active: QaCsvItem | null;
  cue: QaCsvItem | null;
  next: QaCsvItem | null;
}): string {
  const a = data.active;
  const c = data.cue;
  const n = data.next;
  const rows: string[] = [
    'Question ACTIVE,Name ACTIVE,Question Cue,Name Cue,Question Next,Name Next',
    [
      escapeCsv(a?.question ?? ''),
      escapeCsv(a?.submitterName ?? ''),
      escapeCsv(c?.question ?? ''),
      escapeCsv(c?.submitterName ?? ''),
      escapeCsv(n?.question ?? ''),
      escapeCsv(n?.submitterName ?? ''),
    ].join(','),
  ];
  return '\uFEFF' + rows.join('\r\n'); // BOM for Excel
}

/**
 * Build a CSV with only the active live Q&A (question, answer, submitter). One data row.
 * @deprecated Use buildLiveQaCsv6 for new format.
 */
export function buildLiveQaCsv(data: {
  activeQA: { question: string; answer?: string; submitterName?: string } | null;
  eventName?: string;
  updatedAt?: string;
}): string {
  const q = data.activeQA;
  const active = q ? { question: q.question ?? '', submitterName: q.submitterName } : null;
  return buildLiveQaCsv6({ active, cue: null, next: null });
}

/**
 * Build a CSV string from live state (active poll + active Q&A) for download or export.
 */
export function buildLiveDataCsv(data: {
  activePoll: { title: string; options?: Array<{ text: string; votes?: number }> } | null;
  activeQA: { question: string; answer?: string; submitterName?: string } | null;
  eventName?: string;
  updatedAt?: string;
}): string {
  const rows: string[] = [];
  rows.push('Section,Field,Value');
  rows.push('Event,Name,' + escapeCsv(data.eventName ?? ''));
  rows.push('Event,Updated,' + escapeCsv(data.updatedAt ?? ''));

  if (data.activePoll) {
    rows.push('Poll,Title,' + escapeCsv(data.activePoll.title));
    if (data.activePoll.options?.length) {
      data.activePoll.options.forEach((opt, i) => {
        rows.push('Poll,Option ' + (i + 1) + ',' + escapeCsv(opt.text));
        rows.push('Poll,Votes ' + (i + 1) + ',' + (opt.votes ?? 0));
      });
    }
  } else {
    rows.push('Poll,Title,');
  }

  if (data.activeQA) {
    rows.push('Q&A,Question,' + escapeCsv(data.activeQA.question));
    rows.push('Q&A,Answer,' + escapeCsv(data.activeQA.answer ?? ''));
    rows.push('Q&A,Submitter,' + escapeCsv(data.activeQA.submitterName ?? ''));
  } else {
    rows.push('Q&A,Question,');
  }

  return '\uFEFF' + rows.join('\r\n'); // BOM for Excel
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
