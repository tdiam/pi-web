import DOMPurify from "dompurify";
import {
  createBundledHighlighter,
  createSingletonShorthands,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type ThemeMode = "dark" | "light";

type SupportedLanguage = keyof typeof LANGUAGE_LOADERS;
type SupportedTheme = typeof DARK_THEME | typeof LIGHT_THEME;

const LIGHT_THEME = "github-light-default";
const DARK_THEME = "github-dark-default";

const LANGUAGE_LOADERS = {
  bash: () => import("shiki/dist/langs/bash.mjs"),
  css: () => import("shiki/dist/langs/css.mjs"),
  diff: () => import("shiki/dist/langs/diff.mjs"),
  docker: () => import("shiki/dist/langs/docker.mjs"),
  html: () => import("shiki/dist/langs/html.mjs"),
  javascript: () => import("shiki/dist/langs/javascript.mjs"),
  json: () => import("shiki/dist/langs/json.mjs"),
  jsx: () => import("shiki/dist/langs/jsx.mjs"),
  make: () => import("shiki/dist/langs/make.mjs"),
  markdown: () => import("shiki/dist/langs/markdown.mjs"),
  toml: () => import("shiki/dist/langs/toml.mjs"),
  tsx: () => import("shiki/dist/langs/tsx.mjs"),
  typescript: () => import("shiki/dist/langs/typescript.mjs"),
  vue: () => import("shiki/dist/langs/vue.mjs"),
  xml: () => import("shiki/dist/langs/xml.mjs"),
  yaml: () => import("shiki/dist/langs/yaml.mjs"),
} as const;

const THEME_LOADERS = {
  [DARK_THEME]: () => import("shiki/dist/themes/github-dark-default.mjs"),
  [LIGHT_THEME]: () => import("shiki/dist/themes/github-light-default.mjs"),
} as const;

const LANGUAGE_ALIASES: Record<string, SupportedLanguage | "text"> = {
  js: "javascript",
  cjs: "javascript",
  mjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  json: "json",
  html: "html",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  vue: "vue",
  md: "markdown",
  mdx: "markdown",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "bash",
  py: "text",
  rb: "text",
  go: "text",
  rs: "text",
  java: "text",
  kt: "text",
  c: "text",
  h: "text",
  cpp: "text",
  cc: "text",
  cxx: "text",
  hpp: "text",
  cs: "text",
  php: "text",
  sql: "text",
  xml: "xml",
  svg: "xml",
  diff: "diff",
  patch: "diff",
};

const createReadHighlighter = createBundledHighlighter<
  SupportedLanguage,
  SupportedTheme
>({
  langs: LANGUAGE_LOADERS,
  themes: THEME_LOADERS,
  engine: () => createJavaScriptRegexEngine(),
});

const { codeToHtml } = createSingletonShorthands(createReadHighlighter);

export async function highlightCodeHtml(
  code: string,
  path?: string,
  themeMode: ThemeMode = "dark",
): Promise<string> {
  const html = await codeToHtml(code, {
    lang: detectLanguageFromPath(path),
    theme: themeMode === "light" ? LIGHT_THEME : DARK_THEME,
  });
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["pre", "code", "span"],
    ALLOWED_ATTR: ["class", "style"],
  });
}

export function detectLanguageFromPath(
  path?: string,
): SupportedLanguage | "text" {
  if (!path) return "text";
  const cleanPath = path.split(/[?#]/, 1)[0] ?? path;
  const fileName = cleanPath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (fileName === "dockerfile") return "docker";
  if (fileName === "makefile") return "make";
  const extension = fileName.includes(".")
    ? (fileName.split(".").pop() ?? "")
    : "";
  return LANGUAGE_ALIASES[extension] ?? "text";
}

export function readThemeMode(): ThemeMode {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  return shell?.dataset.theme === "light" ? "light" : "dark";
}
