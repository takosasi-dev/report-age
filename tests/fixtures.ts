// テストの合成データ(D-20)。CLI の JSON はキーと型だけを実物(作者の手元の CLI が check で書く出力)に合わせ、値は架空にしてある。
import { parseCliJson, type CliResult, type NoteInput } from "../src/age";

export const BASE = "reports";                               // 架空の cliFileBase
export const NOTE = "reports/oss/Foo/2026-08-17_Foo_調査.md";  // 架空のレポート
export const JSON_NAME = "2026-09-20.json";

/** CLI の check が1レポートごとに出す形。実物は target・registry・surveyed_on・note も持つ(プラグインは読まない) */
export function item(over: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		file: "oss/Foo/2026-08-17_Foo_調査.md", target: "foo", registry: "npm", surveyed_version: "18.3.1", surveyed_on: "2026-08-17",
		latest_version: "19.1.0", diff_kind: "major", stale: true, fetch_status: "ok", newly_stale: false, ...over,
	};
}

/** 未スタンプの行(実物はこの形: 版と diff_kind が null、fetch_status が skipped) */
export function skipped(file: string): Record<string, unknown> {
	return {
		file, target: null, registry: null, surveyed_version: null, surveyed_on: null,
		latest_version: null, diff_kind: null, stale: false, fetch_status: "skipped", newly_stale: false, note: "未スタンプ",
	};
}

export function cliText(items: unknown[], over: Record<string, unknown> = {}): string {
	return JSON.stringify({
		checked_at: "2026-09-20T10:00:00+09:00", vault: "X:\\vault", items,
		summary: { total: items.length, stamped: 0, stale: 0, unknown: 0, fetch_failed: 0 }, ...over,
	}, null, 2);
}

export function cli(items: unknown[], over: Record<string, unknown> = {}): CliResult {
	return parseCliJson(cliText(items, over), JSON_NAME, BASE);
}

export function note(frontmatter: Record<string, unknown> | null = null, path = NOTE): NoteInput {
	const name = path.split("/").pop() ?? path;
	return { path, basename: name.replace(/\.md$/, ""), frontmatter };
}

/** stamp 済みのノート(CLI の stamp が書く4つのキー) */
export function stamped(over: Record<string, unknown> = {}): NoteInput {
	return note({ rf_target: "foo", rf_registry: "npm", rf_version: "18.3.1", rf_surveyed_on: "2026-08-17", ...over });
}
