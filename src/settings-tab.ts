// 設定タブ(FR-14・§9.2)。minAppVersion 1.14.4 なので getSettingDefinitions の宣言型(D-4)。
// フォルダとキーの並びは1行に1つで見せ、フォルダは normalizePath を通す。保存は Plugin.saveData() だけ(INV-1)。
import { normalizePath, PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import { cleanList, parseReviewDays } from "./settings";
import { S } from "./strings";
import type ReportAgePlugin from "./main";

export class ReportAgeSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly owner: ReportAgePlugin) {
		super(app, owner);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ type: "group", items: [                    // 最初の組は見出し無し(Plugin guidelines)
				{ name: S.setTargetFolders, desc: S.setTargetFoldersDesc, control: { type: "textarea", key: "targetFolders", rows: 4 } },
				{ name: S.setExcludeFolders, desc: S.setExcludeFoldersDesc, control: { type: "textarea", key: "excludeFolders", rows: 3 } },
				{ name: S.setShowBand, desc: S.setShowBandDesc, control: { type: "toggle", key: "showBand" } },
			] },
			{ type: "group", heading: S.setHeadingDate, items: [
				{ name: S.setDateKeys, desc: S.setDateKeysDesc, control: { type: "textarea", key: "dateKeys", rows: 3 } },
				{ name: S.setUseFileNameDate, desc: S.setUseFileNameDateDesc, control: { type: "toggle", key: "useFileNameDate" } },
				{ name: S.setReviewAfterDays, desc: S.setReviewAfterDaysDesc, control: { type: "text", key: "reviewAfterDays",
					validate: (v: string) => (parseReviewDays(v) === undefined ? S.errReviewAfterDays : undefined) } },
			] },
			{ type: "group", heading: S.setHeadingCli, items: [
				{ name: S.setCliJsonFolder, desc: S.setCliJsonFolderDesc, control: { type: "text", key: "cliJsonFolder" } },
				{ name: S.setCliFileBase, desc: S.setCliFileBaseDesc, control: { type: "text", key: "cliFileBase" } },
			] },
		];
	}

	getControlValue(key: string): unknown {
		const s = this.owner.settings;
		switch (key) {
			case "targetFolders": case "excludeFolders": case "dateKeys": return s[key].join("\n");
			case "reviewAfterDays": return s.reviewAfterDays === null ? "" : String(s.reviewAfterDays);
			case "showBand": case "useFileNameDate": case "cliJsonFolder": case "cliFileBase": return s[key];
			default: return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.owner.settings;
		const text = typeof value === "string" ? value : "";
		switch (key) {
			case "targetFolders": case "excludeFolders": s[key] = cleanList(text.split("\n")).map((x) => normalizePath(x)); break;
			case "dateKeys": s.dateKeys = cleanList(text.split("\n")); break;
			case "showBand": case "useFileNameDate": s[key] = value === true; break;
			case "cliJsonFolder": case "cliFileBase":
				if (text.trim() === "") return;            // 空にはしない(前の値のまま)
				s[key] = normalizePath(text.trim());
				break;
			case "reviewAfterDays": {
				const days = parseReviewDays(text);
				if (days === undefined) return;            // validate で止まる。念のため保存しない
				s.reviewAfterDays = days;
				break;
			}
			default: return;
		}
		await this.owner.saveSettings();
	}
}
