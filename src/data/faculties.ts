// ITS faculties and their departments, named exactly as in the committee's feedback form (so the export matches it).
export const ITS_FACULTIES: Record<string, string[]> = {
  'Faculty of Science and Data Analystics (SCIENTICS)': ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'Statistics', 'Actuarial Science', 'Analytical Science', 'Data Science'],
  'Faculty of Industrial Technology and Systems Engineering (INDSYS)': ['Mechanical Engineering', 'Chemical Engineering', 'Engineering Physics', 'Industrial and Systems Engineering', 'Materials and Metallurgical Engineering', 'Food Engineering', 'Process Safety Engineering'],
  'Faculty of Civil, Planning, and Geo Engineering (CIVPLAN)': ['Civil Engineering', 'Architecture', 'Environmental Engineering', 'Urban and Regional Planning', 'Geomatics Engineering', 'Geophysics Engineering', 'Civil Infrastructure Engineering'],
  'Faculty of Vocational (VOCATION)': ['Industrial Mechanical Engineering', 'Automation Electronic Engineering', 'Industrial Chemical Engineering', 'Instrumentation Engineering', 'Business Statistics'],
  'Faculty of Medicine and Health (MEDICS)': ['Medical Technology Programme', 'Academic Stage of Medical Programme', 'Professional Stage of Medical Programme'],
  'Faculty of Marine Technology (MARTECH)': ['Naval Architecture and Shipbuilding Engineering', 'Marine Engineering', 'Ocean Engineering', 'Sea Transportation Engineering', 'Offshore Engineering'],
  'Faculty of Intelligent Electrical and Informatics Technology (ELECTICS)': ['Informatics', 'Information Systems', 'Information Technology', 'Electrical Engineering', 'Computer Engineering', 'Biomedical Engineering', 'Telecommunication Engineering', 'Software Engineering', 'Artificial Intelligence Engineering', 'Digital Innovation'],
  'Faculty of Creative Design and Digital Business (CREABIZ)': ['Product Design', 'Business Management', 'Interior Design', 'Visual Communication Design'],
  'Interdisciplinary School of Management and Technology (SIMT)': ['Development Studies', 'Technology Management'],
}

/** Names used before the committee's list was adopted → the name in the list. */
const LEGACY: Record<string, string> = {
  'Food Technology': 'Food Engineering',
  'Geophysical Engineering': 'Geophysics Engineering',
  'Industrial Product Design': 'Product Design',
  'Electrical Automation Engineering': 'Automation Electronic Engineering',
  'Medical Technology': 'Medical Technology Programme',
  'Medicine': 'Academic Stage of Medical Programme',
  'Naval Architecture': 'Naval Architecture and Shipbuilding Engineering',
}

export const DEPARTMENTS = Object.values(ITS_FACULTIES).flat()

/** The department as the committee's list spells it ('' stays '' and unknown free text is kept). */
export const normalizeDepartment = (d: string) => (DEPARTMENTS.includes(d) ? d : (LEGACY[d] ?? d))

export function facultyOf(department: string): string {
  const d = normalizeDepartment(department)
  for (const [f, list] of Object.entries(ITS_FACULTIES)) if (list.includes(d)) return f
  return ''
}
