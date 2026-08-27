export function saludoSegunHora(): string {
  const hora = new Date().getHours()
  if (hora < 12) return 'Hola buenos días amigo productor'
  if (hora < 18) return 'Hola buenas tardes amigo productor'
  return 'Hola buenas noches amigo productor'
}
