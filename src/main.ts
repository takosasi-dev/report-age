// Report Age の入口。帯のエディタ拡張・コマンド2つ・設定タブを登録し、frontmatter の変化・名前の変更・ノートを開いたときに帯を見直す。
// 帯の文字列が変わるときだけ、登録した配列の StateField を新しい物に差し替えて updateOptions を呼ぶ(D-13・FR-13)。
// 書き込みは saveData() による設定だけ(INV-1)。通信はしない(INV-3)。
import type { Extension } from "@codemirror/state";
import { editorInfoField, MarkdownView, Notice, Plugin, type TFile } from "obsidian";
import { buildReport, formatBand, isTarget, localToday, modalSections, type AgeReport, type CliResult } from "./age";
import { bandExtension, type BandView } from "./band";
import { loadCliResult } from "./cliResults";
import { ReportModal } from "./modal";
import { normalizeSettings, type Settings } from "./settings";
import { ReportAgeSettingTab } from "./settings-tab";
import { readNote } from "./source";
import { S } from "./strings";

export default class ReportAgePlugin extends Plugin {
	settings: Settings = normalizeSettings(null).settings;
	private cli: CliResult = { kind: "none" };
	private locked = false;                                  // data.json を読めなかったら、書き換えない(§9.2)
	private readonly extensions: Extension[] = [];
	private rendered = new Map<string, string | null>();     // パス → いま出している帯の文字列(帯なしは null)

	async onload(): Promise<void> {
		await this.loadSettings();
		this.extensions.push(this.makeBand());
		this.registerEditorExtension(this.extensions);
		this.addCommand({
			id: "show-age",
			name: S.cmdShow,
			checkCallback: (checking) => {
				const file = this.app.workspace.getActiveFile();
				if (!file || !this.reportFor(file)) return false;
				if (!checking) this.openModal(file);
				return true;
			},
		});
		this.addCommand({ id: "reload-cli-results", name: S.cmdReload, callback: () => void this.reloadCli(true) });
		this.addSettingTab(new ReportAgeSettingTab(this.app, this));

		this.registerEvent(this.app.metadataCache.on("changed", () => this.refresh()));
		this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
		// JSON を読む時機は、レイアウトの準備ができたとき・対象ノートを開いたとき・コマンドの3つ(D-16)
		this.registerEvent(this.app.workspace.on("file-open", (file) => {
			if (file && this.reportFor(file)) void this.reloadCli(false);
			else this.refresh();
		}));
		this.app.workspace.onLayoutReady(() => void this.reloadCli(false));
	}

	private async loadSettings(): Promise<void> {
		let raw: unknown = null;
		let broken = false;
		try {
			raw = await this.loadData();
		} catch {
			broken = true;
		}
		const { settings, mismatch } = normalizeSettings(raw);
		this.settings = settings;
		this.locked = broken || mismatch;
		if (this.locked) new Notice(S.noticeSettings);
	}

	async saveSettings(): Promise<void> {
		if (this.locked) new Notice(S.noticeLocked);
		else await this.saveData(this.settings);
		await this.reloadCli(false);
	}

	/** 対象ノートなら判定の材料をまとめて返す。対象外は null(FR-1) */
	private reportFor(file: TFile): AgeReport | null {
		const note = readNote(this.app, file);
		if (!isTarget(note.path, note.frontmatter, this.settings)) return null;
		return buildReport(note, this.settings, this.cli, localToday(new Date()));
	}

	private bandFor(file: TFile): BandView | null {
		const report = this.settings.showBand ? this.reportFor(file) : null;
		return report ? { text: formatBand(report, this.settings.reviewAfterDays), kind: report.verdict.kind } : null;
	}

	private makeBand(): Extension {
		return bandExtension((state) => state.field(editorInfoField, false)?.file ?? null, (file) => {
			const band = this.bandFor(file);
			this.rendered.set(file.path, band?.text ?? null);
			return band;
		}, (file) => this.openModal(file));
	}

	private openModal(file: TFile): void {
		const report = this.reportFor(file);
		if (!report) return;
		new ReportModal(this.app, file.basename, modalSections(report, this.cli, this.settings.reviewAfterDays, localToday(new Date()))).open();
	}

	private async reloadCli(notify: boolean): Promise<void> {
		const cli = await loadCliResult(this.app, this.settings.cliJsonFolder, this.settings.cliFileBase);
		this.cli = cli;
		if (notify) {
			new Notice(cli.kind === "ok" ? S.noticeLoaded(cli.fileName, cli.items.length)
				: cli.kind !== "none" ? S.noticeCliBroken(cli.fileName, cli.reason)
				: this.settings.cliJsonFolder === "" ? S.noticeCliUnset : S.noticeNoCli(this.settings.cliJsonFolder));
		}
		this.refresh();
	}

	/** 開いているノートの帯の文字列が変わるときだけ、全エディタの帯を作り直す。変わらないときは何もしない(FR-13) */
	private refresh(): void {
		const open = new Map<string, string | null>();
		this.app.workspace.iterateAllLeaves((leaf) => {
			const file = leaf.view instanceof MarkdownView ? leaf.view.file : null;
			if (file) open.set(file.path, this.bandFor(file)?.text ?? null);
		});
		if ([...open].every(([path, text]) => this.rendered.get(path) === text)) return;
		this.rendered = open;
		this.extensions[0] = this.makeBand();
		this.app.workspace.updateOptions();
	}
}
