// CLI 版 ReportFreshness が書いた JSON を読む。cliJsonFolder 直下の YYYY-MM-DD.json のうち名前が最も新しい1本だけ(D-14)。未設定(空)なら読まない。
// 読み方は Vault API の1通り(D-15)。壊れていても前の JSON には戻さない。ファイルの中身を読むのはこのファイルだけ(INV-9)。
import { normalizePath, TFile, type App } from "obsidian";
import { latestJsonName, normPath, parseCliJson, type CliResult } from "./age";
import { S } from "./strings";

export async function loadCliResult(app: App, folder: string, fileBase: string): Promise<CliResult> {
	if (normPath(folder) === "") return { kind: "none" };   // 未設定。normalizePath("") は "/" で、vault の直下を読んでしまう
	const dir = app.vault.getFolderByPath(normalizePath(folder));
	if (!dir) return { kind: "none" };
	const files = dir.children.filter((c): c is TFile => c instanceof TFile);
	const name = latestJsonName(files.map((f) => f.name));
	const file = files.find((f) => f.name === name);
	if (!file) return { kind: "none" };
	let text: string;
	try {
		text = await app.vault.cachedRead(file);
	} catch {
		return { kind: "unreadable", fileName: file.name, reason: S.cliReadFailed };
	}
	return parseCliJson(text, file.name, fileBase);
}
