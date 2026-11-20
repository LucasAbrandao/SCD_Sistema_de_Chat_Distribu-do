import React from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
function App() {
  const [status, setStatus] = React.useState('Verificando serviços…');
  React.useEffect(() => { void Promise.all(['/api/auth/health', '/api/chat/health'].map(async url => { const response = await fetch(url); if (!response.ok) throw new Error(); })).then(() => setStatus('Auth e Chat disponíveis.'), () => setStatus('Serviços indisponíveis. Confira o ambiente.')); }, []);
  return <main><p>Sistemas Distribuídos · CEFET-MG</p><h1>Chat distribuído</h1><h2>Ambiente e contratos</h2><p role="status">{status}</p><p>A base do projeto está preparada. Autenticação, conversas e mensagens serão entregues nos próximos marcos.</p></main>;
}
createRoot(document.getElementById('root')!).render(<App />);
