// 純関数だけ(obsidian を import しない)。対象判定・調べた日・経過日数・版の記録・CLI の JSON の形の確かめ・項目の対応・
// 再調査の判定・帯とモーダルの文字列を作る。判定は §9.5 の表を上から写すだけで、版の大小は比べない(INV-4)。
// 日付は年・月・日の数で扱い、文字列を Date に解析させない(D-10)。
import { S } from "./strings";

export interface Ymd { y: number; m: number; d: number }
export type FieldState = "none" | "ok" | "bad";
export interface Field { state: FieldState; value: string | null }
export type Frontmatter = Record<string, unknown> | null;
export interface NoteInput { path: string; basename: string; frontmatter: Frontmatter }

// ---- パスと日付 ----

const NB_SPACES = new RegExp(`[${String.fromCharCode(0xa0, 0x202f)}]`, "g");   // 改行しない空白の2種

/** Obsidian の normalizePath と同じ向きの整え(\ を / に・重なった / を1つに・両端の / を取る・NFC)。テストで使えるよう純関数で持つ */
export function normPath(path: string): string {
	return path.replace(NB_SPACES, " ").replace(/[\\/]+/g, "/").replace(/^\/|\/$/g, "").normalize("NFC");
}

const DATE_HEAD = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/;

/** 先頭が YYYY-MM-DD(直後が数字でない)で、実在する日付なら返す */
export function parseYmd(text: string): Ymd | null {
	const hit = DATE_HEAD.exec(text);
	if (!hit) return null;
	const y = Number(hit[1]), m = Number(hit[2]), d = Number(hit[3]);
	const t = new Date(Date.UTC(y, m - 1, d));
	return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { y, m, d } : null;
}

export function ymdText(date: Ymd): string {
	const pad = (n: number, width: number) => String(n).padStart(width, "0");
	return `${pad(date.y, 4)}-${pad(date.m, 2)}-${pad(date.d, 2)}`;
}

/** 端末のローカルの今日(FR-3) */
export function localToday(now: Date): Ymd {
	return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** today − date の日数。時刻は使わない(FR-3) */
export function daysSince(date: Ymd, today: Ymd): number {
	return Math.round((Date.UTC(today.y, today.m - 1, today.d) - Date.UTC(date.y, date.m - 1, date.d)) / 86_400_000);
}

export function elapsedText(days: number): string {
	return days === 0 ? S.today : days < 0 ? S.future : S.daysAgo(days);
}

// ---- 対象判定(FR-1) ----

export interface TargetRule { targetFolders: string[]; excludeFolders: string[]; cliJsonFolder: string }

/** フォルダ Foo は Foo/ の配下だけに効き、FooBar/ には効かない */
function under(path: string, folder: string): boolean {
	const f = normPath(folder);
	return f !== "" && path.startsWith(f + "/");
}

export function isTarget(path: string, frontmatter: Frontmatter, rule: TargetRule): boolean {
	const p = normPath(path);
	if (!p.toLowerCase().endsWith(".md")) return false;
	if (under(p, rule.cliJsonFolder) || rule.excludeFolders.some((f) => under(p, f))) return false;
	return (frontmatter !== null && "rf_target" in frontmatter) || rule.targetFolders.some((f) => under(p, f));
}

// ---- 調べた日(FR-2)と版の記録(FR-4) ----

/** 無い(undefined・null・空)/ 文字列 / それ以外(読めない。文字列に直さない) */
export function readField(value: unknown): Field {
	if (value === undefined || value === null) return { state: "none", value: null };
	if (typeof value !== "string") return { state: "bad", value: null };
	return value.trim() === "" ? { state: "none", value: null } : { state: "ok", value };
}

export interface DateCandidate { source: string; fromFileName: boolean; raw: string | null; state: FieldState }
export interface SurveyDate { date: Ymd | null; source: string | null; fromFileName: boolean; candidates: DateCandidate[] }

/** dateKeys の順 → ファイル名の先頭 の順で、最初に読めた日付を採る。見た候補は全部残す */
export function pickSurveyDate(frontmatter: Frontmatter, basename: string, dateKeys: string[], useFileNameDate: boolean): SurveyDate {
	const out: SurveyDate = { date: null, source: null, fromFileName: false, candidates: [] };
	const add = (source: string, fromFileName: boolean, field: Field) => {
		const date = field.value === null ? null : parseYmd(field.value);
		const state: FieldState = field.state === "ok" && !date ? "bad" : field.state;
		out.candidates.push({ source, fromFileName, raw: field.value, state });
		if (date && !out.date) Object.assign(out, { date, source, fromFileName });
	};
	for (const key of dateKeys) add(key, false, readField(frontmatter?.[key]));
	if (useFileNameDate) add(S.srcFileName, true, readField(DATE_HEAD.exec(basename)?.[0]));
	return out;
}

export interface RfRecord { target: Field; registry: Field; version: Field; lastChecked: Field }

export function readRecord(frontmatter: Frontmatter): RfRecord {
	return {
		target: readField(frontmatter?.rf_target),
		registry: readField(frontmatter?.rf_registry),
		version: readField(frontmatter?.rf_version),
		lastChecked: readField(frontmatter?.rf_last_checked),
	};
}

// ---- CLI の結果(FR-5・§9.7) ----

export interface CliItem {
	path: string;                    // cliFileBase + "/" + file を整えた物(vault からの相対)
	surveyedVersion: string | null;
	latestVersion: string | null;
	diffKind: string | null;         // 実物の JSON は、比べていない行(skipped・取得失敗)で null を出す
	fetchStatus: string;
	stale: boolean;
	newlyStale: boolean | null;      // 真偽値でなければ表示しない
}

export type CliResult =
	| { kind: "none" }                                              // フォルダか YYYY-MM-DD.json が無い
	| { kind: "unreadable"; fileName: string; reason: string }      // JSON として解釈できない
	| { kind: "badShape"; fileName: string; reason: string }        // §9.7 の形と違う
	| { kind: "ok"; fileName: string; checkedOn: string; items: CliItem[]; dropped: number };

const JSON_NAME = /^\d{4}-\d{2}-\d{2}\.json$/;

/** 名前が YYYY-MM-DD.json の物のうち、名前が最も新しい1本(D-14)。更新日時は見ない */
export function latestJsonName(names: string[]): string | null {
	return names.filter((n) => JSON_NAME.test(n)).sort().pop() ?? null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);

export function parseCliJson(text: string, fileName: string, fileBase: string): CliResult {
	let doc: unknown;
	try {
		doc = JSON.parse(text);
	} catch {
		return { kind: "unreadable", fileName, reason: S.cliNotJson };
	}
	const bad = (reason: string): CliResult => ({ kind: "badShape", fileName, reason });
	if (!isRecord(doc)) return bad(S.cliNotObject);
	const checkedAt = doc.checked_at;
	if (typeof checkedAt !== "string" || !parseYmd(checkedAt)) return bad(S.cliBadKey("checked_at"));
	if (!Array.isArray(doc.items)) return bad(S.cliBadKey("items"));
	const items: CliItem[] = [];
	let dropped = 0;
	for (const [i, it] of (doc.items as unknown[]).entries()) {
		if (!isRecord(it) || typeof it.file !== "string") {
			dropped++;
			continue;
		}
		if (typeof it.fetch_status !== "string") return bad(S.cliBadItem(i + 1, "fetch_status"));
		if (it.diff_kind !== null && typeof it.diff_kind !== "string") return bad(S.cliBadItem(i + 1, "diff_kind"));
		if (typeof it.stale !== "boolean") return bad(S.cliBadItem(i + 1, "stale"));
		items.push({
			path: normPath(fileBase + "/" + it.file),
			surveyedVersion: strOrNull(it.surveyed_version),
			latestVersion: strOrNull(it.latest_version),
			diffKind: it.diff_kind,
			fetchStatus: it.fetch_status,
			stale: it.stale,
			newlyStale: typeof it.newly_stale === "boolean" ? it.newly_stale : null,
		});
	}
	return { kind: "ok", fileName, checkedOn: checkedAt.slice(0, 10), items, dropped };
}

/** ノートのパス(NFC)と一致する項目(FR-6) */
export function matchItems(items: CliItem[], notePath: string): CliItem[] {
	const p = normPath(notePath);
	return items.filter((it) => it.path === p);
}

// ---- 再調査の判定(FR-7・FR-8・§9.5) ----

export type VerdictKind = "need" | "ok" | "check" | "unknown" | "none";
export interface Verdict { kind: VerdictKind; reason: string; row: number; matches: number; item: CliItem | null }

const USABLE_STATUS = ["ok", "offline_prev"];
const COMPARED_KINDS = ["same", "patch", "minor", "major"];   // 既知の6つから unknown と reversed を除いた物

/** §9.5 の表を上から順に見て、最初に当たった行を返す */
export function verdict(cli: CliResult, notePath: string, record: RfRecord): Verdict {
	if (cli.kind === "none") return { kind: "none", row: 1, reason: S.reasonNoCli, matches: 0, item: null };
	if (cli.kind !== "ok") return { kind: "unknown", row: 2, reason: S.reasonCliBroken(cli.fileName), matches: 0, item: null };
	const hits = matchItems(cli.items, notePath);
	const item = hits[0];
	if (hits.length >= 2) return { kind: "unknown", row: 3, reason: S.reasonDuplicate, matches: hits.length, item: null };
	if (!item) {
		return record.version.state === "none"
			? { kind: "none", row: 4, reason: S.reasonNoVersion, matches: 0, item: null }
			: { kind: "unknown", row: 5, reason: S.reasonNotInCli, matches: 0, item: null };
	}
	const hit = (kind: VerdictKind, row: number, reason: string): Verdict => ({ kind, row, reason, matches: 1, item });
	if (item.fetchStatus === "skipped") return hit("none", 6, S.reasonSkipped);
	// FR-8: ノートの rf_version と項目の surveyed_version が、両方読めて同じ文字列のときだけ先へ進む
	if (record.version.state !== "ok" || item.surveyedVersion === null || record.version.value !== item.surveyedVersion) {
		return hit("unknown", 7, S.reasonChanged);
	}
	if (!USABLE_STATUS.includes(item.fetchStatus)) return hit("unknown", 8, S.reasonNotFetched(item.fetchStatus));
	if (item.diffKind === "reversed") return hit("check", 9, S.reasonReversed);
	if (item.diffKind === null || !COMPARED_KINDS.includes(item.diffKind)) return hit("unknown", 10, S.reasonDiff(item.diffKind ?? S.none));
	const detail = S.reasonChecked(item.diffKind, cli.checkedOn, item.fetchStatus === "offline_prev");
	return item.stale ? hit("need", 11, detail) : hit("ok", 12, detail);
}

// ---- 帯(§9.4)とモーダル(§9.6)の文字列 ----

export interface AgeReport {
	survey: SurveyDate;
	days: number | null;             // 調べた日が無ければ null
	record: RfRecord;
	verdict: Verdict;
}

export interface ReportRule { dateKeys: string[]; useFileNameDate: boolean }

export function buildReport(note: NoteInput, rule: ReportRule, cli: CliResult, today: Ymd): AgeReport {
	const survey = pickSurveyDate(note.frontmatter, note.basename, rule.dateKeys, rule.useFileNameDate);
	const record = readRecord(note.frontmatter);
	return { survey, days: survey.date ? daysSince(survey.date, today) : null, record, verdict: verdict(cli, note.path, record) };
}

function sourceText(survey: SurveyDate): string {
	return survey.fromFileName ? S.srcFileName : survey.source === "rf_surveyed_on" ? S.srcStamp : survey.source ?? "";
}

/** JSON の最新版が使えるのは、項目が1件だけ一致して §9.5 の #9 以降まで進んだときだけ */
function latestVersion(v: Verdict): string | null {
	return v.row >= 9 ? v.item?.latestVersion ?? null : null;
}

function overReview(r: AgeReport, reviewAfterDays: number | null): boolean {
	return reviewAfterDays !== null && r.days !== null && r.days >= reviewAfterDays;
}

export function formatBand(r: AgeReport, reviewAfterDays: number | null): string {
	const date = r.survey.date && r.days !== null
		? S.bandDate(ymdText(r.survey.date), elapsedText(r.days), sourceText(r.survey))
		: S.bandDateUnknown;
	const ver = r.record.version;
	const latest = latestVersion(r.verdict);
	const version = ver.value === null ? (ver.state === "bad" ? S.versionBad : S.versionNone)
		: latest === null ? S.version(ver.value) : S.versionTo(ver.value, latest);
	const parts = [date, version, S.verdict(S.label[r.verdict.kind], r.verdict.reason)];
	if (reviewAfterDays !== null && overReview(r, reviewAfterDays)) parts.push(S.review(reviewAfterDays));   // FR-12。ラベルは変えない
	return parts.join(S.sep);
}

export interface ModalSection { heading: string; lines: string[] }

const fieldText = (f: Field): string => f.value ?? (f.state === "bad" ? S.bad : S.none);

function candidateText(c: DateCandidate): string {
	const value = c.raw === null ? (c.state === "bad" ? S.bad : S.none) : S.mWithState(c.raw, c.state === "ok" ? S.stateOk : S.stateBad);
	return S.mPair(c.source, value);
}

function cliLines(cli: CliResult, v: Verdict, today: Ymd): string[] {
	if (cli.kind === "none") return [S.none, S.mCliReason(S.reasonNoCli)];
	if (cli.kind !== "ok") return [S.mCliFile(cli.fileName), S.mCliReason(cli.reason)];
	const checked = parseYmd(cli.checkedOn);
	const lines = [S.mCliFile(cli.fileName), S.mCliChecked(cli.checkedOn, checked ? elapsedText(daysSince(checked, today)) : S.bad)];
	if (cli.dropped > 0) lines.push(S.mCliDropped(cli.dropped));
	const it = v.item;
	if (!it) return [...lines, v.matches >= 2 ? S.mCliDup(v.matches) : S.mCliNoItem];
	lines.push(S.mPair("latest_version", it.latestVersion ?? S.none), S.mPair("diff_kind", it.diffKind ?? S.none),
		S.mPair("stale", String(it.stale)), S.mPair("fetch_status", it.fetchStatus));
	if (it.newlyStale !== null) lines.push(S.mPair("newly_stale", String(it.newlyStale)));
	return lines;
}

/** 詳細モーダルに出す節(§9.6 の順) */
export function modalSections(r: AgeReport, cli: CliResult, reviewAfterDays: number | null, today: Ymd): ModalSection[] {
	const picked = r.survey.date && r.days !== null
		? S.mPicked(ymdText(r.survey.date), elapsedText(r.days), sourceText(r.survey)) : S.none;
	const sections: ModalSection[] = [
		{ heading: S.mDate, lines: [picked, ...r.survey.candidates.map(candidateText)] },
		{ heading: S.mRecord, lines: [
			S.mPair("rf_target", fieldText(r.record.target)), S.mPair("rf_registry", fieldText(r.record.registry)),
			S.mPair("rf_version", fieldText(r.record.version)), S.mPair("rf_last_checked", fieldText(r.record.lastChecked)),
		] },
		{ heading: S.mCli, lines: cliLines(cli, r.verdict, today) },
		{ heading: S.mVerdict, lines: [S.mVerdictLine(S.label[r.verdict.kind], r.verdict.reason), S.mRow(r.verdict.row)] },
	];
	if (reviewAfterDays !== null) {
		sections.push({ heading: S.mReview, lines: [r.days === null ? S.mReviewNoDate(reviewAfterDays)
			: overReview(r, reviewAfterDays) ? S.mReviewOver(reviewAfterDays, r.days) : S.mReviewUnder(reviewAfterDays, r.days)] });
	}
	return sections;
}
