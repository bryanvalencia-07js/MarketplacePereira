/* Assets locales reproducibles; no se sirve node_modules ni se requiere build al arrancar. */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../frontend");
const postcss = require("postcss");
const modules = [
  "tokens",
  "base",
  "layout",
  "components",
  "pages",
  "animations",
];
const css = postcss.parse(
  modules
    .map((name) =>
      fs.readFileSync(path.join(root, "css", name + ".css"), "utf8"),
    )
    .join("\n"),
);
css.walkComments((node) => node.remove());
css.walk((node) => {
  node.raws.before = "";
  if (node.type === "decl") {
    node.raws.between = ":";
    node.raws.important = "!important";
  }
  if (node.type === "rule" || node.type === "atrule") {
    node.raws.between = node.type === "atrule" ? " " : "";
    node.raws.after = "";
    node.raws.semicolon = false;
  }
});
fs.writeFileSync(
  path.join(root, "css/estilos.css"),
  "/* Generado por npm run assets; editar los seis módulos CSS. */\n" +
    css.toString().trim() +
    "\n",
);
const fonts = path.join(root, "assets/fonts");
fs.mkdirSync(fonts, { recursive: true });
for (const [pkg, file, output] of [
  ["inter", "inter-latin-wght-normal.woff2", "inter.woff2"],
  [
    "playfair-display",
    "playfair-display-latin-wght-normal.woff2",
    "playfair-display.woff2",
  ],
]) {
  const source = path.join(root, "../node_modules/@fontsource-variable", pkg);
  fs.copyFileSync(path.join(source, "files", file), path.join(fonts, output));
  fs.copyFileSync(
    path.join(source, "LICENSE"),
    path.join(fonts, pkg + "-LICENSE"),
  );
}
const icons = [
  "search",
  "user-round",
  "shopping-bag",
  "pencil",
  "trash-2",
  "arrow-left",
  "log-out",
  "sliders-horizontal",
  "layout-dashboard",
  "menu",
  "x",
  "check",
  "circle-check",
  "eye",
  "store",
  "package",
  "arrow-right",
  "chevron-left",
  "chevron-right",
];
const lucide = path.join(root, "../node_modules/lucide-static");
const sprite = icons
  .map((name) => {
    const svg = fs.readFileSync(
      path.join(lucide, "icons", name + ".svg"),
      "utf8",
    );
    return `<symbol id="${name}" viewBox="0 0 24 24">${svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)[1]}</symbol>`;
  })
  .join("\n");
fs.writeFileSync(
  path.join(root, "assets/icons/lucide.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg">\n${sprite}\n</svg>\n`,
);
const vendor = path.join(root, "js/vendor");
fs.mkdirSync(vendor, { recursive: true });
for (const name of ["gsap.min.js", "ScrollTrigger.min.js"]) {
  const source = fs.readFileSync(
    path.join(root, "../node_modules/gsap/dist", name),
    "utf8",
  );
  fs.writeFileSync(
    path.join(vendor, name),
    source.replace(/\/\/# sourceMappingURL=.*$/gm, ""),
  );
}
fs.copyFileSync(
  path.join(lucide, "LICENSE"),
  path.join(root, "assets/icons/LUCIDE-LICENSE"),
);
fs.writeFileSync(
  path.join(vendor, "GSAP-LICENSE"),
  "GSAP 3.15.1 — Copyright 2026 GreenSock. All rights reserved.\nSubject to https://gsap.com/standard-license\nDistribution files retain the original license header.\n",
);
console.log(
  "CSS empaquetado, fuentes, sprite Lucide y GSAP/ScrollTrigger preparados localmente.",
);
