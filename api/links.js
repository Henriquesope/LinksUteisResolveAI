/*
 * API dos links: lê e grava data/links.json direto no repositório do GitHub.
 *
 *   GET  /api/links  devolve { categories, links }
 *   POST /api/links  aplica uma alteração e devolve os dados atualizados
 *
 * Cada alteração vira um commit, então o histórico do GitHub guarda todas as
 * versões. Se duas pessoas salvarem ao mesmo tempo, o GitHub recusa a gravação
 * desatualizada (sha diferente) e a alteração é refeita sobre a versão nova.
 *
 * Variáveis de ambiente no Vercel:
 *   GITHUB_TOKEN   obrigatório: token com permissão de escrita no repositório
 *   GITHUB_REPO    opcional: "dono/repositorio" (padrão: o repositório deste deploy)
 *   GITHUB_BRANCH  opcional: padrão "main"
 */
"use strict";

const crypto = require("crypto");

const DATA_PATH = "data/links.json";
const FALLBACK_REPO = "Henriquesope/LinksUteisResolveAI";
const RESERVED_IDS = new Set(["todos", "fixados", "outros"]);
const LIMITS = { name: 80, url: 2000, description: 200, tag: 30, tags: 12, label: 40, links: 500, categories: 40 };

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function config() {
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  return {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO || (owner && slug ? owner + "/" + slug : FALLBACK_REPO),
    branch: process.env.GITHUB_BRANCH || "main",
  };
}

/* ---------- GitHub ---------- */

async function github(cfg, method, body) {
  const query = method === "GET" ? "?ref=" + encodeURIComponent(cfg.branch) : "";
  const response = await fetch("https://api.github.com/repos/" + cfg.repo + "/contents/" + DATA_PATH + query, {
    method,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + cfg.token,
      "User-Agent": "links-resolveai",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

async function readDoc(cfg) {
  const response = await github(cfg, "GET");
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, "O token do GitHub não tem acesso ao repositório. Confira a variável GITHUB_TOKEN no Vercel.");
  }
  if (response.status === 404) {
    throw new HttpError(503, "Arquivo " + DATA_PATH + " não encontrado em " + cfg.repo + " (" + cfg.branch + ").");
  }
  if (!response.ok) throw new HttpError(502, "O GitHub não respondeu (erro " + response.status + "). Tente de novo.");
  const file = await response.json();
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  } catch (e) {
    throw new HttpError(500, DATA_PATH + " não é um JSON válido. Corrija o arquivo no GitHub.");
  }
  return { doc: normalizeDoc(parsed), sha: file.sha };
}

/* Devolve true se gravou, false se outra pessoa salvou antes (sha desatualizado). */
async function writeDoc(cfg, doc, sha, message) {
  const response = await github(cfg, "PUT", {
    message: "Site: " + message,
    content: Buffer.from(JSON.stringify(doc, null, 2) + "\n", "utf8").toString("base64"),
    sha,
    branch: cfg.branch,
  });
  if (response.ok) return true;
  if (response.status === 409) return false;
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(503, "O token do GitHub não pode gravar no repositório. Ele precisa de permissão de escrita em Contents.");
  }
  throw new HttpError(502, "O GitHub recusou a gravação (erro " + response.status + "). Tente de novo.");
}

/* ---------- Validação ---------- */

function text(value, max, field) {
  const clean = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (clean.length > max) throw new HttpError(400, field + " pode ter até " + max + " caracteres.");
  return clean;
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "secao";
}

function hashId(link) {
  return crypto.createHash("sha1").update(String(link.name) + "\n" + String(link.url)).digest("hex").slice(0, 10);
}

function normalizeDoc(raw) {
  const categories = (Array.isArray(raw && raw.categories) ? raw.categories : [])
    .filter((c) => c && c.id && c.label)
    .map((c) => ({ id: String(c.id), label: String(c.label) }));
  const links = (Array.isArray(raw && raw.links) ? raw.links : [])
    .filter((l) => l && l.name && l.url)
    .map((l) => {
      const link = { id: l.id ? String(l.id) : hashId(l), name: String(l.name), url: String(l.url), category: String(l.category || "") };
      if (l.description) link.description = String(l.description);
      if (Array.isArray(l.tags) && l.tags.length) link.tags = l.tags.map(String);
      return link;
    });
  return { categories, links };
}

function validateLink(input, doc, selfId) {
  input = input || {};
  const name = text(input.name, LIMITS.name, "O nome");
  if (!name) throw new HttpError(400, "Informe o nome do link.");

  const url = String(input.url || "").trim();
  let parsed = null;
  try { parsed = new URL(url); } catch (e) { /* inválido */ }
  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:") || url.length > LIMITS.url) {
    throw new HttpError(400, "Informe um endereço válido, começando com https://.");
  }

  const category = String(input.category || "");
  if (!doc.categories.some((c) => c.id === category)) throw new HttpError(400, "Escolha uma seção.");

  const duplicate = doc.links.find((l) => l.url === url && l.id !== selfId);
  if (duplicate) {
    const section = doc.categories.find((c) => c.id === duplicate.category);
    throw new HttpError(400, "Esse endereço já está no site, como “" + duplicate.name + "”" + (section ? " em " + section.label : "") + ".");
  }

  const description = text(input.description, LIMITS.description, "A descrição");
  const rawTags = Array.isArray(input.tags) ? input.tags : String(input.tags || "").split(",");
  const tags = Array.from(new Set(rawTags.map((t) => text(t, 200, "").slice(0, LIMITS.tag)).filter(Boolean))).slice(0, LIMITS.tags);

  const link = { name, url, category };
  if (description) link.description = description;
  if (tags.length) link.tags = tags;
  return link;
}

function validateLabel(value) {
  const label = text(value, LIMITS.label, "O nome da seção");
  if (!label) throw new HttpError(400, "Informe o nome da seção.");
  return label;
}

function findLink(doc, id) {
  const index = doc.links.findIndex((l) => l.id === id);
  if (index === -1) throw new HttpError(404, "Esse link não existe mais. Talvez alguém o tenha excluído.");
  return index;
}

function findCategory(doc, id) {
  const index = doc.categories.findIndex((c) => c.id === id);
  if (index === -1) throw new HttpError(404, "Essa seção não existe mais. Talvez alguém a tenha excluído.");
  return index;
}

/* ---------- Operações ---------- */

function applyOp(doc, body) {
  switch (body.op) {
    case "link.add": {
      if (doc.links.length >= LIMITS.links) throw new HttpError(400, "O site já tem o máximo de " + LIMITS.links + " links.");
      const link = validateLink(body.link, doc, null);
      const id = crypto.randomBytes(5).toString("hex");
      doc.links.push({ id, ...link });
      return { message: "adiciona link “" + link.name + "”", created: id };
    }
    case "link.update": {
      const index = findLink(doc, String(body.id || ""));
      const link = validateLink(body.link, doc, doc.links[index].id);
      doc.links[index] = { id: doc.links[index].id, ...link };
      return { message: "edita link “" + link.name + "”" };
    }
    case "link.delete": {
      const index = findLink(doc, String(body.id || ""));
      const [removed] = doc.links.splice(index, 1);
      return { message: "exclui link “" + removed.name + "”" };
    }
    case "section.add": {
      if (doc.categories.length >= LIMITS.categories) throw new HttpError(400, "O site já tem o máximo de " + LIMITS.categories + " seções.");
      const label = validateLabel(body.label);
      if (doc.categories.some((c) => c.label.toLowerCase() === label.toLowerCase())) {
        throw new HttpError(400, "Já existe uma seção chamada “" + label + "”.");
      }
      const base = slugify(label);
      let id = base;
      for (let n = 2; RESERVED_IDS.has(id) || doc.categories.some((c) => c.id === id); n++) id = base + "-" + n;
      doc.categories.push({ id, label });
      return { message: "adiciona seção “" + label + "”", created: id };
    }
    case "section.update": {
      const index = findCategory(doc, String(body.id || ""));
      const label = validateLabel(body.label);
      if (doc.categories.some((c, i) => i !== index && c.label.toLowerCase() === label.toLowerCase())) {
        throw new HttpError(400, "Já existe uma seção chamada “" + label + "”.");
      }
      const old = doc.categories[index].label;
      doc.categories[index].label = label;
      return { message: "renomeia seção “" + old + "” para “" + label + "”" };
    }
    case "section.delete": {
      const index = findCategory(doc, String(body.id || ""));
      const [removed] = doc.categories.splice(index, 1);
      const before = doc.links.length;
      doc.links = doc.links.filter((l) => l.category !== removed.id);
      const count = before - doc.links.length;
      return { message: "exclui seção “" + removed.label + "”" + (count ? " e " + count + (count === 1 ? " link" : " links") : "") };
    }
    default:
      throw new HttpError(400, "Operação desconhecida.");
  }
}

/* ---------- Handler ---------- */

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch (e) { throw new HttpError(400, "Corpo da requisição inválido."); }
}

module.exports = async function handler(req, res) {
  const cfg = config();
  try {
    if (!cfg.token) throw new HttpError(503, "A edição não está configurada: falta a variável GITHUB_TOKEN no Vercel.");

    if (req.method === "GET") {
      const { doc } = await readDoc(cfg);
      return send(res, 200, doc);
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      for (let attempt = 0; attempt < 4; attempt++) {
        const { doc, sha } = await readDoc(cfg);
        const result = applyOp(doc, body);
        if (await writeDoc(cfg, doc, sha, result.message)) {
          return send(res, 200, { ...doc, created: result.created });
        }
      }
      throw new HttpError(409, "Muita gente editando ao mesmo tempo. Tente de novo em alguns segundos.");
    }

    res.setHeader("Allow", "GET, POST");
    throw new HttpError(405, "Método não permitido.");
  } catch (error) {
    if (!(error instanceof HttpError)) console.error(error);
    send(res, error.status || 500, { error: error instanceof HttpError ? error.message : "Erro inesperado no servidor." });
  }
};

module.exports.applyOp = applyOp;
module.exports.normalizeDoc = normalizeDoc;
