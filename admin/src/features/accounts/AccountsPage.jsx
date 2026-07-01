import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { fetchAccounts, createSingleAccount } from './api'
import { mockAccounts } from './mockData'

export default function AccountsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [usingMockData, setUsingMockData] = useState(false)
  const [form, setForm] = useState({ studentId: '', enrollmentNumber: '', lastName: '', firstName: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchAccounts()
      setAccounts(data)
      setUsingMockData(false)
    } catch (err) {
      console.warn('Falling back to mock accounts:', err.message)
      setAccounts(mockAccounts)
      setUsingMockData(true)
    } finally {
      setLoading(false)
    }
  }

  const studentIdValid = /^\d{2}-\d{5}$/.test(form.studentId)
  const enrollmentValid = /^\d{6,10}$/.test(form.enrollmentNumber)
  const canSubmit = studentIdValid && enrollmentValid && form.lastName.trim() && form.firstName.trim()

  async function handleCreate() {
    setFormError(null)
    setSubmitting(true)
    try {
      await createSingleAccount({
        studentId: form.studentId,
        enrollmentNumber: form.enrollmentNumber,
        lastName: form.lastName,
        firstName: form.firstName,
      })
      setForm({ studentId: '', enrollmentNumber: '', lastName: '', firstName: '' })
      setShowAdd(false)
      await load()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-text-primary">Accounts</h2>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="px-3 py-2 text-sm rounded-md bg-brand-600 text-white flex items-center gap-1"
        >
          <Plus size={14} aria-hidden="true" /> Add account
        </button>
      </div>

      {usingMockData && (
        <div className="bg-status-claimed-bg text-status-claimed-text text-xs rounded-md px-3 py-2 mb-3">
          Showing sample data. Connect Supabase (.env.local) to manage real accounts.
        </div>
      )}

      {showAdd && (
        <div className="bg-surface-card border border-border rounded-xl p-4 mb-4 max-w-md">
          <div className="text-sm font-semibold mb-3">Add a single account</div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs text-text-secondary block mb-1">Student ID</label>
              <input
                placeholder="YY-NNNNN"
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="w-full h-9 px-3 text-sm rounded-md border border-border-strong"
              />
              {form.studentId && !studentIdValid && (
                <p className="text-[11px] text-status-rejected-text mt-1">Format must be YY-NNNNN</p>
              )}
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Enrollment number</label>
              <input
                placeholder="6-10 digits"
                value={form.enrollmentNumber}
                onChange={(e) => setForm({ ...form, enrollmentNumber: e.target.value })}
                className="w-full h-9 px-3 text-sm rounded-md border border-border-strong"
              />
              {form.enrollmentNumber && !enrollmentValid && (
                <p className="text-[11px] text-status-rejected-text mt-1">Must be 6-10 digits</p>
              )}
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">Last name</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-9 px-3 text-sm rounded-md border border-border-strong"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary block mb-1">First name</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-9 px-3 text-sm rounded-md border border-border-strong"
              />
            </div>
          </div>
          {formError && <p className="text-xs text-status-rejected-text mt-2">{formError}</p>}
          <button
            onClick={handleCreate}
            disabled={!canSubmit || submitting}
            className="mt-3 px-4 py-2 text-sm rounded-md bg-brand-600 text-white disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating...' : 'Create account'}
          </button>
          <p className="text-xs text-text-muted mt-2">
            For late enrollees or one-off corrections. For onboarding a full term, use bulk import instead.
          </p>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-text-muted py-8 text-center">Loading accounts...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl py-14 text-center">
          <p className="text-sm font-semibold text-text-primary mb-1">No accounts yet</p>
          <p className="text-xs text-text-muted max-w-xs mx-auto">
            Run a bulk import from the Registrar CSV, or add a single account above, to get started.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary font-semibold border-b border-border-strong">
                <th className="py-1.5 px-3">Student ID</th>
                <th className="py-1.5 px-3">Name</th>
                <th className="py-1.5 px-3">Role</th>
                <th className="py-1.5 px-3">Trust score</th>
                <th className="py-1.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="py-1.5 px-3">{a.student_id}</td>
                  <td className="py-1.5 px-3 font-medium">{a.name}</td>
                  <td className="py-1.5 px-3 text-text-secondary capitalize">{a.role}</td>
                  <td className="py-1.5 px-3">{a.trust_score}</td>
                  <td className="py-1.5 px-3">
                    <span className={`text-xs font-medium ${a.status === 'active' ? 'text-status-open-text' : 'text-text-muted'}`}>
                      {a.status === 'active' ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
