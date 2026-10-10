// 帯の StateField(band.ts)を、本物の CM6 の EditorState で確かめる(Obsidian は無し。開いているファイルは偽物を渡す)。
// 文書の先頭に block widget が1つ出ること、ファイルが変わったときだけ作り直すこと、文書を変えないこと(INV-7)を見る。
import { EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import { bandExtension, type BandView } from "../src/band";

const BAND: BandView = { text: "調査 2026-08-17(40日前・ファイル名) | 版の記録なし | 再調査: 判定なし(CLI の結果なし)", kind: "none" };
const fake = (path: string) => ({ path });       // band.ts が見るのは path だけ

/** いま出ている decoration を [位置, block か, side] の並びにする */
function decorations(state: EditorState): [number, boolean, number][] {
	const out: [number, boolean, number][] = [];
	for (const source of state.facet(EditorView.decorations)) {
		const set: DecorationSet = typeof source === "function" ? Decoration.none : source;
		const cursor = set.iter();
		while (cursor.value) {
			const spec = cursor.value.spec as { block?: boolean; side?: number };
			out.push([cursor.from, spec.block === true, spec.side ?? 0]);
			cursor.next();
		}
	}
	return out;
}

/** open.file を差し替えると、Obsidian が同じエディタに別のノートを読み込んだのと同じ状態になる */
function setup(path: string | null, compute: (file: { path: string }) => BandView | null) {
	const open = { file: path === null ? null : fake(path) };
	const calls: string[] = [];
	const ext = bandExtension(() => open.file, (file) => {
		calls.push(file.path);
		return compute(file);
	}, () => undefined);
	return { open, calls, state: EditorState.create({ doc: "# 見出し\n本文", extensions: [ext] }) };
}

describe("帯の StateField(FR-9・INV-7)", () => {
	it("対象ノートなら、文書の先頭(位置 0・side -1)に block widget が1つ出る。文書は変わらない", () => {
		const { state } = setup("reports/a.md", () => BAND);
		expect(decorations(state)).toEqual([[0, true, -1]]);
		expect(state.doc.toString()).toBe("# 見出し\n本文");
	});
	it("対象外(compute が null)・ファイルが無いエディタには出ない", () => {
		expect(decorations(setup("daily/2026-08-17.md", () => null).state)).toEqual([]);
		const none = setup(null, () => BAND);
		expect([decorations(none.state), none.calls]).toEqual([[], []]);
	});
	it("文字を打っても作り直さず、帯は先頭のまま。空の文書でも出る", () => {
		const { state, calls } = setup("reports/a.md", () => BAND);
		const typed = state.update({ changes: { from: 0, insert: "先頭に足す\n" } }).state;
		const cleared = typed.update({ changes: { from: 0, to: typed.doc.length } }).state;
		expect([decorations(typed), decorations(cleared), calls]).toEqual([[[0, true, -1]], [[0, true, -1]], ["reports/a.md"]]);
	});
	it("同じペインで別のノートに切り替わったら、そのノートの帯に変える。対象外なら消す(§10)", () => {
		const { open, state, calls } = setup("reports/a.md", (file) => (file.path.startsWith("reports/") ? BAND : null));
		open.file = fake("daily/2026-08-17.md");
		const other = state.update({ changes: { from: 0, to: state.doc.length, insert: "日報" } }).state;
		open.file = fake("reports/b.md");
		const back = other.update({}).state;
		expect([decorations(other), decorations(back), calls]).toEqual([[], [[0, true, -1]], ["reports/a.md", "daily/2026-08-17.md", "reports/b.md"]]);
	});
});
