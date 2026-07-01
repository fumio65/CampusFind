const STUDENT_ID_RE = /^\d{2}-\d{5}$/
const ENROLLMENT_RE = /^\d{6,10}$/
const REQUIRED_COLUMNS = [
  'Student ID', 'Enrollment Number', 'Last Name', 'First Name',
  'Program/Course', 'Year Level', 'Status',
]

const STATUS_TO_ACTION = {
  New: 'create',
  Continuing: 'create',
  'Graduate/Inactive': 'deactivate',
  Graduate: 'deactivate',
  Inactive: 'deactivate',
}

export function validateHeaders(headerRow) {
  const missing = REQUIRED_COLUMNS.filter((col) => !headerRow.includes(col))
  return missing.length === 0 ? null : `Missing required column(s): ${missing.join(', ')}`
}

export function classifyRow(row) {
  const studentId = (row['Student ID'] ?? '').trim()
  const enrollmentNumber = (row['Enrollment Number'] ?? '').trim()
  const lastName = (row['Last Name'] ?? '').trim()
  const firstName = (row['First Name'] ?? '').trim()
  const status = (row['Status'] ?? '').trim()

  if (!studentId || !STUDENT_ID_RE.test(studentId)) {
    return { action: 'error', error_message: 'bad student ID format, expected YY-NNNNN' }
  }
  if (!enrollmentNumber || !ENROLLMENT_RE.test(enrollmentNumber)) {
    return { action: 'error', error_message: 'enrollment number must be 6-10 digits' }
  }
  if (!lastName || !firstName) {
    return { action: 'error', error_message: 'last name and first name are required' }
  }
  const action = STATUS_TO_ACTION[status]
  if (!action) {
    return {
      action: 'error',
      error_message: `unrecognized status "${status}", expected New, Continuing, or Graduate/Inactive`,
    }
  }

  return { action, error_message: null }
}

export function classifyRows(rawRows, existingStudentIds, existingEnrollmentNumbers) {
  const seenStudentIds = new Set()
  const seenEnrollmentNumbers = new Set()

  return rawRows.map((row, index) => {
    const studentId = (row['Student ID'] ?? '').trim()
    const enrollmentNumber = (row['Enrollment Number'] ?? '').trim()
    const classified = classifyRow(row)

    let action = classified.action
    let errorMessage = classified.error_message

    if (action !== 'error') {
      const isDuplicateInFile =
        seenStudentIds.has(studentId) || seenEnrollmentNumbers.has(enrollmentNumber)
      const isDuplicateInDb =
        existingStudentIds.has(studentId) || existingEnrollmentNumbers.has(enrollmentNumber)

      if (isDuplicateInFile || isDuplicateInDb) {
        action = 'skip_duplicate'
        errorMessage = isDuplicateInDb ? 'enrollment no. or student ID already exists' : 'duplicate within this file'
      } else {
        seenStudentIds.add(studentId)
        seenEnrollmentNumbers.add(enrollmentNumber)
      }
    }

    return {
      row_number: index + 1,
      student_id: studentId || null,
      enrollment_number: enrollmentNumber || null,
      last_name: (row['Last Name'] ?? '').trim() || null,
      first_name: (row['First Name'] ?? '').trim() || null,
      middle_name: (row['Middle Name'] ?? '').trim() || null,
      program: (row['Program/Course'] ?? '').trim() || null,
      year_level: (row['Year Level'] ?? '').trim() || null,
      csv_status: (row['Status'] ?? '').trim() || null,
      action,
      error_message: errorMessage,
    }
  })
}