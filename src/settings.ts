// 設定の型・既定値(§9.2。vault に固有のフォルダは既定では空 = 未設定で、使う人が設定で入れる)・読み込みの補い。obsidian を import しない(テストで読む)。
// 欠けた項目は既定値で埋め、schemaVersion が違えば既定値で動かす(呼び手が Notice を出し、data.json は書き換えない)。
import { normPath } from "./age";

export interface Settings {
	schemaVersion: 1;
	targetFolders: string[];
	excludeFolders: string[];
	dateKeys: string[];
	useFileNameDate: boolean;
	cliJsonFolder: string;
	cliFileBase: string;
	reviewAfterDays: number | null;
	showBand: boolean;
}

export const DEFAULTS: Settings = {
	schemaVersion: 1,
	// 依頼者の決定(2026-10-10): フォルダの3つは空 = 未設定(§9.2 の既定値とは違う。元の値は NOTES.md)
	targetFolders: [],                             // 空のあいだは、rf_target のあるノートだけが対象
	excludeFolders: [],
	dateKeys: ["rf_surveyed_on", "作成日"],          // D-9 の既定(Q-11)
	useFileNameDate: true,
	cliJsonFolder: "",                             // 空のあいだは、CLI の結果を読まない
	cliFileBase: "",                               // 空なら、file を vault からの相対パスとして読む
	reviewAfterDays: null,                         // D-18: 既定は空(出さない)
	showBand: true,
};

/** 1行に1つの文字列の並びを整える(前後の空白を取り、空の行を捨てる) */
export function cleanList(lines: string[]): string[] {
	return lines.map((x) => x.trim()).filter((x) => x !== "");
}

/** 空は null、1 以上の整数はその数、それ以外は undefined(受け付けない) */
export function parseReviewDays(text: string): number | null | undefined {
	const t = text.trim();
	if (t === "") return null;
	return /^[1-9]\d*$/.test(t) ? Number(t) : undefined;
}

/** data.json の中身を Settings にする。schemaVersion が違えば既定値(mismatch=true) */
export function normalizeSettings(raw: unknown): { settings: Settings; mismatch: boolean } {
	const base: Settings = { ...DEFAULTS, targetFolders: [...DEFAULTS.targetFolders], excludeFolders: [...DEFAULTS.excludeFolders], dateKeys: [...DEFAULTS.dateKeys] };
	if (raw === null || raw === undefined) return { settings: base, mismatch: false };
	if (typeof raw !== "object" || Array.isArray(raw)) return { settings: base, mismatch: true };
	const r = raw as Record<string, unknown>;
	if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return { settings: base, mismatch: true };
	const list = (v: unknown, fallback: string[]) =>
		(Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? cleanList(v) : fallback);
	const folder = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() !== "" ? normPath(v.trim()) : fallback);
	const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
	const days = r.reviewAfterDays;
	return {
		settings: {
			schemaVersion: 1,
			targetFolders: list(r.targetFolders, base.targetFolders).map(normPath),
			excludeFolders: list(r.excludeFolders, base.excludeFolders).map(normPath),
			dateKeys: list(r.dateKeys, base.dateKeys),
			useFileNameDate: bool(r.useFileNameDate, base.useFileNameDate),
			cliJsonFolder: folder(r.cliJsonFolder, base.cliJsonFolder),
			cliFileBase: folder(r.cliFileBase, base.cliFileBase),
			reviewAfterDays: typeof days === "number" && Number.isInteger(days) && days >= 1 ? days : null,
			showBand: bool(r.showBand, base.showBand),
		},
		mismatch: false,
	};
}
