# 🏥 Way For System — Anotações Médicas

Sistema web completo para profissionais de saúde gerenciarem anotações médicas, comunicação entre médicos, busca inteligente de CID-10 e perfil profissional. Desenvolvido com foco em praticidade, segurança e usabilidade.

🔗 **Acesse o sistema online:** [https://notemed.onrender.com/index.html]

---

## 📸 Telas do Sistema

| Tela | Descrição |
|:----:|:----------|
| ![Login] | Login — Autenticação segura com e-mail e senha |
| ![Cadastro]| Cadastro — Registro de novos profissionais com especialidade e CRM |
| ![Dashboard]| Anotações — Listagem, busca, favoritos e ações (visualizar, editar, excluir) |
| ![Perfil] | Perfil — Dados do profissional, estatísticas e edição de informações |
| ![Chat] | Chat Médico — Comunicação entre médicos cadastrados no sistema |
| ![CID-10] | Busca CID-10 — Busca inteligente por sintomas, doenças ou códigos CID |
| ![Nova Anotação] | Editor de Anotações — Editor rico com formatação de texto |

---

## ✨ Funcionalidades

### 📋 Gestão de Anotações Médicas
- ✅ Criar, visualizar, editar e excluir anotações
- ✅ Sistema de **favoritos** (destaque em amarelo)
- ✅ **Busca inteligente** por título ou conteúdo
- ✅ **Editor de texto rico** com formatação (negrito, itálico, listas, links, cores)
- ✅ Marcação de anotações como "Nota" ou "Favorita"

### 👤 Perfil do Profissional
- ✅ Cadastro com **nome, especialidade e CRM/Registro Profissional**
- ✅ Foto de perfil
- ✅ Estatísticas: total de anotações, favoritas e ID do usuário
- ✅ Edição de informações pessoais

### 💬 Chat Médico
- ✅ Busca de médicos por **CRM, nome, e-mail ou ID**
- ✅ Lista de conversas com histórico
- ✅ Contador de médicos cadastrados no sistema

### 🔍 Busca Inteligente CID-10
- ✅ Busca por **sintomas, nome da doença ou código CID**
- ✅ Sugestões de diagnósticos mais prováveis
- ✅ **Sintomas comuns** em botões rápidos (dor de cabeça, febre, tosse, etc.)
- ✅ **CIDs mais consultados** para acesso rápido

### 🔐 Segurança
- ✅ Autenticação de usuários
- ✅ Recuperação de senha por e-mail
- ✅ Sessões seguras

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|------------|
| **Backend** | Python — Flask |
| **Banco de Dados** | PostgreSQL (Supabase) |
| **Deploy** | Render |
| **Servidor WSGI** | Gunicorn |
| **Frontend** | HTML, CSS, JavaScript |
| **Editor de Texto** | Editor rico integrado (toolbar de formatação) |
| **Ferramentas de IA** | Kimi, DeepSeek, ChatGPT (auxílio no desenvolvimento) |

---

Aprendizados
Durante o desenvolvimento deste projeto, aprofundei conhecimentos em:
Arquitetura de aplicações web com Flask
Integração Flask + PostgreSQL (Supabase)
Deploy de aplicações em produção com Render
Sistema de autenticação e recuperação de senha
Implementação de editor de texto rico
Busca inteligente e sugestão de dados médicos (CID-10)
Sistema de chat em tempo real
Uso de IA como ferramenta produtiva no desenvolvimento
Resolução de problemas de UI/UX (ex: sobreposição de ícones em formulários)

📝 Licença
Este projeto foi desenvolvido para fins de aprendizado e portfólio.

👤 Autor
Emerson Hugo Venceslau
https://www.linkedin.com/in/emerson-venceslau-9587bb2b7/
https://github.com/K4ts0

# 6. Execute a aplicação
python app.py
