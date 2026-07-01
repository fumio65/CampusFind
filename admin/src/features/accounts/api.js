import { supabase } from '../../shared/lib/supabaseClient'

export async function fetchAccounts({ limit = 50 } = {}) {
  const { data, error } = await supabase
    .from('users')
    .select('id, student_id, first_name, last_name, role, status, trust_score')
    .order('last_name', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data.map((u) => ({
    id: u.id,
    student_id: u.student_id,
    name: `${u.first_name} ${u.last_name}`,
    role: u.role,
    status: u.status,
    trust_score: u.trust_score,
  }))
}

export async function createSingleAccount({ studentId, enrollmentNumber, lastName, firstName }) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      student_id: studentId,
      enrollment_number: enrollmentNumber,
      last_name: lastName,
      first_name: firstName,
      role: 'student',
      status: 'active',
      force_password_change: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}
