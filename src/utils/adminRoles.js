export function adminRoleLabel(member) {
  if (!member) return ''
  if (member.role === 'owner') return 'main admin'
  return member.is_faculty ? 'faculty admin' : 'admin'
}

export function adminRoleChipClass(member) {
  if (!member) return 'role-chip'
  if (member.role === 'owner') return 'role-chip role-owner'
  return member.is_faculty ? 'role-chip role-admin-faculty' : 'role-chip role-admin'
}

export function memberSortWeight(member) {
  if (member.role === 'owner') return 0
  if (member.is_faculty) return 1
  return 2
}
