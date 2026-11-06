/*
 * LINKS DA EQUIPE: é só editar este arquivo.
 *
 * Para adicionar um link, copie um bloco de `links` e troque os valores:
 *   name         nome exibido no card (obrigatório)
 *   url          endereço completo, começando com https:// (obrigatório)
 *   category     o `id` de uma das categorias abaixo (obrigatório)
 *   description  frase curta sobre para que serve o link (opcional)
 *   tags         palavras extras que a busca também encontra (opcional)
 *
 * Para criar uma categoria, adicione um item em `categories`.
 * A ordem das listas aqui é a ordem em que tudo aparece no site.
 *
 * ATENÇÃO: só o link do Figma é real. Os demais são exemplos: troque
 * pelos links que a equipe realmente usa.
 */
window.LINKS_DATA = {
  categories: [
    { id: "design", label: "Design" },
    { id: "comunicacao", label: "Comunicação" },
    { id: "documentos", label: "Documentos" },
    { id: "desenvolvimento", label: "Desenvolvimento" },
    { id: "gestao", label: "Gestão" },
  ],

  links: [
    {
      name: "Design system ResolveAI",
      url: "https://www.figma.com/design/myZniw00JNflRgBSlm83dL/Untitled?node-id=0-1",
      category: "design",
      description: "Logo, cores e tipografia oficiais da marca.",
      tags: ["figma", "marca", "logo", "identidade visual"],
    },
    {
      name: "Figma",
      url: "https://www.figma.com/files",
      category: "design",
      description: "Arquivos e protótipos de interface.",
      tags: ["ui", "protótipo"],
    },
    {
      name: "Gmail",
      url: "https://mail.google.com",
      category: "comunicacao",
      description: "E-mail da equipe.",
      tags: ["email", "e-mail"],
    },
    {
      name: "Slack",
      url: "https://slack.com/signin",
      category: "comunicacao",
      description: "Conversas e canais do dia a dia.",
      tags: ["chat", "mensagens"],
    },
    {
      name: "Google Meet",
      url: "https://meet.google.com",
      category: "comunicacao",
      description: "Chamadas de vídeo e reuniões.",
      tags: ["reunião", "vídeo", "call"],
    },
    {
      name: "Google Drive",
      url: "https://drive.google.com",
      category: "documentos",
      description: "Arquivos compartilhados da equipe.",
      tags: ["arquivos", "pastas"],
    },
    {
      name: "Notion",
      url: "https://www.notion.so",
      category: "documentos",
      description: "Base de conhecimento e processos.",
      tags: ["wiki", "processos", "docs"],
    },
    {
      name: "GitHub",
      url: "https://github.com",
      category: "desenvolvimento",
      description: "Repositórios de código e revisões.",
      tags: ["código", "git", "pull request"],
    },
    {
      name: "Google Agenda",
      url: "https://calendar.google.com",
      category: "gestao",
      description: "Calendário e agendamentos da equipe.",
      tags: ["calendário", "agenda"],
    },
    {
      name: "Trello",
      url: "https://trello.com",
      category: "gestao",
      description: "Quadros de tarefas e acompanhamento.",
      tags: ["tarefas", "kanban"],
    },
  ],
};
