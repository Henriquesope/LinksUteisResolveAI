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
 */
window.LINKS_DATA = {
  categories: [
    { id: "design", label: "Design" },
    { id: "documentos", label: "Documentos" },
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
      name: "Confluence",
      url: "https://andreiosousa2502.atlassian.net/wiki/spaces/RA/folder/7831553",
      category: "documentos",
      description: "Documentação do projeto ResolveAI.",
      tags: ["atlassian", "wiki", "docs"],
    },
    {
      name: "Jira",
      url: "https://andreiosousa2502.atlassian.net/jira/software/projects/RESOLVEAI/summary",
      category: "gestao",
      description: "Resumo e acompanhamento do projeto ResolveAI.",
      tags: ["atlassian", "tarefas", "tickets", "sprint"],
    },
  ],
};
