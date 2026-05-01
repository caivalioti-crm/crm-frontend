export function formatDate(date: string | Date) {
  if (!date) return '—';
  if (typeof date === 'string' && date.length === 10) {
    // YYYY-MM-DD format — parse as local date to avoid timezone shift
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('el-GR');
  }
  return new Date(date).toLocaleDateString('el-GR');
}