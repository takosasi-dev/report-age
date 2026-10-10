// ノートから判定の材料を取る。読むのは metadataCache の frontmatter と TFile の path・basename だけ。
// 本文は読まない(INV-9)。更新日時などファイルの属性も読まない(INV-6)。
import type { App, TFile } from "obsidian";
import type { NoteInput } from "./age";

export function readNote(app: App, file: TFile): NoteInput {
	return { path: file.path, basename: file.basename, frontmatter: app.metadataCache.getFileCache(file)?.frontmatter ?? null };
}
