const STATUS_STYLES = {
  open: 'bg-status-open-bg text-status-open-text',
  claimed: 'bg-status-claimed-bg text-status-claimed-text',
  approved: 'bg-status-approved-bg text-status-approved-text',
  resolved: 'bg-status-resolved-bg text-status-resolved-text',
  rejected: 'bg-status-rejected-bg text-status-rejected-text',
  pending: 'bg-status-claimed-bg text-status-claimed-text',
  create: 'bg-status-open-bg text-status-open-text',
  deactivate: 'bg-status-claimed-bg text-status-claimed-text',
  skip_duplicate: 'bg-surface-muted text-text-secondary',
  error: 'bg-status-rejected-bg text-status-rejected-text',
}

const STATUS_LABELS = {
  open: 'Open',
  claimed: 'Claimed',
  approved: 'Approved',
  resolved: 'Resolved',
  rejected: 'Rejected',
  pending: 'Pending',
  create: 'Create',
  deactivate: 'Deactivate',
  skip_duplicate: 'Skip duplicate',
  error: 'Error',
}

/**
 * Renders a status pill. `status` must match a report_status, claim_status,
 * or bulk_import_row_action value from the Supabase schema (0001_init_schema.sql)
 * so that admin UI states always trace back to one source of truth.
 */
export default function StatusPill({ status }) {
  const style = STATUS_STYLES[status] ?? 'bg-surface-muted text-text-secondary'
  const label = STATUS_LABELS[status] ?? status

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style}`}>
      {label}
    </span>
  )
}
