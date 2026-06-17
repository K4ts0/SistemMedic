// URL base da API (ajuste se necessário)
const API_URL = 'http://localhost:5000/api';

// Armazena o token e dados do usuário
let authToken = localStorage.getItem('token');
let currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

// Função para definir autenticação
function setAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// Limpar autenticação
function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Requisição autenticada
async function fetchAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });
  if (response.status === 401) {
    // Token inválido ou expirado
    clearAuth();
    window.location.href = 'index.html';
    return null;
  }
  return response;
}

// Exibir mensagem de erro/sucesso
function showMessage(elementId, message, type = 'erro') {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `mensagem ${type}`;
  el.style.display = 'block';
  // Esconde após 5 segundos
  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}