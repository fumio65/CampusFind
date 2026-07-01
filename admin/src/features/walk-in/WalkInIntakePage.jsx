import { useState } from 'react'
import { Camera } from 'lucide-react'
import { createWalkInReport } from './api'

export default function WalkInIntakePage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [finderRef, setFinderRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    try {
      // adminUserId would normally come from the authenticated session
      // (supabase.auth.getUser()) once auth is wired up.
      await createWalkInReport({
        title,
        description,
        walkinFinderRef: finderRef,
        adminUserId: null,
      })
      setResult({ ok: true, message: 'Report created.' })
      setTitle('')
      setDescription('')
      setFinderRef('')
    } catch (err) {
      setResult({ ok: false, message: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-text-primary mb-4">Log a walk-in found item</h2>

      <form onSubmit={handleSubmit} className="bg-surface-card border border-border rounded-xl p-6 max-w-lg flex flex-col gap-4">
        <div>
          <label className="text-xs text-text-secondary block mb-1" htmlFor="title">Title</label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. USB flash drive"
            className="w-full h-9 px-3 text-sm rounded-md border border-border-strong focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1" htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does it look like?"
            className="w-full px-3 py-2 text-sm rounded-md border border-border-strong resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Pickup location</label>
          <input
            value="ISSC office"
            disabled
            className="w-full h-9 px-3 text-sm rounded-md border border-border-strong bg-surface-muted text-text-secondary"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1" htmlFor="finderRef">
            Walk-in finder reference
          </label>
          <input
            id="finderRef"
            value={finderRef}
            onChange={(e) => setFinderRef(e.target.value)}
            placeholder="Name or student ID for internal record"
            className="w-full h-9 px-3 text-sm rounded-md border border-border-strong focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>

        <div>
          <label className="text-xs text-text-secondary block mb-1">Photo (optional)</label>
          <button
            type="button"
            className="w-16 h-16 border border-dashed border-border-strong rounded-md flex items-center justify-center text-text-muted"
            aria-label="Add a photo"
          >
            <Camera size={20} aria-hidden="true" />
          </button>
        </div>

        {result && (
          <p className={`text-xs ${result.ok ? 'text-status-open-text' : 'text-status-rejected-text'}`}>
            {result.message}
          </p>
        )}

        <button
          type="submit"
          disabled={!title.trim() || !finderRef.trim() || submitting}
          className="mt-1.5 px-4 py-2.5 text-sm font-semibold rounded-md bg-brand-600 text-white disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed"
        >
          {submitting ? 'Creating...' : 'Create report'}
        </button>
        <p className="text-xs text-text-muted m-0">
          This report skips the claim step. The owner shows up in person, and you verify their school ID before marking it resolved.
        </p>
      </form>
    </div>
  )
}
