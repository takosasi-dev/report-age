# Report Age

調査レポートのノートを開いたとき、本文の先頭に「いつ調べたか・何日前か・調べ直しが要るか」を 1 行の帯で出す Obsidian プラグインです。ノートは書き換えません(帯は画面に出すだけで、ファイルの中身には入りません)。ネットワークにも出ません。PC でもモバイルでも動く作りです。

*English summary is at the bottom.*

## できること
- **調べた日の帯**: 対象のノートを編集モードで開くと、本文の先頭に `調査 2026-01-15(40日前・ファイル名) | 版の記録なし | 再調査: 判定なし(CLI の結果なし)` の形の 1 行を出す
- **調べた日の読み取り**: プロパティ(frontmatter)のキーを上から順に見て、読めなければファイル名の先頭の日付を使う。ファイルの更新日時は使わない
- **経過日数**: 端末の今日の日付との差を `N日前`・`今日`・`未来の日付` で出す
- **再調査の判定を写す**: 外の道具が書いた結果のファイル(JSON)が vault にあれば、その判定(要・不要など)を帯に写す。無ければ、調べた日と経過日数だけの帯になる
- **詳細の窓**: 帯を押すかコマンドで、採った日付・見た候補・版の記録・結果のファイルの中身・判定の理由を出す
- **目安の日数**: 設定に入れておくと、経過がその日数以上のとき、帯の末尾に `目安 N 日超え` を足す

## 向いている vault(前提)

「いつ調べたか」が、プロパティかファイル名から分かる調査メモを、決まったフォルダに置いている vault です。

```markdown
---
作成日: 2026-01-15
---
# ある道具の調査
```

- **対象になるノート**: 設定の「対象フォルダ」の配下の md と、プロパティに `rf_target` というキーがある md。既定の対象フォルダは作者の vault の名前なので、**自分の vault のフォルダに書き換えてください**
- **調べた日**: 設定の「調べた日に使う frontmatter のキー」(既定は `rf_surveyed_on`・`作成日`)を上から順に見て、`YYYY-MM-DD` で始まる実在の日付を最初に採ります。読めなければ、ファイル名の先頭の日付(`2026-01-15_ある道具の調査.md` の形)を採ります。どれも無ければ `調査日 不明` と出ます
- 日付だけを出したいなら、準備はこれで終わりです。下の「結果のファイル」は、再調査の判定まで出したい人向けです

### 再調査の判定の元(結果のファイル)

このプラグインは、版の新旧を自分では調べません。「調べたときの版」と「今の最新版」を比べる仕事は外の道具に任せ、その道具が vault に書いた結果を読んで帯に写すだけです。作者は手元の道具(公開していません)に書かせています。画面に出る「CLI」はその道具のことで、「stamp」はノートのプロパティに版を記録する操作、「check」は最新版と比べて結果のファイルを書く操作を指します。同じ形を書ける道具があれば、何で作っても読めます。

ノートのプロパティ(版の記録):

```yaml
rf_target: some-package
rf_version: "1.4.0"
rf_surveyed_on: 2026-01-15
```

`rf_version` は調べたときの版で、文字として書きます(引用符で囲む)。`rf_surveyed_on` は調べた日。`rf_registry`・`rf_last_checked` は、あれば詳細の窓に出るだけです。

結果のファイルは、設定の「CLI の結果のフォルダ」の直下に `YYYY-MM-DD.json` の名前で置きます。読むのは、名前が最も新しい 1 本だけです。

```json
{
  "checked_at": "2026-02-20T10:00:00+09:00",
  "items": [
    { "file": "tools/2026-01-15_ある道具の調査.md", "surveyed_version": "1.4.0", "latest_version": "2.0.1",
      "diff_kind": "major", "stale": true, "fetch_status": "ok" }
  ]
}
```

| 項目 | 型 | 要るか | 中身 |
|---|---|---|---|
| `checked_at` | 文字 | 必須 | 確かめた日時。`YYYY-MM-DD` で始まること(先頭の日付だけ使う) |
| `items` | 配列 | 必須 | ノート 1 本につき 1 件 |
| `items[].file` | 文字 | 必須 | ノートのパス。設定の「CLI の結果の file の基準フォルダ」からの相対。無い項目は読まずに捨てる |
| `items[].fetch_status` | 文字 | 必須 | 最新版を取れたか。`ok` と `offline_prev`(前に取った値)は判定に進む。`skipped` は「判定なし」。ほかの文字は「不明」 |
| `items[].diff_kind` | 文字か null | 必須 | 版の差の種類。`same`・`patch`・`minor`・`major` は判定に進む。`reversed` は「要確認」。ほかと null は「不明」 |
| `items[].stale` | 真偽 | 必須 | 古くなったか。true で「要」、false で「不要」 |
| `items[].surveyed_version` | 文字 | 判定に要る | ノートの `rf_version` と同じ文字のときだけ判定に進む |
| `items[].latest_version` | 文字 | 任意 | 帯に `版 1.4.0 → 2.0.1` の形で出る |
| `items[].newly_stale` | 真偽 | 任意 | 詳細の窓に出るだけ |

`file` 以外の必須の項目が無い・型が違うと、ファイル全体を読まずに、どのノートも「不明」にします。表に無い項目は無視します。

## 入れ方

### BRAT で入れる(おすすめ)
1. コミュニティプラグインの「BRAT」(Obsidian42 - BRAT)を入れて有効にする。
2. BRAT の設定 → 「Add Beta plugin」に `takosasi-dev/report-age` を入れる。
3. コミュニティプラグインの一覧で「Report Age」を有効にする。

### 手で入れる
[Releases](https://github.com/takosasi-dev/report-age/releases) から `main.js`・`manifest.json`・`styles.css` を落とし、vault の `.obsidian/plugins/report-age/` に置いて、コミュニティプラグインの一覧で有効にします。

## 使い方

### コマンド
| コマンドパレットに出る名前 | すること |
|---|---|
| Report Age: 調査レポートの鮮度を表示 | 開いているノートの詳細の窓を出す。対象のノートを開いているときだけコマンドパレットに出る |
| Report Age: CLI の結果を読み直す | 結果のファイルを読み直し、`CLI の結果を読みました: <ファイル名>(N 件)` と知らせる。無ければ `CLI の結果がありません: <フォルダ>`、読めなければ `CLI の結果が読めません: <ファイル名>(<理由>)` |

既定のホットキーはありません。

### 画面の見方

帯は ` | ` で区切った部分でできています。押すと詳細の窓が開きます。

1. 調べた日: `調査 2026-01-15(40日前・ファイル名)`。かっこの後ろは日付の出どころで、`ファイル名`・`stamp`(`rf_surveyed_on` から採った)・キーの名前(`作成日` など)のどれか
2. 版: `版の記録なし` / `版 1.4.0` / `版 1.4.0 → 2.0.1` / `版の記録が読めない`
3. 判定: `再調査: <ラベル>(<理由>)`。ラベルは 要・不要・要確認・不明・判定なし の 5 つで、帯の左の線の色も変わります(赤・緑・橙・黄・灰)
4. 「目安の日数」を入れたときだけ、末尾に `目安 30 日超え` の形

判定は、次の表を上から順に見て、最初に当たった行で決まります。詳細の窓の「再調査」に出る `当たった行: §9.5 の #N` の N が、この表の番号です(「§9.5」は作者の設計メモの節の番号です)。

| # | 条件 | 帯に出る判定 |
|---|---|---|
| 1 | 結果のファイルが無い | 判定なし(CLI の結果なし) |
| 2 | 結果のファイルが読めない・形が違う | 不明(CLI の結果が読めない: <ファイル名>) |
| 3 | このノートの項目が 2 件以上ある | 不明(CLI の結果が重複) |
| 4 | このノートの項目が無く、`rf_version` も無い | 判定なし(版の記録なし) |
| 5 | このノートの項目が無く、`rf_version` はある | 不明(CLI の結果に無い。stamp の後に check していない) |
| 6 | `fetch_status` が `skipped` | 判定なし(版の記録なし、または CLI が扱えない種別) |
| 7 | `rf_version` と `surveyed_version` が同じ文字でない | 不明(記録が変わった。check をやり直す) |
| 8 | `fetch_status` が `ok`・`offline_prev` 以外 | 不明(取得できなかった: <fetch_status>) |
| 9 | `diff_kind` が `reversed` | 要確認(調査時の版の方が新しい) |
| 10 | `diff_kind` が `same`・`patch`・`minor`・`major` 以外 | 不明(版を比べられない: <diff_kind>) |
| 11 | `stale` が true | 要(<diff_kind>・<確かめた日> 確認) |
| 12 | `stale` が false | 不要(<diff_kind>・<確かめた日> 確認) |

`fetch_status` が `offline_prev` のときは、11・12 の理由の末尾に `・前回値` が付きます。

詳細の窓は、見出しがノートの名前で、`調べた日`(採った日付と、見た候補の全部)・`版の記録`・`CLI の結果`・`再調査` が並びます。「目安の日数」を入れていれば `目安` も出ます。

## 設定
| 項目 | 既定 | 内容 |
|---|---|---|
| 対象フォルダ | `レポート/調査レポート/OSS調査`・`レポート/調査レポート/ゲーム別OSS調査`・`レポート/調査レポート/生成AI調査`(作者の vault の名前。書き換える) | この配下の md に帯を出す。vault からの相対パスを1行に1つ。frontmatter に `rf_target` があるノートは、ここに無くても対象 |
| 除外フォルダ | 空 | この配下は対象から外す。1行に1つ。CLI の結果のフォルダの配下は、書かなくても外れる |
| 本文の先頭に帯を出す | ON | 切ると、コマンドで開く詳細だけになる |
| 調べた日に使う frontmatter のキー | `rf_surveyed_on`・`作成日` | 上から順に見て、最初に読めた日付を使う。1行に1つ |
| ファイル名の先頭の日付を使う | ON | 上のキーで読めなかったとき、ファイル名の先頭の YYYY-MM-DD を調べた日にする |
| 目安の日数 | 空 | 経過日数がこの数以上なら、帯の末尾に「目安 N 日超え」を足す。空なら出さない。判定のラベルは変えない |
| CLI の結果のフォルダ | `レポート/調査レポート/_freshness`(作者の vault の名前。書き換える) | 結果の `YYYY-MM-DD.json` を置くフォルダ。名前が最も新しい1本だけを読む |
| CLI の結果の file の基準フォルダ | `レポート/調査レポート`(同上) | JSON の `file` を、このフォルダからの相対パスとして読む |

設定画面の 3 つ目の組の見出しには、作者の手元の道具の名前がそのまま出ます。

## 安全のための決まり
- ノートは 1 つも書き換えません。帯はエディタの飾りで、文書の文字には入りません。プロパティも本文も変えません
- 読むのは、ノートの frontmatter(Obsidian が持っている控え)・パス・ファイル名と、結果のフォルダの JSON 1 本だけです。ノートの本文は読みません
- 書くのは自分の `data.json`(設定)だけです。読めない・版が違うときは既定値で動き、`data.json` を書き換えません(知らせが出ます)
- ネットワークに出ません。最新版を調べに行くこともしません。Node.js / Electron の機能を使いません(モバイルでも動く作り)
- クリップボードには書きません

## 動作確認の状況
- 版 0.1.0。Windows の Obsidian 1.14.4 で動作を確認(対象フォルダのノートに帯が出る・押すと詳細の窓が開く・対象外のノートには出ない)
- iPhone・Android の実機は未確認(モバイル表示のエミュレーションで読み込みと表示まで確認)
- **結果のファイル(JSON)がある状態での表示は、実機では未確認です。** 判定の対応(上の表)はテストで確かめてあります
- 閲覧モードで帯が出ないこと、プロパティのあるノートでの帯の位置も未確認です

## 分かっている限界
- 帯が出るのは編集モード(ライブプレビュー・ソース)だけです。閲覧モード・ホバーのプレビュー・埋め込みには出ません。閲覧モードでは、コマンドで詳細の窓を開いて見ます
- 再調査の判定には、結果のファイルを書く外の道具が要ります。作者の道具は公開していないので、上の形の JSON を書く物を自分で用意しない限り、帯は「調べた日と経過日数」だけになります
- 結果のファイルは、名前が最も新しい 1 本だけを読みます。それが壊れていても、前のファイルには戻しません
- `rf_version: 5.0` のように引用符なしで書いた版は数として読まれ、`版の記録が読めない` になります
- 日付をまたいで開いたままのノートは、開き直すなどするまで前の日の日数のままです
- 版を記録したノートの名前や場所を変えると、結果のファイルのパスと合わなくなり、「不明(CLI の結果に無い。…)」になります

## 開発
```
npm install
npm run build        # main.js を作る(型チェックつき)
npm test             # vitest
npm run lint         # eslint-plugin-obsidianmd
```
日付の読み取り・経過日数・判定・帯の文字は obsidian を import しない関数で、テストは作り物のノートと JSON だけを使います。

## ライセンス
MIT。[LICENSE](LICENSE) を見てください。

---

## English summary
**Report Age** shows a one-line band at the top of a research note: when it was surveyed, how many days ago, and whether it needs a new survey.
- Target notes: Markdown files under the folders you list in settings, or any note with an `rf_target` property. The default folders are the author's own; change them.
- The survey date comes from frontmatter keys you choose (default `rf_surveyed_on`, then `作成日`), then from a `YYYY-MM-DD` prefix of the file name. File modification time is never used.
- The "needs a new survey" verdict is optional. It is copied from a JSON file (`YYYY-MM-DD.json`: `checked_at`, `items[]` with `file`, `surveyed_version`, `latest_version`, `diff_kind`, `stale`, `fetch_status`) written by an external tool. The author's tool is not public; without such a file the band shows the date and age only.
- The plugin never compares versions itself and never reports "no survey needed" when the result file is broken, mismatched, or a fetch failed.
- Read-only: the band is an editor decoration and is not part of the file. Writes only its own `data.json`. No network, no clipboard, no Node.js or Electron APIs.
- The band appears in editing views only (Live Preview and Source mode); in Reading view use the command to open the details.
- Install with BRAT: `takosasi-dev/report-age`. The UI is in Japanese.
- Tested on Windows desktop (Obsidian 1.14.4) only; real phones and the display with a result file present are untested.
