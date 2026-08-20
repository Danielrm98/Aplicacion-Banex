export function getIsoWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T00:00:00')
  const day = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDay = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000))
}
