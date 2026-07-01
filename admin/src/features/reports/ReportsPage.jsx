import { useEffect, useState } from 'react'
import { fetchReports, forceResolveReport } from './api'
import { mockReports } from './mockData'
import StatusPill from '../../shared/components/StatusPill'

export default function ReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReports()
      setReports(data)
      setUsingMockData(false)
    } catch (err) {
      // Falls back to mock data when Supabase isn't configured yet (e.g. no
      // .env.local), so the UI stays usable during local development.
      console.warn('Falling back to mock reports:', err.message)
      setReports(mockReports)
      setUsingMockData(true)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleForceResolve(id) {
    try {
      await forceResolveReport(id)
      await load()
    } catch (err) {
      alert(`Couldn't resolve this report. ${err.message}`)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-text-primary">Reports</h2>
        <input
          placeholder="Search by title or location"
          className="h-9 px-3 text-sm rounded-md border border-border-strong w-64 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {usingMockData && (
        <div className="bg-status-claimed-bg text-status-claimed-text text-xs rounded-md px-3 py-2 mb-3">
          Showing sample data. Connect Supabase (.env.local) to see real reports. {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-text-muted py-8 text-center">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl py-14 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">No reports yet</p>
          <p className="text-xs text-text-muted max-w-xs mx-auto">
            Reports filed by students, or walk-in items you log yourself, will show up here.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary font-semibold border-b border-border-strong">
                <th className="py-1.5 px-3">Title</th>
                <th className="py-1.5 px-3">Type</th>
                <th className="py-1.5 px-3">Location</th>
                <th className="py-1.5 px-3">Reporter</th>
                <th className="py-1.5 px-3">Status</th>
                <th className="py-1.5 px-3">Filed</th>
                <th className="py-1.5 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 px-3 font-medium">{r.title}</td>
                  <td className="py-1.5 px-3 text-text-secondary">
                    {r.type === 'found_walkin' ? 'Walk-in' : 'Lost'}
                  </td>
                  <td className="py-1.5 px-3 text-text-secondary">{r.location}</td>
                  <td className="py-1.5 px-3 text-text-secondary">{r.reporter}</td>
                  <td className="py-1.5 px-3"><StatusPill status={r.status} /></td>
                  <td className="py-1.5 px-3 text-text-muted">
                    {typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : r.created_at}
                  </td>
                  <td className="py-1.5 px-3">
                    {r.status === 'approved' && (
                      <button
                        onClick={() => handleForceResolve(r.id)}
                        className="text-xs text-status-rejected-text hover:underline"
                      >
                        Force resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-text-muted mt-2">
        Force resolve is for reports stuck in Approved past the reminder cadence, when the reporter remains unresponsive (FR-5).
      </p>
    </div>
  )
}
