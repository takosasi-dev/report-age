// age.ts の FR-1〜FR-4 と、帯・モーダルの文字列(AC-2・AC-14 の文字列・AC-22)。Obsidian 無しで動く。
import { describe, expect, it } from "vitest";
import {
	buildReport, daysSince, elapsedText, formatBand, isTarget, modalSections, normPath, parseYmd, pickSurveyDate, readRecord,
	type CliResult, type Ymd,
} from "../src/age";
import { cli, item, note, stamped } from "./fixtures";

const RULE = { targetFolders: ["Foo"], excludeFolders: [], cliJsonFolder: "Foo/_freshness" };
const KEYS = { dateKeys: ["rf_surveyed_on", "作成日"], useFileNameDate: true };
const NO_CLI: CliResult = { kind: "none" };
const ymd = (text: string): Ymd => {
	const d = parseYmd(text);
	if (!d) throw new Error(text);
	return d;
};
const band = (n: ReturnType<typeof note>, today: string, c: CliResult = NO_CLI, review: number | null = null) =>
	formatBand(buildReport(n, KEYS, c, ymd(today)), review);

describe("対象判定(FR-1)", () => {
	it("Foo は Foo/ の配下だけに効き、FooBar/ には効かない", () => {
		expect(isTarget("Foo/a.md", null, RULE)).toBe(true);
		expect(isTarget("Foo/sub/a.md", null, RULE)).toBe(true);
		expect(isTarget("FooBar/a.md", null, RULE)).toBe(false);
		expect(isTarget("Foo.md", null, RULE)).toBe(false);
	});
	it("cliJsonFolder の配下の md は、rf_target があっても対象外(stamp の控え)", () => {
		expect(isTarget("Foo/_freshness/backup/a.md.20260920-100000.md", null, RULE)).toBe(false);
		expect(isTarget("Foo/_freshness/backup/a.md.20260920-100000.md", { rf_target: "foo" }, RULE)).toBe(false);
	});
	it("対象フォルダの外でも rf_target のキーがあれば対象", () => {
		expect(isTarget("Other/a.md", null, RULE)).toBe(false);
		expect(isTarget("Other/a.md", { rf_target: "foo" }, RULE)).toBe(true);
		expect(isTarget("Other/a.md", { rf_target: 1 }, RULE)).toBe(true);
	});
	it("excludeFolders の配下は外れる。md 以外は対象外", () => {
		const rule = { ...RULE, excludeFolders: ["Foo/logs"] };
		expect(isTarget("Foo/logs/2026-08-23.md", null, rule)).toBe(false);
		expect(isTarget("Foo/logsX/2026-08-23.md", null, rule)).toBe(true);
		expect(isTarget("Foo/a.json", null, rule)).toBe(false);
	});
	it("フォルダの指定の \\ と末尾の / は整えてから比べる", () => {
		expect(isTarget("Foo/sub/a.md", null, { ...RULE, targetFolders: ["Foo\\sub/"] })).toBe(true);
		expect(isTarget("a.md", null, { ...RULE, targetFolders: [""] })).toBe(false);
	});
});

describe("調べた日(FR-2)", () => {
	it("dateKeys の順に見て、最初に読めた物を採る", () => {
		const fm = { rf_surveyed_on: "2026-09-01", 作成日: "2026-08-01" };
		const a = pickSurveyDate(fm, "x", ["rf_surveyed_on", "作成日"], true);
		expect([a.date, a.source]).toEqual([{ y: 2026, m: 9, d: 1 }, "rf_surveyed_on"]);
		const b = pickSurveyDate(fm, "x", ["作成日", "rf_surveyed_on"], true);
		expect([b.date, b.source]).toEqual([{ y: 2026, m: 8, d: 1 }, "作成日"]);
	});
	it("実在しない 2026-02-30 は読めないとして飛ばし、次の候補を採る", () => {
		const r = pickSurveyDate({ rf_surveyed_on: "2026-02-30", 作成日: "2026-08-20" }, "x", KEYS.dateKeys, true);
		expect(r.source).toBe("作成日");
		expect(r.candidates.map((c) => [c.source, c.raw, c.state])).toEqual([
			["rf_surveyed_on", "2026-02-30", "bad"], ["作成日", "2026-08-20", "ok"], ["ファイル名", null, "none"],
		]);
	});
	it("数の値は読めないとして飛ばす(文字列に直さない)", () => {
		const r = pickSurveyDate({ rf_surveyed_on: 20260817, 作成日: new Date(0) }, "2026-08-17_x", KEYS.dateKeys, true);
		expect(r.candidates.slice(0, 2).map((c) => [c.raw, c.state])).toEqual([[null, "bad"], [null, "bad"]]);
		expect([r.fromFileName, r.date]).toEqual([true, { y: 2026, m: 8, d: 17 }]);
	});
	it("ファイル名の 2026-08-17_x は採り、2026-08-170 は採らない", () => {
		expect(pickSurveyDate(null, "2026-08-17_x", KEYS.dateKeys, true).date).toEqual({ y: 2026, m: 8, d: 17 });
		expect(pickSurveyDate(null, "2026-08-17", KEYS.dateKeys, true).date).toEqual({ y: 2026, m: 8, d: 17 });
		expect(pickSurveyDate(null, "2026-08-170", KEYS.dateKeys, true).date).toBeNull();
		expect(pickSurveyDate(null, "x_2026-08-17", KEYS.dateKeys, true).date).toBeNull();
		expect(pickSurveyDate(null, "2026-13-01_x", KEYS.dateKeys, true).candidates.pop()?.state).toBe("bad");
	});
	it("useFileNameDate が false ならファイル名を見ない。時刻つきの値は先頭の日付を採る", () => {
		expect(pickSurveyDate(null, "2026-08-17_x", KEYS.dateKeys, false).candidates.map((c) => c.source)).toEqual(KEYS.dateKeys);
		expect(pickSurveyDate({ 作成日: "2026-08-17T09:00:00+09:00" }, "x", ["作成日"], false).date).toEqual({ y: 2026, m: 8, d: 17 });
		expect(pickSurveyDate({ 作成日: "" }, "x", ["作成日"], false).candidates[0]?.state).toBe("none");
	});
});

describe("経過日数(FR-3)", () => {
	it("同じ日は 0 で「今日」、未来は負で「未来の日付」", () => {
		expect(daysSince(ymd("2026-09-26"), ymd("2026-09-26"))).toBe(0);
		expect(elapsedText(0)).toBe("今日");
		expect(daysSince(ymd("2026-09-27"), ymd("2026-09-26"))).toBe(-1);
		expect(elapsedText(-1)).toBe("未来の日付");
		expect(elapsedText(40)).toBe("40日前");
	});
	it("月末と年末をまたぐ差", () => {
		expect(daysSince(ymd("2026-08-17"), ymd("2026-09-26"))).toBe(40);
		expect(daysSince(ymd("2026-01-31"), ymd("2026-03-01"))).toBe(29);
		expect(daysSince(ymd("2025-12-31"), ymd("2026-01-01"))).toBe(1);
	});
	it("2028-02-29 は実在し、2027-02-29 は実在しない", () => {
		expect(parseYmd("2028-02-29")).toEqual({ y: 2028, m: 2, d: 29 });
		expect(daysSince(ymd("2028-02-28"), ymd("2028-03-01"))).toBe(2);
		expect(parseYmd("2027-02-29")).toBeNull();
		expect(parseYmd("2026-00-10")).toBeNull();
	});
});

describe("版の記録(FR-4)と帯(§9.4)", () => {
	it("仕様書 §1 の例: frontmatter 無し・CLI の結果なし", () => {
		expect(band(note(), "2026-09-26")).toBe("調査 2026-08-17(40日前・ファイル名) | 版の記録なし | 再調査: 判定なし(CLI の結果なし)");
	});
	it("rf_version が無ければ「版の記録なし」、文字列でなければ「版の記録が読めない」", () => {
		expect(readRecord({ rf_target: "foo" }).version).toEqual({ state: "none", value: null });
		expect(band(note({ rf_target: "foo" }), "2026-09-26")).toContain(" | 版の記録なし | ");
		expect(readRecord({ rf_version: 18 }).version).toEqual({ state: "bad", value: null });
		expect(band(note({ rf_version: 18 }), "2026-09-26")).toContain(" | 版の記録が読めない | ");
	});
	it("出典: rf_surveyed_on は stamp、その他のキーはキー名(AC-14 の文字列)", () => {
		expect(band(note({ rf_surveyed_on: "2026-09-01" }), "2026-09-26")).toMatch(/^調査 2026-09-01\(25日前・stamp\) \| /);
		expect(band(note({ 作成日: "2026-09-26" }), "2026-09-26")).toMatch(/^調査 2026-09-26\(今日・作成日\) \| /);
		expect(band(note({ 作成日: "2026-10-01" }), "2026-09-26")).toMatch(/^調査 2026-10-01\(未来の日付・作成日\) \| /);
	});
	it("日付も frontmatter も無いノートは「調査日 不明」で帯を出す(§10)", () => {
		expect(band(note(null, "reports/guide/01_はじめに.md"), "2026-09-26")).toBe("調査日 不明 | 版の記録なし | 再調査: 判定なし(CLI の結果なし)");
	});
	it("CLI の結果があれば、版に最新版を足し、判定を写す", () => {
		expect(band(stamped(), "2026-09-26", cli([item()]))).toBe("調査 2026-08-17(40日前・stamp) | 版 18.3.1 → 19.1.0 | 再調査: 要(major・2026-09-20 確認)");
		expect(band(stamped(), "2026-09-26", cli([item({ fetch_status: "timeout", latest_version: null, diff_kind: null, stale: false })])))
			.toBe("調査 2026-08-17(40日前・stamp) | 版 18.3.1 | 再調査: 不明(取得できなかった: timeout)");
		expect(band(stamped(), "2026-09-26")).toContain(" | 版 18.3.1 | ");
	});
	it("目安(FR-12・AC-22): 30 日以上で末尾に足し、判定のラベルは変えない", () => {
		const plain = band(note(), "2026-09-16");
		expect(band(note(), "2026-09-16", NO_CLI, 30)).toBe(plain + " | 目安 30 日超え");
		expect(band(note(), "2026-09-15", NO_CLI, 30)).toBe(band(note(), "2026-09-15"));
		expect(band(note(null, "reports/x.md"), "2026-09-16", NO_CLI, 30)).not.toContain("目安");
		const ok = cli([item({ latest_version: "18.3.2", diff_kind: "patch", stale: false })]);
		expect(band(stamped(), "2026-09-26", ok, 30)).toBe("調査 2026-08-17(40日前・stamp) | 版 18.3.1 → 18.3.2 | 再調査: 不要(patch・2026-09-20 確認) | 目安 30 日超え");
	});
});

describe("詳細モーダルの節(§9.6)", () => {
	const lines = (n: ReturnType<typeof note>, c: CliResult, review: number | null = null) =>
		modalSections(buildReport(n, KEYS, c, ymd("2026-09-26")), c, review, ymd("2026-09-26"));
	it("frontmatter 無し・CLI の結果なし", () => {
		expect(lines(note(), NO_CLI)).toEqual([
			{ heading: "調べた日", lines: ["2026-08-17(40日前・ファイル名)", "rf_surveyed_on = (無し)", "作成日 = (無し)", "ファイル名 = 2026-08-17(読めた)"] },
			{ heading: "版の記録", lines: ["rf_target = (無し)", "rf_registry = (無し)", "rf_version = (無し)", "rf_last_checked = (無し)"] },
			{ heading: "CLI の結果", lines: ["(無し)", "理由: CLI の結果なし"] },
			{ heading: "再調査", lines: ["判定なし(CLI の結果なし)", "当たった行: §9.5 の #1"] },
		]);
	});
	it("stamp 済み・CLI の結果あり・目安あり", () => {
		const got = lines(stamped({ rf_last_checked: 20260920, 作成日: "2026-02-30" }), cli([item({ newly_stale: true })]), 30);
		expect(got.map((s) => s.heading)).toEqual(["調べた日", "版の記録", "CLI の結果", "再調査", "目安"]);
		expect(got[0]?.lines).toEqual(["2026-08-17(40日前・stamp)", "rf_surveyed_on = 2026-08-17(読めた)", "作成日 = 2026-02-30(読めない)", "ファイル名 = 2026-08-17(読めた)"]);
		expect(got[1]?.lines).toEqual(["rf_target = foo", "rf_registry = npm", "rf_version = 18.3.1", "rf_last_checked = (読めない)"]);
		expect(got[2]?.lines).toEqual(["ファイル: 2026-09-20.json", "確認日: 2026-09-20(6日前)",
			"latest_version = 19.1.0", "diff_kind = major", "stale = true", "fetch_status = ok", "newly_stale = true"]);
		expect(got[3]?.lines).toEqual(["要(major・2026-09-20 確認)", "当たった行: §9.5 の #11"]);
		expect(got[4]?.lines).toEqual(["目安 30 日: 超えている(40 日)"]);
	});
	it("読めない JSON は、ファイル名と理由を出す(FR-15)", () => {
		const broken: CliResult = { kind: "unreadable", fileName: "2026-09-21.json", reason: "JSON として解釈できない" };
		expect(lines(note(), broken)[2]?.lines).toEqual(["ファイル: 2026-09-21.json", "理由: JSON として解釈できない"]);
	});
});

describe("パスの整え", () => {
	it("\\ と重なった / と両端の / を整え、NFC にする", () => {
		expect(normPath("a\\b//c/")).toBe("a/b/c");
		expect(normPath("/a/b")).toBe("a/b");
		expect(normPath("ポ".normalize("NFD"))).toBe("ポ".normalize("NFC"));
	});
});
