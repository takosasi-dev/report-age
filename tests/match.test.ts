// 項目の対応(FR-6・AC-11): cliFileBase + "/" + file を整えた物が、ノートのパス(NFC)と一致するか。
import { describe, expect, it } from "vitest";
import { matchItems, parseCliJson, readRecord, verdict } from "../src/age";
import { BASE, cli, cliText, item, JSON_NAME, NOTE, stamped } from "./fixtures";

const itemsOf = (c: ReturnType<typeof cli>) => (c.kind === "ok" ? c.items : []);

describe("項目の対応(FR-6)", () => {
	it("\\ 区切りの file も一致する", () => {
		const c = cli([item({ file: "oss\\Foo\\2026-08-17_Foo_調査.md" })]);
		expect(matchItems(itemsOf(c), NOTE)).toHaveLength(1);
		expect(itemsOf(c)[0]?.path).toBe(NOTE);
	});
	it("NFD のノート名(iPhone 由来)も、NFC の file と一致する。逆も同じ", () => {
		const nfc = `${BASE}/oss/ポップ/2026-08-17_ポップ_調査.md`.normalize("NFC");
		const nfd = nfc.normalize("NFD");
		expect(nfd).not.toBe(nfc);
		const file = "oss/ポップ/2026-08-17_ポップ_調査.md";
		expect(matchItems(itemsOf(cli([item({ file: file.normalize("NFC") })])), nfd)).toHaveLength(1);
		expect(matchItems(itemsOf(cli([item({ file: file.normalize("NFD") })])), nfc)).toHaveLength(1);
	});
	it("基準フォルダの末尾の / と、file の先頭の / は整える", () => {
		expect(matchItems(itemsOf(cli([item({ file: "/oss/Foo/2026-08-17_Foo_調査.md" })])), NOTE)).toHaveLength(1);
	});
	it("基準フォルダが空なら、file を vault からの相対パスとして読む", () => {
		const c = parseCliJson(cliText([item({ file: NOTE })]), JSON_NAME, "");
		expect(matchItems(itemsOf(c), NOTE)).toHaveLength(1);
	});
	it("ほかのノートの項目・前方だけ同じパスは一致しない", () => {
		const c = cli([item({ file: "oss/Foo/2026-08-17_Foo_調査.md.bak" }), item({ file: "oss/FooBar/2026-08-17_Foo_調査.md" })]);
		expect(matchItems(itemsOf(c), NOTE)).toHaveLength(0);
	});
	it("同じパスの項目が2件あると「不明(CLI の結果が重複)」", () => {
		const c = cli([item({ stale: false }), item({ file: "oss\\Foo\\2026-08-17_Foo_調査.md", stale: false })]);
		const v = verdict(c, NOTE, readRecord(stamped().frontmatter));
		expect([v.kind, v.reason, v.row, v.matches, v.item]).toEqual(["unknown", "CLI の結果が重複", 3, 2, null]);
	});
	it("リネームしたノートは、次の check まで #5(§10)", () => {
		const v = verdict(cli([item()]), "reports/oss/Foo/2026-08-17_Foo2_調査.md", readRecord(stamped().frontmatter));
		expect(v.row).toBe(5);
	});
});
