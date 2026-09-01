export function saludoSegunHora(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días amigo productor'
  if (hora < 18) return 'Buenas tardes amigo productor'
  return 'Buenas noches amigo productor'
}
