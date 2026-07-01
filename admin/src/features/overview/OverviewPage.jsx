import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertTriangle, Upload, BarChart3 } from 'lucide-react'
import { fetchReports } from '../reports/api'
import { mockReports } from '../reports/mockData'
import { fetchAnalyticsSummary } from '../analytics/api'
import { mockAnalytics } from '../analytics/mockData'
import StatusPill from '../../shared/components/StatusPill'
import { staggerContainer, staggerItem } from '../../shared/lib/motion'

export default function OverviewPage() {
  const [reports, setReports] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [reportData, summaryData] = await Promise.all([
          fetchReports({ limit: 4 }),
          fetchAnalyticsSummary(),
        ])
        setReports(reportData)
        setSummary(summaryData)
        setUsingMockData(false)
      } catch (err) {
        console.warn('Falling back to mock overview data:', err.message)
        setReports(mockReports.slice(0, 4))
        setSummary(mockAnalytics)
        setUsingMockData(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stalled = reports.filter((r) => r.status === 'approved')

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-primary mb-4">Overview</h2>

      {usingMockData && (
        <div className="bg-status-claimed-bg text-status-claimed-text text-xs rounded-md px-3 py-2 mb-3">
          Showing sample data. Connect Supabase (.env.local) to see real activity.
        </div>
      )}

      {loading ? (
        <div className="text-sm text-text-muted py-8 text-center">Loading...</div>
      ) : (
        <>
          <motion.div className="grid grid-cols-3 gap-4 mb-5" {...staggerContainer}>
            <motion.div className="bg-surface-card border border-border rounded-xl p-5" {...staggerItem}>
              <div className="text-xs text-text-secondary mb-1">Items reported</div>
              <div className="text-3xl font-bold text-brand-600">{summary.itemsReported}</div>
            </motion.div>
            <motion.div className="bg-surface-card border border-border rounded-xl p-5" {...staggerItem}>
              <div className="text-xs text-text-secondary mb-1">Claim approval rate</div>
              <div className="text-3xl font-bold text-brand-600">{summary.claimApprovalRate}%</div>
            </motion.div>
            <motion.div className="bg-surface-card border border-border rounded-xl p-5" {...staggerItem}>
              <div className="text-xs text-text-secondary mb-1">Avg time to recovery</div>
              <div className="text-3xl font-bold text-brand-600">
                {summary.avgTimeToRecoveryDays ?? '—'} {summary.avgTimeToRecoveryDays ? 'days' : ''}
              </div>
            </motion.div>
          </motion.div>

          {stalled.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.12 }}
              className="bg-status-claimed-bg border border-status-claimed-text/20 rounded-xl p-4 mb-4 flex gap-3 items-start"
            >
              <AlertTriangle size={18} className="text-status-claimed-text shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-status-claimed-text">
                  {stalled.length} report{stalled.length > 1 ? 's' : ''} awaiting handoff confirmation
                </div>
                <p className="text-xs text-status-claimed-text mt-0.5">
                  These reports are Approved but unconfirmed past the day-3 reminder. Review and force-resolve if the reporter remains unresponsive.
                </p>
              </div>
            </motion.div>
          )}

          <motion.div className="grid grid-cols-2 gap-3" {...staggerContainer}>
            <motion.div {...staggerItem}>
              <Link
                to="/bulk-import"
                className="bg-surface-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-border-strong transition-colors"
              >
                <Upload size={20} className="text-brand-600" aria-hidden="true" />
                <div>
                  <div className="text-sm font-semibold">Run a bulk import</div>
                  <div className="text-xs text-text-secondary">Upload the Registrar CSV for the new term.</div>
                </div>
              </Link>
            </motion.div>
            <motion.div {...staggerItem}>
              <Link
                to="/analytics"
                className="bg-surface-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-border-strong transition-colors"
              >
                <BarChart3 size={20} className="text-brand-600" aria-hidden="true" />
                <div>
                  <div className="text-sm font-semibold">View analytics</div>
                  <div className="text-xs text-text-secondary">Trends, claim rates, and trust distribution.</div>
                </div>
              </Link>
            </motion.div>
          </motion.div>

          <div className="mt-5">
            <div className="text-sm font-semibold mb-2">Recent reports</div>
            {reports.length === 0 ? (
              <div className="bg-surface-card border border-border rounded-xl py-10 text-center">
                <p className="text-sm font-semibold text-text-primary mb-1">No reports yet</p>
                <p className="text-xs text-text-muted">Activity will show up here once students start reporting items.</p>
              </div>
            ) : (
              <div className="bg-surface-card border border-border rounded-xl divide-y divide-border">
                {reports.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>{r.title}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-muted">{r.location}</span>
                      <StatusPill status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
