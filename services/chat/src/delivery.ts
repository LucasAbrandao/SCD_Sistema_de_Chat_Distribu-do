// Persistência é a fronteira de sucesso. Eventos são recuperáveis pelo histórico.
export async function deliver<T extends {message: unknown; created: boolean}>(
  persist: () => Promise<T>, publish: (result: T) => void,
  report: () => void = () => console.error('Evento não publicado; mensagem persistida.')
) {
  const result = await persist();
  if (result.created) { try { publish(result); } catch { report(); } }
  return result.message;
}
