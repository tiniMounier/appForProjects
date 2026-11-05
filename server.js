// Allô Calme — petit serveur : sert l'appli web et fait parler les personnages via Claude.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { CHARACTERS, buildSystemPrompt } from "./characters.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, "public");
const PORT = Number(process.env.PORT) || 3000;
const MODEL = "claude-opus-5-5";

const client = new Anthropic();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const rel = urlPath === "/" ? "index.html" : urlPath.slice(1);
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end("Introuvable");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

function readJson(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > limit) reject(new Error("too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

// Garde l'historique propre : alternance user/assistant, texte seulement, taille bornée.
function sanitizeHistory(messages) {
  if (!Array.isArray(messages)) return [];
  const clean = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
    .slice(-30);
  while (clean.length && clean[0].role !== "user") clean.shift();
  return clean;
}

async function handleTalk(req, res) {
  let payload;
  try {
    payload = await readJson(req);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const character = CHARACTERS[payload.character];
  const messages = sanitizeHistory(payload.messages);
  if (!character || !messages.length || messages.at(-1).role !== "user") {
    res.writeHead(400).end();
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 2048,
        // Faible effort = réponses rapides, indispensable pour un appel « en direct ».
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: buildSystemPrompt(character, payload.kids, payload.context),
        messages,
      },
      { signal: abort.signal },
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        send("text", { text: event.delta.text });
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      send("refusal", {});
    }
    send("done", {});
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error("Erreur API:", err?.status ?? "", err?.message ?? err);
      send("error", { message: err instanceof Anthropic.APIError ? `API ${err.status}` : "network" });
    }
  } finally {
    res.end();
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/talk") {
    handleTalk(req, res);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405).end();
});

server.listen(PORT, () => {
  console.log(`Allô Calme est prêt sur http://localhost:${PORT}`);
});
