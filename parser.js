/**
 * LINEトーク履歴 .txt パーサー
 *
 * 対応フォーマット（実データで確認済み）:
 *   [LINE] {user}とのトーク履歴
 *   保存日時：YYYY/MM/DD hh:mm
 *
 *   YYYY/MM/DD(月)          ← 日付行
 *   HH:MM\t送信者\t本文     ← 通常メッセージ（タブ区切り）
 *   HH:MM  送信者  本文     ← スペース区切りの場合もあり
 *   H:MM\t送信者\t本文     ← 時刻が1桁の場合
 *   本文 continuation       ← 複数行メッセージの継続行
 *   [LINE]                 ← ヘッダー（スキップ）
 *   保存日時               ← メタ行（スキップ）
 *   空白行                 ← スキップ
 *
 * プレースホルダー: [スタンプ] [写真] [動画] [ファイル] [URL] 等は本文として保持
 */

(function (global) {
  "use strict";

  // ── 定数 ──────────────────────────────────────────────────
  var PREVIEW_LIMIT = 500;
  var DEFAULT_CHUNK_SIZE = 2000; // DocumentFragment挿入チャンクサイズ

  // ── 正規表現 ─────────────────────────────────────────────
  // 日付行: 先頭が YYYY/MM/DD(任意文字+) で、) で終わる
  // 実例: 2021/02/22(月)  /  2021/02/22(Mon)  /  YYYY/MM/DD(月)
  var DATE_RE = /^\d{4}\/\d{2}\/\d{2}\([^\)]+\)/;

  // メッセージ行: 先頭が HH:MM または H:MM（1〜2桁）、次に 区切り（タブ/スペース+）、送信者、本文
  // 実例: 11:19	me	こんにちは！
  // 実例: 1:04	me	おはよ！
  // 実例: 21:33   Alpha   [スタンプ]
  var MSG_RE = /^(\d{1,2}:\d{2})\s+\t*([^\t]+)\t(.*)$/;

  // スキップするヘッダ行
  var SKIP_PREFIXES = ["[LINE]", "保存日時"];

  // ── 公開API ─────────────────────────────────────────────
  /**
   * @param {string} text  ファイル全文
   * @returns {{ records: Array, meta: Object }}
   */
  function parse(text) {
    var lines = normalizeLineBreaks(text);
    var records = [];
    var currentDate = "";
    var lastRecord = null;
    var meta = { lineCount: lines.length };

    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      var line = raw;

      // 空行 → スキップ
      if (line.length === 0) continue;

      // 先頭一致でヘッダー/メタ行をスキップ
      if (startsWithAny(line, SKIP_PREFIXES)) continue;

      // トリムして判定（日付行は行頭一致のみ）
      var dateMatch = line.match(DATE_RE);
      if (dateMatch) {
        currentDate = normalizeDate(dateMatch[0]);
        lastRecord = null; // 日付が変わったら継続行クリア
        continue;
      }

      // メッセージ行
      var msgMatch = line.match(MSG_RE);
      if (msgMatch) {
        lastRecord = {
          date: currentDate,
          time: normalizeTime(msgMatch[1]),
          sender: msgMatch[2].trim(),
          message: msgMatch[3] || ""
        };
        records.push(lastRecord);
        continue;
      }

      // 継続行（メッセージ行定義後、誰もマッチしなければ継続行として連結）
      if (lastRecord) {
        lastRecord.message += "\n" + line;
      }
    }

    meta.recordCount = records.length;
    return { records: records, meta: meta };
  }

  // ── 内部ユーティリティ ────────────────────────────────────

  /**
   * すべての改行コードを LF に統一してから分割
   */
  function normalizeLineBreaks(text) {
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  }

  /**
   * "YYYY/MM/DD(月)" → "YYYY-MM-DD"
   * "YYYY/MM/DD(Mon)" → "YYYY-MM-DD"
   */
  function normalizeDate(dateStr) {
    var m = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
    if (m) {
      return m[1] + "-" + m[2] + "-" + m[3];
    }
    return dateStr;
  }

  /**
   * "1:04" → "01:04"（2桁幅固定）
   */
  function normalizeTime(t) {
    var parts = t.split(":");
    return pad2(parts[0]) + ":" + pad2(parts[1]);
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  /**
   * 先頭一致（O(1) アクセス）
   */
  function startsWithAny(str, prefixes) {
    for (var i = 0; i < prefixes.length; i++) {
      if (str.indexOf(prefixes[i]) === 0) return true;
    }
    return false;
  }

  // ── エクスポート ──────────────────────────────────────────
  global.LineTalkParser = {
    parse: parse,
    PREVIEW_LIMIT: PREVIEW_LIMIT,
    DEFAULT_CHUNK_SIZE: DEFAULT_CHUNK_SIZE
  };
})(window);