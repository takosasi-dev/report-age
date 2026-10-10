// 本文の先頭に置く1行の帯(FR-9)。CM6 の StateField が block widget の decoration を出すだけで、文書の文字列は変えない(INV-7)。
// 開いているファイルは呼び手が渡す fileOf(中身は editorInfoField の file)で知り、パスが変わったときだけ帯を作り直す。位置は文書の先頭(§8.5 の位置 A)。
// 押すと詳細を開く。エディタには出来事を渡さないので、カーソルは動かない(FR-10)。
import { StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import type { VerdictKind } from "./age";

export interface BandView { text: string; kind: VerdictKind }

class BandWidget extends WidgetType {
	constructor(private readonly band: BandView, private readonly onClick: () => void) {
		super();
	}

	eq(other: BandWidget): boolean {
		return other.band.text === this.band.text && other.band.kind === this.band.kind;
	}

	toDOM(): HTMLElement {
		const el = createDiv({ cls: ["reportage-band", `reportage-${this.band.kind}`], text: this.band.text });
		el.addEventListener("mousedown", (evt) => evt.preventDefault());   // フォーカスとカーソルを動かさない
		el.addEventListener("click", (evt) => {
			evt.preventDefault();
			this.onClick();
		});
		return el;
	}

	ignoreEvent(): boolean {
		return true;
	}
}

interface BandState { path: string | null; deco: DecorationSet }

/** compute が null を返したノート(対象外・帯を切っている)には何も出さない */
export function bandExtension<F extends { path: string }>(fileOf: (state: EditorState) => F | null,
	compute: (file: F) => BandView | null, onClick: (file: F) => void): Extension {
	const build = (state: EditorState): BandState => {
		const file = fileOf(state);
		const band = file ? compute(file) : null;
		if (!file || !band) return { path: file?.path ?? null, deco: Decoration.none };
		const widget = new BandWidget(band, () => onClick(file));
		return { path: file.path, deco: Decoration.set([Decoration.widget({ widget, block: true, side: -1 }).range(0)]) };
	};
	return StateField.define<BandState>({
		create: build,
		// 位置 0 は文字を打っても動かないので、ファイルが変わらない限り前の値をそのまま返す
		update: (value, tr) => ((fileOf(tr.state)?.path ?? null) === value.path ? value : build(tr.state)),
		provide: (field) => EditorView.decorations.from(field, (value) => value.deco),
	});
}
