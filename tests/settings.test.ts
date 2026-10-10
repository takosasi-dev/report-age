// 設定の読み込みの補い(§9.2): 欠けた項目は既定値、schemaVersion が違えば既定値で動かす。
import { describe, expect, it } from "vitest";
import { cleanList, DEFAULTS, normalizeSettings, parseReviewDays } from "../src/settings";

describe("設定の補い(§9.2)", () => {
	it("data.json が無ければ既定値(既定値の配列は写しで、書き換えても DEFAULTS は変わらない)", () => {
		const { settings, mismatch } = normalizeSettings(null);
		expect([settings, mismatch]).toEqual([DEFAULTS, false]);
		settings.targetFolders.push("x");
		expect(DEFAULTS.targetFolders).not.toContain("x");
	});
	it("欠けた項目・型の違う項目は既定値で埋める", () => {
		const { settings, mismatch } = normalizeSettings({ schemaVersion: 1, targetFolders: ["A\\B/", " "], showBand: false, dateKeys: "作成日", reviewAfterDays: 30 });
		expect(mismatch).toBe(false);
		expect(settings).toEqual({ ...DEFAULTS, targetFolders: ["A/B"], showBand: false, reviewAfterDays: 30 });
	});
	it("schemaVersion が違う・形が違うときは既定値で動かし、呼び手に知らせる", () => {
		expect(normalizeSettings({ schemaVersion: 2, showBand: false })).toEqual({ settings: DEFAULTS, mismatch: true });
		expect(normalizeSettings("x")).toEqual({ settings: DEFAULTS, mismatch: true });
		expect(normalizeSettings([])).toEqual({ settings: DEFAULTS, mismatch: true });
	});
	it("目安の日数は、空なら null、1 以上の整数だけ受ける", () => {
		expect([parseReviewDays(""), parseReviewDays(" 30 "), parseReviewDays("0"), parseReviewDays("1.5"), parseReviewDays("x")])
			.toEqual([null, 30, undefined, undefined, undefined]);
		expect(normalizeSettings({ reviewAfterDays: 0 }).settings.reviewAfterDays).toBeNull();
		expect(normalizeSettings({ reviewAfterDays: "30" }).settings.reviewAfterDays).toBeNull();
	});
	it("1行に1つの並びは、前後の空白と空の行を捨てる", () => {
		expect(cleanList([" a ", "", "b\r", "  "])).toEqual(["a", "b"]);
	});
});
