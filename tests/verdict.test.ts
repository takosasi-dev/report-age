// §9.5 の判定の対応表(AC-10・FR-7・FR-8・INV-4・INV-5)と、CLI の JSON の形の確かめ(FR-5・§9.7・AC-16 の判定)。
import { describe, expect, it } from "vitest";
import { latestJsonName, parseCliJson, readRecord, verdict, type CliResult, type Verdict } from "../src/age";
import { BASE, cli, cliText, item, JSON_NAME, NOTE, skipped, stamped } from "./fixtures";

const NO_FM = readRecord(null);
const STAMPED = readRecord(stamped().frontmatter);
const judge = (c: CliResult, record = STAMPED): Verdict => verdict(c, NOTE, record);
const head = (v: Verdict) => [v.row, v.kind, v.reason];

describe("§9.5 の 12 行", () => {
	it("#1 CLI の結果が無い → 判定なし", () => {
		expect(head(judge({ kind: "none" }))).toEqual([1, "none", "CLI の結果なし"]);
	});
	it("#2 読めない・形が違う → 不明(ファイル名つき)", () => {
		expect(head(judge(parseCliJson("{ \"checked_at\": \"2026-09-2", JSON_NAME, BASE)))).toEqual([2, "unknown", "CLI の結果が読めない: 2026-09-20.json"]);
		expect(head(judge(cli([item({ stale: "false" })])))).toEqual([2, "unknown", "CLI の結果が読めない: 2026-09-20.json"]);
	});
	it("#3 一致する項目が2件以上 → 不明", () => {
		expect(head(judge(cli([item(), item({ stale: false })])))).toEqual([3, "unknown", "CLI の結果が重複"]);
	});
	it("#4 一致する項目が無く、rf_version も無い → 判定なし", () => {
		expect(head(judge(cli([item({ file: "oss/Other/x.md" })]), NO_FM))).toEqual([4, "none", "版の記録なし"]);
	});
	it("#5 一致する項目が無く、rf_version がある → 不明", () => {
		expect(head(judge(cli([item({ file: "oss/Other/x.md" })])))).toEqual([5, "unknown", "CLI の結果に無い。stamp の後に check していない"]);
		expect(judge(cli([]), readRecord({ rf_version: 18 })).row).toBe(5);       // 読めない値でも「ある」
	});
	it("#6 fetch_status が skipped → 判定なし(未スタンプの実物の形)", () => {
		expect(head(judge(cli([skipped("oss/Foo/2026-08-17_Foo_調査.md")]), NO_FM))).toEqual([6, "none", "版の記録なし、または CLI が扱えない種別"]);
		expect(judge(cli([item({ fetch_status: "skipped", stale: false })])).row).toBe(6);
	});
	it("#7 rf_version と surveyed_version が食い違う(片方が読めないときを含む)→ 不明(FR-8)", () => {
		const expected = [7, "unknown", "記録が変わった。check をやり直す"];
		expect(head(judge(cli([item({ surveyed_version: "18.2.0", stale: false })])))).toEqual(expected);
		expect(head(judge(cli([item({ surveyed_version: null, stale: false })])))).toEqual(expected);
		expect(head(judge(cli([item({ stale: false })]), readRecord({ rf_version: 18.3 })))).toEqual(expected);
		expect(head(judge(cli([item({ stale: false })]), NO_FM))).toEqual(expected);
	});
	it("#8 取得できなかった → どれも不明(「不要」にしない)", () => {
		for (const status of ["timeout", "network", "not_found", "http_429", "bad_json", "missing_field"]) {
			const v = judge(cli([item({ fetch_status: status, latest_version: null, diff_kind: null, stale: false })]));
			expect(head(v)).toEqual([8, "unknown", `取得できなかった: ${status}`]);
		}
	});
	it("#9 diff_kind が reversed → 要確認", () => {
		expect(head(judge(cli([item({ diff_kind: "reversed", latest_version: "17.0.0", stale: false })])))).toEqual([9, "check", "調査時の版の方が新しい"]);
	});
	it("#10 diff_kind が unknown か、知らない値 → 不明", () => {
		expect(head(judge(cli([item({ diff_kind: "unknown", stale: false })])))).toEqual([10, "unknown", "版を比べられない: unknown"]);
		expect(head(judge(cli([item({ diff_kind: "prerelease", stale: false })])))).toEqual([10, "unknown", "版を比べられない: prerelease"]);
		expect(head(judge(cli([item({ diff_kind: null, stale: false })])))).toEqual([10, "unknown", "版を比べられない: (無し)"]);
	});
	it("#11 stale が true → 要(offline_prev なら「・前回値」)", () => {
		expect(head(judge(cli([item()])))).toEqual([11, "need", "major・2026-09-20 確認"]);
		expect(head(judge(cli([item({ fetch_status: "offline_prev" })])))).toEqual([11, "need", "major・2026-09-20 確認・前回値"]);
	});
	it("#12 stale が false → 不要", () => {
		expect(head(judge(cli([item({ latest_version: "18.4.0", diff_kind: "minor", stale: false })])))).toEqual([12, "ok", "minor・2026-09-20 確認"]);
		expect(head(judge(cli([item({ latest_version: "18.3.1", diff_kind: "same", stale: false, fetch_status: "offline_prev" })]))))
			.toEqual([12, "ok", "same・2026-09-20 確認・前回値"]);
	});
});

describe("「不要」を出す条件(INV-5)", () => {
	const statuses = ["ok", "offline_prev", "skipped", "timeout", "network", "not_found", "http_429", "bad_json", "missing_field"];
	const kinds = ["same", "patch", "minor", "major", "unknown", "reversed", "other", null];
	it("全部の組み合わせで、「不要」は INV-5 の条件をすべて満たすときだけ", () => {
		let okCount = 0;
		for (const status of statuses) for (const kind of kinds) for (const stale of [true, false]) for (const same of [true, false]) for (const dup of [false, true]) {
			const it = item({ fetch_status: status, diff_kind: kind, stale, surveyed_version: same ? "18.3.1" : "18.0.0" });
			const v = judge(cli(dup ? [it, it] : [it]));
			const allowed = !dup && same && !stale && (status === "ok" || status === "offline_prev")
				&& kind !== null && ["same", "patch", "minor", "major"].includes(kind);
			expect(v.kind === "ok", JSON.stringify({ status, kind, stale, same, dup })).toBe(allowed);
			if (allowed) okCount++;
		}
		expect(okCount).toBe(8);     // 2 つの取得状態 × 4 つの差の種別
	});
	it("版の文字列の大小では決めない: stale が false なら major でも不要、true なら same でも要", () => {
		expect(judge(cli([item({ stale: false })])).kind).toBe("ok");
		expect(judge(cli([item({ diff_kind: "same", latest_version: "18.3.1", stale: true })])).kind).toBe("need");
	});
});

describe("CLI の JSON の形(FR-5・§9.7)", () => {
	it("実物の形(未スタンプの行は diff_kind が null)は読める", () => {
		const c = cli([skipped("oss/A/2026-08-17_A_調査.md"), skipped("oss/README.md"), item()]);
		expect(c.kind === "ok" && [c.fileName, c.checkedOn, c.items.length, c.dropped]).toEqual(["2026-09-20.json", "2026-09-20", 3, 0]);
		expect(c.kind === "ok" && c.items[0]).toEqual({
			path: "reports/oss/A/2026-08-17_A_調査.md", surveyedVersion: null, latestVersion: null,
			diffKind: null, fetchStatus: "skipped", stale: false, newlyStale: false,
		});
	});
	it("JSON として解釈できなければ「読めない」", () => {
		expect(parseCliJson("", JSON_NAME, BASE)).toEqual({ kind: "unreadable", fileName: JSON_NAME, reason: "JSON として解釈できない" });
		expect(parseCliJson(cliText([item()]).slice(0, 120), JSON_NAME, BASE).kind).toBe("unreadable");     // 同期の途中まで
	});
	it("最上位の checked_at・items が無いか型が違えば「形が違う」", () => {
		expect(parseCliJson("[]", JSON_NAME, BASE).kind).toBe("badShape");
		expect(cli([item()], { checked_at: undefined }).kind).toBe("badShape");
		expect(cli([item()], { checked_at: "20 Sep 2026" }).kind).toBe("badShape");
		expect(cli([item()], { checked_at: 20260920 }).kind).toBe("badShape");
		expect(parseCliJson(JSON.stringify({ checked_at: "2026-09-20", items: {} }), JSON_NAME, BASE))
			.toEqual({ kind: "badShape", fileName: JSON_NAME, reason: "形が違う: items が無いか型が違う" });
	});
	it("項目の fetch_status・diff_kind・stale の型が違えば「形が違う」", () => {
		expect(cli([item(), item({ fetch_status: undefined })])).toEqual({ kind: "badShape", fileName: JSON_NAME, reason: "形が違う: 項目 2 の fetch_status が無いか型が違う" });
		expect(cli([item({ diff_kind: undefined })]).kind).toBe("badShape");
		expect(cli([item({ diff_kind: 3 })]).kind).toBe("badShape");
		expect(cli([item({ stale: undefined })]).kind).toBe("badShape");
		expect(cli([item({ stale: 0 })]).kind).toBe("badShape");
	});
	it("file が無い項目は捨てて数える。版は文字列でなければ null、newly_stale は真偽値でなければ出さない", () => {
		const c = cli([item({ file: undefined }), "x", item({ surveyed_version: 18, latest_version: undefined, newly_stale: "yes" })]);
		expect(c.kind === "ok" && [c.items.length, c.dropped]).toEqual([1, 2]);
		expect(c.kind === "ok" && c.items[0]).toMatchObject({ surveyedVersion: null, latestVersion: null, newlyStale: null });
	});
	it("読むのは名前が最も新しい YYYY-MM-DD.json の1本(D-14)", () => {
		expect(latestJsonName(["2026-09-20.json", "2026-09-21.json", "2026-09-03.json"])).toBe("2026-09-21.json");
		expect(latestJsonName(["backup", "x.json", "2026-09-21.json.bak", "2026-9-1.json", "latest.json"])).toBeNull();
		expect(latestJsonName([])).toBeNull();
	});
	it("最新の JSON が壊れていたら不明にし、1つ前の値は出さない(AC-16 の判定)", () => {
		const names = ["2026-09-20.json", "2026-09-21.json"];
		const texts: Record<string, string> = { "2026-09-20.json": cliText([item({ stale: false })]), "2026-09-21.json": "{ こわれた" };
		const name = latestJsonName(names) ?? "";
		const v = judge(parseCliJson(texts[name] ?? "", name, BASE));
		expect(head(v)).toEqual([2, "unknown", "CLI の結果が読めない: 2026-09-21.json"]);
	});
});
