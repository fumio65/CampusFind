import { Router } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { supabaseAdmin } from '../lib/supabaseAdmin.js'
import { validateHeaders, classifyRows, classifyRow } from '../lib/bulkImportValidation.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// GET /accounts/bulk-import/:batchId
// Re-hydrates a pending batch's preview. Exists because the admin dashboard
// only keeps the preview in component state, which is lost on navigation --
// this lets the page re-fetch the same batch instead of losing the upload.
router.get('/bulk-import/:batchId', async (req, res) => {
  const { batchId } = req.params

  const { data: batch, error: batchError } = await supabaseAdmin
    .from('bulk_import_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (batchError) return res.status(404).json({ error: 'Import batch not found.' })

  const { data: rows, error: rowsError } = await supabaseAdmin
    .from('bulk_import_rows')
    .select('*')
    .eq('batch_id', batchId)
    .order('row_number', { ascending: true })

  if (rowsError) return res.status(500).json({ error: rowsError.message })

  res.json({ batch, rows })
})

// POST /accounts/bulk-import
// Parses + classifies the CSV and persists it as a pending preview batch.
// Does NOT write to `users` yet -- that only happens on /confirm, per FR-1's
// "No accounts are created, modified, or deactivated until the admin
// explicitly confirms the preview."
router.post('/bulk-import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Send a CSV under the "file" field.' })
  }

  // TODO: replace with the authenticated admin's real user id once auth
  // middleware is wired up (verify the Supabase JWT from the dashboard).
  const uploadedBy = req.body.uploadedBy
  if (!uploadedBy) {
    return res.status(401).json({ error: 'uploadedBy (admin user id) is required.' })
  }

  let rawRows
  try {
    rawRows = parse(req.file.buffer, { columns: true, skip_empty_lines: true, trim: true })
  } catch (err) {
    return res.status(400).json({ error: `Could not parse CSV: ${err.message}` })
  }

  if (rawRows.length === 0) {
    return res.status(400).json({ error: 'CSV has no data rows.' })
  }

  const headerError = validateHeaders(Object.keys(rawRows[0]))
  if (headerError) {
    return res.status(400).json({ error: headerError })
  }

  // Pull existing student_id / enrollment_number sets once, so duplicate
  // checks across hundreds of rows don't each round-trip to the DB.
  const { data: existingUsers, error: fetchError } = await supabaseAdmin
    .from('users')
    .select('student_id, enrollment_number')

  if (fetchError) {
    return res.status(500).json({ error: `Could not check existing accounts: ${fetchError.message}` })
  }

  const existingStudentIds = new Set(existingUsers.map((u) => u.student_id))
  const existingEnrollmentNumbers = new Set(existingUsers.map((u) => u.enrollment_number))

  const classifiedRows = classifyRows(rawRows, existingStudentIds, existingEnrollmentNumbers)

  const { data: batch, error: batchError } = await supabaseAdmin
    .from('bulk_import_batches')
    .insert({ uploaded_by: uploadedBy, filename: req.file.originalname, status: 'pending_review' })
    .select()
    .single()

  if (batchError) {
    return res.status(500).json({ error: `Could not create import batch: ${batchError.message}` })
  }

  const rowsToInsert = classifiedRows.map((row) => ({ ...row, batch_id: batch.id }))

  // A single insert() with thousands of rows risks exceeding PostgREST's
  // request size/row limits, so chunk it. 1000 rows/chunk is comfortably
  // under typical Supabase limits; tune if needed for very large imports.
  const INSERT_CHUNK_SIZE = 1000
  const insertedRows = []
  for (let i = 0; i < rowsToInsert.length; i += INSERT_CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + INSERT_CHUNK_SIZE)
    const { data: chunkResult, error: chunkError } = await supabaseAdmin
      .from('bulk_import_rows')
      .insert(chunk)
      .select()

    if (chunkError) {
      // Best-effort cleanup: remove whatever rows did make it in for this
      // batch, and the batch itself, so a failed upload doesn't leave a
      // half-populated pending_review batch behind.
      await supabaseAdmin.from('bulk_import_rows').delete().eq('batch_id', batch.id)
      await supabaseAdmin.from('bulk_import_batches').delete().eq('id', batch.id)
      return res.status(500).json({
        error: `Could not save import rows (failed at row ${i + 1}-${i + chunk.length}): ${chunkError.message}`,
      })
    }
    insertedRows.push(...chunkResult)
  }

  const counts = classifiedRows.reduce(
    (acc, row) => ({ ...acc, [row.action]: (acc[row.action] ?? 0) + 1 }),
    {}
  )

  res.status(201).json({ batch, rows: insertedRows, counts })
})

// PATCH /accounts/bulk-import/:batchId/rows/:rowId
// Lets the admin edit a row's values in the preview before confirming
// (FR-1: "allowing the admin to review and directly edit any row's values
// before confirming"). Re-validates server-side using the same classifyRow
// logic the initial upload used, rather than trusting a client-supplied
// `action`/`error_message` -- the client shouldn't be the authority on
// whether its own fix actually resolved the error.
//
// Does not re-run duplicate detection against the rest of the batch or DB
// here (that would mean re-fetching and re-scanning the whole batch on every
// keystroke-save); if an edit creates a new duplicate, /confirm's DB-level
// uniqueness constraint will catch it and the whole batch fails to commit,
// which is still consistent with all-or-nothing -- it just surfaces the
// conflict at confirm time instead of edit time.
router.patch('/bulk-import/:batchId/rows/:rowId', async (req, res) => {
  const { batchId, rowId } = req.params
  const editableFields = [
    'student_id', 'enrollment_number', 'last_name', 'first_name',
    'middle_name', 'program', 'year_level', 'csv_status',
  ]
  const edits = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => editableFields.includes(key))
  )

  if (Object.keys(edits).length === 0) {
    return res.status(400).json({ error: 'No editable fields provided.' })
  }

  // Re-classify using the merged (existing + edited) row data, mapping our
  // snake_case DB columns back to the CSV-header keys classifyRow expects.
  const { data: existingRow, error: fetchError } = await supabaseAdmin
    .from('bulk_import_rows')
    .select('*')
    .eq('id', rowId)
    .eq('batch_id', batchId)
    .single()

  if (fetchError) return res.status(404).json({ error: 'Row not found.' })

  const merged = { ...existingRow, ...edits }
  const reclassified = classifyRow({
    'Student ID': merged.student_id,
    'Enrollment Number': merged.enrollment_number,
    'Last Name': merged.last_name,
    'First Name': merged.first_name,
    'Status': merged.csv_status,
  })

  const updates = {
    ...edits,
    action: reclassified.action,
    error_message: reclassified.error_message,
    edited: true,
  }

  const { data, error } = await supabaseAdmin
    .from('bulk_import_rows')
    .update(updates)
    .eq('id', rowId)
    .eq('batch_id', batchId)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// POST /accounts/bulk-import/:batchId/confirm
// The all-or-nothing commit step. Re-checks for any 'error' rows first; if
// any exist, refuses to commit anything (CONTEXT.md: "any row-level
// validation error rejects the entire file. No partial commits.").
router.post('/bulk-import/:batchId/confirm', async (req, res) => {
  const { batchId } = req.params

  const { data: batch, error: batchFetchError } = await supabaseAdmin
    .from('bulk_import_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (batchFetchError) return res.status(404).json({ error: 'Import batch not found.' })
  if (batch.status !== 'pending_review') {
    return res.status(409).json({ error: `Batch is already ${batch.status}, cannot confirm again.` })
  }

  const { data: rows, error: rowsFetchError } = await supabaseAdmin
    .from('bulk_import_rows')
    .select('*')
    .eq('batch_id', batchId)

  if (rowsFetchError) return res.status(500).json({ error: rowsFetchError.message })

  const errorRows = rows.filter((r) => r.action === 'error')
  if (errorRows.length > 0) {
    return res.status(422).json({
      error: 'This import has unresolved error rows. Fix or remove them before confirming, imports are all-or-nothing.',
      errorRows,
    })
  }

  const toCreate = rows.filter((r) => r.action === 'create')
  const toDeactivate = rows.filter((r) => r.action === 'deactivate')
  // skip_duplicate rows are intentionally left untouched.

  // Supabase doesn't expose multi-table transactions over the JS client, so
  // we do a best-effort sequential commit and roll back created rows on
  // partial failure to approximate all-or-nothing at the application layer.
  // (A proper fix is a Postgres function called via .rpc() that wraps both
  // operations in a single transaction -- left as a follow-up.)
  const createdIds = []
  try {
    for (const row of toCreate) {
      const { data: created, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          student_id: row.student_id,
          enrollment_number: row.enrollment_number,
          last_name: row.last_name,
          first_name: row.first_name,
          middle_name: row.middle_name,
          program: row.program,
          year_level: row.year_level,
          role: 'student',
          status: 'active',
          force_password_change: true,
        })
        .select()
        .single()

      if (createError) throw new Error(`Row ${row.row_number}: ${createError.message}`)
      createdIds.push(created.id)
    }

    for (const row of toDeactivate) {
      const { error: deactivateError } = await supabaseAdmin
        .from('users')
        .update({ status: 'deactivated' })
        .eq('student_id', row.student_id)

      if (deactivateError) throw new Error(`Row ${row.row_number}: ${deactivateError.message}`)
    }
  } catch (err) {
    if (createdIds.length > 0) {
      await supabaseAdmin.from('users').delete().in('id', createdIds)
    }
    return res.status(500).json({
      error: `Import failed and was rolled back: ${err.message}`,
    })
  }

  await supabaseAdmin
    .from('bulk_import_batches')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', batchId)

  res.json({
    ok: true,
    created: toCreate.length,
    deactivated: toDeactivate.length,
    skipped: rows.filter((r) => r.action === 'skip_duplicate').length,
  })
})

// POST /accounts/bulk-import/:batchId/cancel
router.post('/bulk-import/:batchId/cancel', async (req, res) => {
  const { batchId } = req.params
  const { error } = await supabaseAdmin
    .from('bulk_import_batches')
    .update({ status: 'discarded' })
    .eq('id', batchId)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

export default router