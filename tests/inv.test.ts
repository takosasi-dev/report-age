// src/ を文字で探す受け入れ基準(AC-3〜AC-9・AC-19)と共通の決まり(後読み・console.log)を、grep の代わりに確かめる。
// コメントも含めて探す(仕様書の grep と同じ)。
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const names = readdirSync("src").filter((n) => n.endsWith(".ts"));
const sources = new Map(names.map((n) => [n, readFileSync(`src/${n}`, "utf8")]));
const hits = (pattern: RegExp): string[] => [...sources].filter(([, text]) => pattern.test(text)).map(([name]) => name);

describe("src/ に無いはずの物", () => {
	it("仕様書 §9.8 のファイルがある", () => {
		expect(names).toEqual(expect.arrayContaining(["main.ts", "settings.ts", "strings.ts", "source.ts", "cliResults.ts", "age.ts", "band.ts", "modal.ts"]));
	});
	it.each([
		["AC-3 書き込み系(INV-1)", /vault\.(modify|create|delete|trash|rename|process|append)|processFrontMatter|fileManager|adapter\.(write|append|remove|rename|mkdir|copy)/],
		["AC-4 HTML の差し込み(INV-8)", /innerHTML|outerHTML|insertAdjacentHTML/],
		["AC-5 Node・Electron・通信(INV-2・INV-3)", /require\(|from\s+['"](node:)?(fs|path|electron|child_process)['"]|fetch\(|requestUrl|XMLHttpRequest|WebSocket/],
		["AC-6 ファイルの属性(INV-6)", /\.stat\b|mtime|ctime/],
		["AC-7 d.ts に無い API(INV-10)", /\.cm\b|ts-expect-error|as any|querySelector/],
		["AC-8 文書の書き換え(INV-7)", /replaceRange|replaceSelection|setValue|changes:/],
		["後読みの正規表現", /\(\?<[=!]/],
		["console.log", /console\.log/],
	])("%s が 0 件", (_name, pattern) => {
		expect(hits(pattern)).toEqual([]);
	});
	it("AC-9 ファイルの中身を読むのは cliResults.ts だけ(INV-9)", () => {
		expect(hits(/cachedRead\(|\.read\(/)).toEqual(["cliResults.ts"]);
	});
	it("AC-19 依頼者のフォルダ名は src/ に無い(既定は空。使う人が設定で入れる)", () => {
		expect(hits(/レポート\/調査レポート/)).toEqual([]);
	});
	it("純関数のファイルは obsidian を import しない(D-3)", () => {
		for (const name of ["age.ts", "settings.ts", "strings.ts"]) expect(sources.get(name)).not.toMatch(/from\s+['"]obsidian['"]/);
	});
	it("各ファイルの先頭は責務のコメント", () => {
		for (const [name, text] of sources) expect(text.startsWith("// "), name).toBe(true);
	});
});
