# Links da equipe · ResolveAI

Site com os links da equipe, hospedado no Vercel. Qualquer pessoa com o endereço do site pode adicionar, editar e excluir links e seções pelo botão **Editar**, sem login.

## Como funciona

- Os links ficam em [data/links.json](data/links.json), dentro deste repositório. Não há banco de dados.
- A função [api/links.js](api/links.js) roda no Vercel. Ela lê o arquivo pela API do GitHub e, a cada alteração feita no site, grava um commit nele.
- Como cada mudança vira um commit, o histórico do GitHub guarda todas as versões. Se alguém apagar algo por engano, dá para recuperar a versão anterior do arquivo.
- Commits que só mudam `data/links.json` não geram um novo deploy (veja `ignoreCommand` em [vercel.json](vercel.json)). O site lê os dados ao vivo pela API, então não precisa de deploy para mostrar as mudanças.
- Se duas pessoas salvarem ao mesmo tempo, as duas alterações são mantidas.

## Configuração no Vercel (uma vez só)

1. Crie um token no GitHub com permissão de escrita no repositório:
   - **Fine-grained token** (recomendado; precisa ser criado pelo dono do repositório): GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token. Em *Repository access*, escolha só este repositório. Em *Permissions → Contents*, escolha **Read and write**.
   - Ou um **classic token** com o escopo `repo`, criado por alguém com acesso de escrita ao repositório.
2. No Vercel, abra o projeto → Settings → Environment Variables e crie `GITHUB_TOKEN` com o token.
3. Faça um novo deploy (Deployments → ⋯ → Redeploy) para a variável valer.

Variáveis opcionais: `GITHUB_REPO` (`dono/repositorio`; o padrão é o repositório do deploy) e `GITHUB_BRANCH` (padrão `main`).

Sem o token, o site continua no ar, mostra a cópia de `data/links.json` do último deploy e esconde o botão Editar.

## Editar pelo código

Também dá para editar [data/links.json](data/links.json) direto. Como o site grava commits nesse arquivo, rode `git pull` antes de mexer nele.

## Rodar localmente

O site precisa de um servidor (abrir o `index.html` direto não carrega os dados). Use `npx vercel dev` para ter a edição funcionando, ou qualquer servidor estático (por exemplo `npx serve`) para ver só a leitura.

## Atalhos

- `/` foca a busca
- `Esc` limpa a busca
- `Enter` na busca vai para o primeiro resultado

Os links fixados e o tema ficam salvos em cada navegador, sem compartilhamento entre pessoas.

## Design system

Segue o arquivo [Design system ResolveAI](https://www.figma.com/design/myZniw00JNflRgBSlm83dL/Untitled?node-id=0-1): `#1769FF`, `#000000`, `#FFFFFF` e SF Pro Semibold. Os tokens estão no início de [styles.css](styles.css).

A fonte SF Pro só aparece em aparelhos Apple; nos demais, o site usa Inter.

O logo em `index.html` e `assets/favicon.svg` foi redesenhado a partir de uma miniatura do Figma. Substitua pelo SVG oficial quando ele for exportado.
