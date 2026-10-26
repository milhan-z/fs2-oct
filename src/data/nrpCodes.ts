import { DEPARTMENTS } from './faculties'

/**
 * An ITS NRP starts with the 4-digit department code, then the 2-digit class year (5025 24 1 001 → Informatics, 2024).
 * Codes are from ITS's official "Daftar Kategori Departemen" and the 2023–2028 curriculum list (the newer departments:
 * 5048–5054). Departments without a verified code (Process Safety, Medicine, Technology Management, vocational
 * programmes) are not guessed: the participant picks them from the list.
 */
export const NRP_DEPARTMENT: Record<string, string> = {
  '5001': 'Physics',
  '5002': 'Mathematics',
  '5003': 'Statistics',
  '5004': 'Chemistry',
  '5005': 'Biology',
  '5006': 'Actuarial Science',
  '5007': 'Mechanical Engineering',
  '5008': 'Chemical Engineering',
  '5009': 'Engineering Physics',
  '5010': 'Industrial and Systems Engineering',
  '5011': 'Materials and Metallurgical Engineering',
  '5012': 'Civil Engineering',
  '5013': 'Architecture',
  '5014': 'Environmental Engineering',
  '5015': 'Urban and Regional Planning',
  '5016': 'Geomatics Engineering',
  '5017': 'Geophysics Engineering',
  '5018': 'Naval Architecture and Shipbuilding Engineering',
  '5019': 'Marine Engineering',
  '5020': 'Ocean Engineering',
  '5021': 'Sea Transportation Engineering',
  '5022': 'Electrical Engineering',
  '5023': 'Biomedical Engineering',
  '5024': 'Computer Engineering',
  '5025': 'Informatics',
  '5026': 'Information Systems',
  '5027': 'Information Technology',
  '5028': 'Product Design',
  '5029': 'Interior Design',
  '5030': 'Visual Communication Design',
  '5031': 'Business Management',
  '5033': 'Development Studies',
  '5045': 'Food Engineering',
  '5046': 'Offshore Engineering',
  '5048': 'Telecommunication Engineering',
  '5049': 'Medical Technology Programme',
  '5050': 'Analytical Science',
  '5051': 'Digital Innovation',
  '5052': 'Data Science',
  '5053': 'Software Engineering',
  '5054': 'Artificial Intelligence Engineering',
}

/** The department an NRP belongs to, once its first 4 digits are typed (null when unknown). */
export function departmentFromNrp(nrp: string): string | null {
  const d = NRP_DEPARTMENT[nrp.slice(0, 4)]
  return d && DEPARTMENTS.includes(d) ? d : null
}

/** The class year from digits 5–6 ("24" → "2024"), once typed and plausible (null otherwise). */
export function yearFromNrp(nrp: string): string | null {
  if (nrp.length < 6) return null
  const y = 2000 + Number(nrp.slice(4, 6))
  return y >= 2010 && y <= 2035 ? String(y) : null
}
