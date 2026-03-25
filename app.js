/**
 * LINEトーク履歴コンバーター — メインアプリ
 *
 * 設計方針:
 *   - ブラウザ ローカル処理のみ（外部通信なし）
 *   - モジュールパターンは使用しない（GitHub Pages静的配信制約）
 *   - 状態は1つのstateオブジェクトに集中
 *   - DOM操作は DocumentFragment + 一括挿入で最小化
 */

(function () {
  "use strict";

  // ── State ────────────────────────────────────────────────
  var state = {
    records: [],
    originalFileName: "",
    originalFileSize: 0,
    meta: {}
  };

  // ── DOM参照（初回取得してキャッシュ）──────────────────────
  var els = {};
  function getEl(id) {
    if (!els[id]) els[id] = document.getElementById(id);
    return els[id];
  }

  // ── 初期化 ───────────────────────────────────────────────
  function init() {
    getEl("convert").addEventListener("click", onConvert);
    getEl("downloadCsv").addEventListener("click", onDownloadCsv);
    getEl("downloadJson").addEventListener("click", onDownloadJson);
    getEl("downloadXml").addEventListener("click", onDownloadXml);

    // ファイル選択時に既存データをクリア
    getEl("file").addEventListener("change", onFileChange);

    // プレビュー件数設定
    getEl("previewLimitLabel").textContent =
      String(LineTalkParser.PREVIEW_LIMIT);
  }

  // ── イベントハンドラ ─────────────────────────────────────

  function onFileChange() {
    // ファイルが再選択されたとき、状態とUIをリセット
    if (state.records.length > 0) {
      state.records = [];
      state.meta = {};
      setOutputButtonsEnabled(false);
      clearTable();
      getEl("stats").hidden = true;
      setStatus("ファイルを選択してください");
      getEl("count").textContent = "0";
      getEl("filename").textContent = "-";
      getEl("filesize").textContent = "";
    }
  }

  async function onConvert() {
    var fileInput = getEl("file");
    var file = fileInput.files && fileInput.files[0];

    if (!file) {
      setStatus("ファイルを選択してください", "error");
      return;
    }

    // ファイルサイズ警告（>50MB）
    var sizeMB = file.size / 1024 / 1024;
    if (sizeMB > 50) {
      var confirmed = window.confirm(
        "ファイルサイズ (" +
          sizeMB.toFixed(1) +
          "MB) が大きいため、処理に時間がかかります。続行しますか？"
      );
      if (!confirmed) return;
    }

    setStatus("ファイルを読み込み中...", "");
    setConvertButtonLoading(true);

    try {
      // ── 1. 読み込み ──
      var encoding = getEl("encoding").value || "UTF-8";
      var text = await readFileAsText(file, encoding);
      if (!text || text.trim().length === 0) {
        throw new Error("ファイルが空です。別のファイルを選択してください。");
      }

      // ── 2. パース ──
      setStatus("解析中...", "");
      var t0 = performance.now();
      var result = LineTalkParser.parse(text);
      var t1 = performance.now();

      if (result.records.length === 0) {
        throw new Error(
          "トークメッセージが見つかりませんでした。ファイル形式が正しいか確認してください。"
        );
      }

      // ── 3. 状態更新 ──
      state.records = result.records;
      state.meta = result.meta;
      state.originalFileName = file.name;
      state.originalFileSize = file.size;

      // ── 4. UI更新 ──
      renderTable(result.records);
      updateStats(result.meta, file);

      var ms = Math.round(t1 - t0);
      setStatus(
        "完了: " +
          result.records.length +
          "件 (処理時間 " +
          ms +
          "ms)",
        "success"
      );
      setOutputButtonsEnabled(true);
    } catch (err) {
      console.error("[onConvert]", err);
      setStatus("エラー: " + err.message, "error");
    } finally {
      setConvertButtonLoading(false);
    }
  }

  function onDownloadCsv() {
    if (!state.records.length) return;
    var csv = formatCsv(state.records);
    download(
      changeExtension(state.originalFileName, "csv"),
      csv,
      "text/csv;charset=utf-8"
    );
  }

  function onDownloadJson() {
    if (!state.records.length) return;
    var json = JSON.stringify(state.records, null, 2);
    download(
      changeExtension(state.originalFileName, "json"),
      json,
      "application/json;charset=utf-8"
    );
  }

  function onDownloadXml() {
    if (!state.records.length) return;
    var xml = formatXml(state.records, state.originalFileName);
    download(
      changeExtension(state.originalFileName, "xml"),
      xml,
      "application/xml;charset=utf-8"
    );
  }

  // ── ファイル読込 ─────────────────────────────────────────
  function readFileAsText(file, encoding) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result || "");
      };
      reader.onerror = function () {
        reject(new Error("ファイルの読み込みに失敗しました。"));
      };
      reader.readAsText(file, encoding);
    });
  }

  // ── テーブル描画（DocumentFragmentによる最小DOM更新）──────
  function renderTable(records) {
    var limit = LineTalkParser.PREVIEW_LIMIT;
    var rowsEl = getEl("rows");

    // 全行を一括クリア
    rowsEl.innerHTML = "";

    var frag = document.createDocumentFragment();
    var count = Math.min(limit, records.length);

    for (var i = 0; i < count; i++) {
      var r = records[i];
      var tr = document.createElement("tr");

      // XSS防止: DOM text node を使用
      var td0 = document.createElement("td");
      td0.textContent = r.date;
      var td1 = document.createElement("td");
      td1.textContent = r.time;
      var td2 = document.createElement("td");
      td2.textContent = r.sender;
      var td3 = document.createElement("td");
      td3.textContent = r.message;

      tr.appendChild(td0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      frag.appendChild(tr);
    }

    rowsEl.appendChild(frag);
  }

  function clearTable() {
    getEl("rows").innerHTML =
      '<tr><td colspan="4" class="empty">変換結果がここに表示されます</td></tr>';
  }

  // ── 統計更新 ─────────────────────────────────────────────
  function updateStats(meta, file) {
    getEl("count").textContent =
      String(meta.recordCount) +
      "件" +
      (meta.recordCount > LineTalkParser.PREVIEW_LIMIT
        ? " (表示: " + LineTalkParser.PREVIEW_LIMIT + "件)"
        : "");
    getEl("filename").textContent = file.name;
    getEl("filesize").textContent = formatFileSize(file.size);
    getEl("stats").hidden = false;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(2) + " MB";
  }

  // ── CSV生成（RFC 4180準拠）────────────────────────────────
  /**
   * RFC 4180 要件:
   * - フィールド内カンマ/クォート/改行を含む場合は "..." で囲う
   * - フィールド内クォート " は "" にエスケープ
   * - 改行は CRLF だが、LFのみでも相互運用性はある（モダンアプリ許容）
   */
  function formatCsv(records) {
    var header = '"date","time","sender","message"';
    var bodyRows = [];

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      bodyRows.push(
        [
          csvField(r.date),
          csvField(r.time),
          csvField(r.sender),
          csvField(r.message)
        ].join(",")
      );
    }

    // 改行は LF（モダン相互運用性）
    return [header].concat(bodyRows).join("\n");
  }

  /**
   * RFC 4180 CSV フィールドエスケープ
   *
   * 条件: カンマ OR ダブルクォート OR 改行 を含む場合に限り
   * ダブルクォートで囲い、内部の " → "" に置換
   * 改行は LF のまま許容（大多数のアプリで読める）
   */
  function csvField(value) {
    var str = value == null ? "" : String(value);
    var needsQuotes =
      str.indexOf('"') !== -1 ||
      str.indexOf(",") !== -1 ||
      str.indexOf("\n") !== -1 ||
      str.indexOf("\r") !== -1;

    if (!needsQuotes) return str;

    // 内部クォート " → ""
    var escaped = str.replace(/"/g, '""');
    return '"' + escaped + '"';
  }

  // ── XML生成 ──────────────────────────────────────────────
  function formatXml(records, sourceFileName) {
    var xml = [];

    xml.push('<?xml version="1.0" encoding="UTF-8"?>');
    xml.push(
      '<lineTalk xmlns="https://scira.example/line-talk" source="' +
        xmlEscapeAttr(sourceFileName) +
        '" exported="' +
        new Date().toISOString() +
        '">'
    );

    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      xml.push("  <message>");
      xml.push("    <date>" + xmlEscapeText(r.date) + "</date>");
      xml.push("    <time>" + xmlEscapeText(r.time) + "</time>");
      xml.push("    <sender>" + xmlEscapeText(r.sender) + "</sender>");
      // 複数行は \n を保持（XMLでは改行文字は合法）
      xml.push(
        "    <text>" + xmlEscapeText(r.message) + "</text>"
      );
      xml.push("  </message>");
    }

    xml.push("</lineTalk>");
    return xml.join("\n");
  }

  function xmlEscapeText(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function xmlEscapeAttr(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ── ダウンロード ──────────────────────────────────────────
  function download(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    // 即座にクリーンアップ
    requestAnimationFrame(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // ── ファイル名ユーティリティ ─────────────────────────────
  /**
   * "ファイル名.txt" → "ファイル名.ext"
   * 最後の '.' より前を取り出して拡張子を置換
   * 正例: "line_talk.txt" → "line_talk.csv"
   * 誤例: "file.txt.txt" で壊れない
   */
  function changeExtension(filename, newExt) {
    var base = stripExtension(filename || "line_talk");
    return base + "." + newExt;
  }

  function stripExtension(filename) {
    var lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) return filename;
    return filename.slice(0, lastDot);
  }

  // ── UIヘルパー ────────────────────────────────────────────
  function setStatus(message, type) {
    var el = getEl("status");
    el.textContent = message;
    el.className = "status";
    if (type) el.classList.add("status--" + type);
  }

  function setOutputButtonsEnabled(enabled) {
    var ids = ["downloadCsv", "downloadJson", "downloadXml"];
    for (var i = 0; i < ids.length; i++) {
      var btn = getEl(ids[i]);
      btn.disabled = !enabled;
      btn.setAttribute("aria-disabled", String(!enabled));
    }
  }

  function setConvertButtonLoading(loading) {
    var btn = getEl("convert");
    if (loading) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      btn.querySelector(".btn__label").textContent = "処理中...";
    } else {
      btn.disabled = false;
      btn.setAttribute("aria-disabled", "false");
      btn.querySelector(".btn__label").textContent = "変換する";
    }
  }

  // ── 起動 ─────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();