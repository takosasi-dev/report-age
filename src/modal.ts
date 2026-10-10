// 詳細モーダル(FR-10・§9.6)。見出しはノート名。中身は age.ts が作った節を上から並べるだけ。
// 要素は createEl・createDiv で作る(INV-8)。読み取りビューでもコマンドからこれを開いて見る(D-12)。
import { Modal, type App } from "obsidian";
import type { ModalSection } from "./age";

export class ReportModal extends Modal {
	constructor(app: App, private readonly noteName: string, private readonly sections: ModalSection[]) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.noteName);
		this.contentEl.addClass("reportage-modal");
		for (const section of this.sections) {
			this.contentEl.createEl("h4", { text: section.heading });
			for (const line of section.lines) this.contentEl.createDiv({ cls: "reportage-line", text: line });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
