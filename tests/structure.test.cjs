const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const frontend = path.resolve(__dirname, "../frontend");

test("HTML: enlaces, anclas y recursos locales existentes", async () => {
  const archivos = (await fs.readdir(frontend)).filter((f) =>
    f.endsWith(".html"),
  );
  const contenido = new Map(
    await Promise.all(
      archivos.map(async (f) => [
        f,
        await fs.readFile(path.join(frontend, f), "utf8"),
      ]),
    ),
  );
  const errores = [];
  for (const [file, html] of contenido) {
    for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const referencia = m[1].replaceAll("&amp;", "&");
      if (!referencia || /^(?:https?:|data:|mailto:|tel:)/.test(referencia))
        continue;
      const url = new URL(referencia, "http://local/" + file);
      const destino = path.resolve(
        frontend,
        "." + decodeURIComponent(url.pathname),
      );
      if (!destino.startsWith(frontend + path.sep)) {
        errores.push(file + ": ruta fuera del frontend");
        continue;
      }
      try {
        await fs.access(destino);
      } catch {
        errores.push(file + ": " + referencia);
        continue;
      }
      if (url.hash && destino.endsWith(".html")) {
        const objetivo = await fs.readFile(destino, "utf8");
        const id = decodeURIComponent(url.hash.slice(1));
        if (![...objetivo.matchAll(/\bid="([^"]+)"/g)].some((m) => m[1] === id))
          errores.push(file + ": ancla " + referencia);
      }
    }
  }
  assert.deepEqual(errores, []);
});

test("HTML: labels y scripts compatibles con política CSP estricta", async () => {
  for (const file of (await fs.readdir(frontend)).filter((f) =>
    f.endsWith(".html"),
  )) {
    const s = await fs.readFile(path.join(frontend, file), "utf8");
    const ids = new Set([...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    for (const m of s.matchAll(/\bfor="([^"]+)"/g))
      assert.ok(ids.has(m[1]), `${file}: label ${m[1]}`);
    assert.doesNotMatch(
      s,
      /<script\s*>|\son(?:click|submit|input|change)=|javascript:/i,
      file,
    );
  }
});

test("CSS: una sola raíz de variables y preferencias de movimiento respetadas", async () => {
  const entrada = await fs.readFile(
    path.join(frontend, "css/estilos.css"),
    "utf8",
  );
  assert.match(entrada, /Generado por npm run assets/);
  assert.doesNotMatch(entrada, /@import/);
  const imports = [
    "tokens.css",
    "base.css",
    "layout.css",
    "components.css",
    "pages.css",
    "animations.css",
  ];
  const partes = await Promise.all(
    imports.map((file) =>
      fs.readFile(path.join(frontend, "css", file), "utf8"),
    ),
  );
  const postcss = require("../node_modules/postcss");
  assert.doesNotThrow(() => postcss.parse(entrada));
  for (const parte of partes) assert.doesNotThrow(() => postcss.parse(parte));
  const css = partes.join("\n");
  assert.equal([...css.matchAll(/:root\s*\{/g)].length, 1);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /--amarillo-rp:/);
  assert.match(css, /--rojo-rp:/);
});
