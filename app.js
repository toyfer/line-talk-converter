(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    allRecords: [],
    filteredRecords: [],
    originalFileName: "",
    view: "table",
    previewLimit: 300,
    worker: null,
    workerBusy: false
  };

  const el = {
    file: $("file"),
    dropzone: $("dropzone"),
    encoding: $("encoding"),
    previewLimit: $("previewLimit"),
    convert: $("convert"),
    downloadCsv: $("downloadCsv"),
    downloadJson: $("downloadJson"),
    downloadXml: $("downloadXml"),
    downloadTxt: $("downloadTxt"),
    downloadHtml: $("downloadHtml"),
    downloadMd: $("downloadMd"),
    downloadTsv: $("downloadTsv"),
    status: $("status"),
    summary: $("summary"),
    summaryFilename: $("summaryFilename"),
    summaryCount: $("summaryCount"),
    summaryMissingDate: $("summaryMissingDate"),
    summarySenderCount: $("summarySenderCount"),
    summaryRange: $("summaryRange"),
    summarySpecial: $("summarySpecial"),
    resultPanel: $("resultPanel"),
    search: $("search"),
    senderFilter: $("senderFilter"),
    dateFrom: $("dateFrom"),
    dateTo: $("dateTo"),
    tableViewBtn: $("tableViewBtn"),
    cardViewBtn: $("cardViewBtn"),
    statsViewBtn: $("statsViewBtn"),
    tableView: $("tableView"),
    cardView: $("cardView"),
    statsView: $("statsView"),
    tableBody: $("tableBody"),
    toast: $("toast")
  };

  init();

  function init() {
    state.previewLimit = Number(el.previewLimit.value || 300);
    setupWorker();
    bindEvents();
    setDownloadButtons(false);
    setStatus("ファイルを選択してください。");
  }

  function setupWorker() {
    try {
      state.worker = new Worker("./parser-worker.js");
      state.worker.onmessage = (event) => {
        const { ok, records, meta, error } = event.data || {};
        state.workerBusy = false;
        setBusy(false);

        if (!ok) {
          setStatus(`エラー: ${error || "解析に失敗しました"}`);
          showToast(error || "解析に失敗しました", true);
          return;
        }

        state.allRecords = records || [];
        state.filteredRecords = [...state.allRecords];
        renderAfterParse(meta);
      };

      state.worker.onerror = (err) => {
        state.workerBusy = false;
        setBusy(false);
        console.error(err);
        setStatus("エラー: Worker の初期化に失敗しました。");
        showToast("Worker の初期化に失敗しました", true);
      };
    } catch (e) {
      state.worker = null;
    }
  }

  function bindEvents() {
    el.convert.addEventListener("click", onConvert);
    el.downloadCsv.addEventListener("click", () => exportFile("csv"));
    el.downloadJson.addEventListener("click", () => exportFile("json"));
    el.downloadXml.addEventListener("click", () => exportFile("xml"));
    el.downloadTxt.addEventListener("click", () => exportFile("txt"));
    el.downloadHtml.addEventListener("click", () => exportFile("html"));
    el.downloadMd.addEventListener("click", () => exportFile("md"));
    el.downloadTsv.addEventListener("click", () => exportFile("tsv"));

    el.search.addEventListener("input", scheduleFilter);
    el.senderFilter.addEventListener("change", scheduleFilter);
    el.dateFrom.addEventListener("change", scheduleFilter);
    el.dateTo.addEventListener("change", scheduleFilter);
    el.previewLimit.addEventListener("change", () => {
      state.previewLimit = Number(el.previewLimit.value || 300);
      render();
    });

    el.tableViewBtn.addEventListener("click", () => switchView("table"));
    el.cardViewBtn.addEventListener("click", () => switchView("card"));
    el.statsViewBtn.addEventListener("click", () => switchView("stats"));

    el.file.addEventListener("change", () => {
      const file = el.file.files?.[0];
      if (file) {
        setStatus(`選択中: ${file.name}`);
      }
    });

    el.dropzone.addEventListener("click", () => el.file.click());
    el.dropzone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        el.file.click();
      }
    });

    el.dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      el.dropzone.classList.add("is-dragover");
    });

    el.dropzone.addEventListener("dragleave", () => {
      el.dropzone.classList.remove("is-dragover");
    });

    el.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      el.dropzone.classList.remove("is-dragover");
      const file = e.dataTransfer.files?.[0];
      if (file) {
        el.file.files = e.dataTransfer.files;
        setStatus(`選択中: ${file.name}`);
      }
    });
  }

  async function onConvert() {
    const file = el.file.files?.[0];
    if (!file) {
      setStatus("ファイルを選択してください。");
      showToast("ファイルを選択してください", true);
      return;
    }

    if (state.workerBusy) return;

    try {
      state.originalFileName = file.name;
      setBusy(true);
      setStatus("読み込み中...");

      const text = await readFileAsText(file, el.encoding.value);
      if (!text.trim()) {
        throw new Error("ファイルが空です");
      }

      if (!state.worker) {
        throw new Error("Web Worker を初期化できませんでした");
      }

      state.workerBusy = true;
      setStatus("解析中...");
      state.worker.postMessage({
        text,
        previewLimit: state.previewLimit
      });
    } catch (err) {
      console.error(err);
      setBusy(false);
      showToast(err.message || "読み込みに失敗しました", true);
      setStatus(`エラー: ${err.message || "読み込みに失敗しました"}`);
    }
  }

  function readFileAsText(file, encoding = "utf-8") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || "");
      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
      reader.readAsText(file, encoding);
    });
  }

  function renderAfterParse(meta) {
    const records = state.allRecords;
    updateSummary(meta);
    populateSenderFilter(records);
    renderFiltered();
    el.summary.hidden = false;
    el.resultPanel.hidden = false;
    setDownloadButtons(records.length > 0);
    setBusy(false);

    if (!records.length) {
      setStatus("メッセージを検出できませんでした。");
      showToast("メッセージを検出できませんでした", true);
    } else {
      setStatus(`変換完了: ${records.length}件`);
      showToast(`変換完了: ${records.length}件`);
    }
  }

  function setBusy(isBusy) {
    el.convert.disabled = isBusy;
    el.file.disabled = isBusy;
    el.encoding.disabled = isBusy;
    el.previewLimit.disabled = isBusy;
    el.convert.textContent = isBusy ? "処理中..." : "変換する";
  }

  function setDownloadButtons(enabled) {
    [el.downloadCsv, el.downloadJson, el.downloadXml, el.downloadTxt, el.downloadHtml, el.downloadMd, el.downloadTsv].forEach(
      (btn) => {
        btn.disabled = !enabled;
      }
    );
  }

  function setStatus(text) {
    el.status.textContent = text;
  }

  function showToast(text, isError = false) {
    el.toast.textContent = text;
    el.toast.style.background = isError ? "rgba(220, 38, 38, 0.96)" : "rgba(17, 24, 39, 0.96)";
    el.toast.hidden = false;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      el.toast.hidden = true;
    }, 2500);
  }

  function updateSummary(meta) {
    el.summaryFilename.textContent = `${state.originalFileName || "-"} (${formatFileSize(meta.fileSize || 0)})`;
    el.summaryCount.textContent = String(meta.recordCount || 0);
    el.summaryMissingDate.textContent = String(meta.emptyDateCount || 0);
    el.summarySenderCount.textContent = String(meta.senderCount || 0);
    el.summaryRange.textContent = meta.dateRange || "-";
    el.summarySpecial.textContent = String(meta.specialCount || 0);
  }

  function populateSenderFilter(records) {
    const senders = [...new Set(records.map((r) => r.sender).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "ja")
    );

    el.senderFilter.innerHTML = `<option value="">すべての送信者</option>`;
    for (const sender of senders) {
      const opt = document.createElement("option");
      opt.value = sender;
      opt.textContent = sender;
      el.senderFilter.appendChild(opt);
    }
  }

  let filterTimer = null;
  function scheduleFilter() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(renderFiltered, 80);
  }

  function renderFiltered() {
    const keyword = el.search.value.trim().toLowerCase();
    const sender = el.senderFilter.value.trim().toLowerCase();
    const dateFrom = el.dateFrom.value;
    const dateTo = el.dateTo.value;

    state.filteredRecords = state.allRecords.filter((r) => {
      const matchKeyword =
        !keyword ||
        String(r.date).toLowerCase().includes(keyword) ||
        String(r.time).toLowerCase().includes(keyword) ||
        String(r.sender).toLowerCase().includes(keyword) ||
        String(r.message).toLowerCase().includes(keyword) ||
        String(r.type).toLowerCase().includes(keyword);

      const matchSender = !sender || String(r.sender).toLowerCase() === sender.toLowerCase();
      const matchDateFrom = !dateFrom || (r.date && r.date >= dateFrom);
      const matchDateTo = !dateTo || (r.date && r.date <= dateTo);

      return matchKeyword && matchSender && matchDateFrom && matchDateTo;
    });

    render();
  }

  function render() {
    if (state.view === "table") {
      renderTable(state.filteredRecords);
    } else if (state.view === "card") {
      renderCards(state.filteredRecords);
    } else {
      renderStatsView(state.filteredRecords);
    }
  }

  function switchView(view) {
    state.view = view;

    el.tableViewBtn.classList.toggle("is-active", view === "table");
    el.cardViewBtn.classList.toggle("is-active", view === "card");
    el.statsViewBtn.classList.toggle("is-active", view === "stats");

    el.tableView.hidden = view !== "table";
    el.cardView.hidden = view !== "card";
    el.statsView.hidden = view !== "stats";

    render();
  }

  function renderTable(records) {
    el.tableBody.innerHTML = "";

    if (!records.length) {
      el.tableBody.innerHTML = `<tr><td colspan="5" class="empty">該当データがありません</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    const limit = state.previewLimit;
    const max = Math.min(records.length, limit);

    for (let i = 0; i < max; i++) {
      const r = records[i];
      const tr = document.createElement("tr");
      tr.appendChild(cell(r.date || ""));
      tr.appendChild(cell(r.time || ""));
      tr.appendChild(cell(r.sender || ""));
      tr.appendChild(cell(r.type || ""));
      tr.appendChild(cell(r.message || ""));
      fragment.appendChild(tr);
    }

    if (records.length > limit) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "empty";
      td.textContent = `表示は先頭 ${limit} 件のみです（全 ${records.length} 件）`;
      tr.appendChild(td);
      fragment.appendChild(tr);
    }

    el.tableBody.appendChild(fragment);
  }

  function renderCards(records) {
    el.cardView.innerHTML = "";

    if (!records.length) {
      el.cardView.innerHTML = `<div class="empty">該当データがありません</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    const limit = state.previewLimit;
    const max = Math.min(records.length, limit);

    for (let i = 0; i < max; i++) {
      const r = records[i];
      const card = document.createElement("article");
      card.className = "card-item";

      const meta = document.createElement("div");
      meta.className = "card-item__meta";

      const date = document.createElement("span");
      date.className = "card-item__date";
      date.textContent = `${r.date || "-"} ${r.time || "-"}`;

      const sender = document.createElement("span");
      sender.className = "card-item__sender";
      sender.textContent = r.sender || "-";

      const type = document.createElement("span");
      type.className = "card-item__type";
      type.textContent = r.type || "text";

      meta.append(date, sender, type);

      const message = document.createElement("div");
      message.className = "card-item__message";
      message.textContent = r.message || "";

      card.append(meta, message);
      fragment.appendChild(card);
    }

    if (records.length > limit) {
      const more = document.createElement("div");
      more.className = "empty";
      more.textContent = `表示は先頭 ${limit} 件のみです（全 ${records.length} 件）`;
      fragment.appendChild(more);
    }

    el.cardView.appendChild(fragment);
  }

  function renderStatsView(records) {
    const stats = computeStats(records);
    el.statsView.innerHTML = "";

    const root = document.createElement("div");

    const grid = document.createElement("div");
    grid.className = "stats-grid";

    const items = [
      ["表示件数", stats.count],
      ["送信者数", stats.senderCount],
      ["日数", stats.dayCount],
      ["special件数", stats.specialCount]
    ];

    for (const [label, value] of items) {
      const box = document.createElement("div");
      box.className = "stat-box";
      box.innerHTML = `
        <span class="stat-box__label">${escapeHtml(label)}</span>
        <strong class="stat-box__value">${escapeHtml(String(value))}</strong>
      `;
      grid.appendChild(box);
    }

    const chart = document.createElement("div");
    chart.className = "chart-list";

    const senderRanks = Object.entries(stats.bySender)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const max = Math.max(1, ...senderRanks.map(([, v]) => v));

    senderRanks.forEach(([name, value]) => {
      const row = document.createElement("div");
      row.className = "chart-row";
      row.innerHTML = `
        <div class="chart-row__label">${escapeHtml(name)}</div>
        <div class="chart-row__bar"><span style="width:${Math.round((value / max) * 100)}%"></span></div>
        <div class="chart-row__value">${value}</div>
      `;
      chart.appendChild(row);
    });

    root.append(grid, chart);
    el.statsView.appendChild(root);
  }

  function computeStats(records) {
    const senderCount = new Set(records.map((r) => r.sender).filter(Boolean)).size;
    const days = new Set(records.map((r) => r.date).filter(Boolean));
    const specialCount = records.filter((r) => r.type && r.type !== "text").length;
    const bySender = {};

    for (const r of records) {
      const key = r.sender || "(unknown)";
      bySender[key] = (bySender[key] || 0) + 1;
    }

    return {
      count: records.length,
      senderCount,
      dayCount: days.size,
      specialCount,
      bySender
    };
  }

  function exportFile(type) {
    if (!state.allRecords.length) {
      showToast("先に変換してください", true);
      return;
    }

    const base = getBaseName(state.originalFileName || "line_talk");
    let content = "";
    let mime = "text/plain;charset=utf-8";
    let filename = `${base}.txt`;

    if (type === "csv") {
      content = toCSV(state.allRecords);
      mime = "text/csv;charset=utf-8";
      filename = `${base}.csv`;
    } else if (type === "json") {
      content = JSON.stringify(state.allRecords, null, 2);
      mime = "application/json;charset=utf-8";
      filename = `${base}.json`;
    } else if (type === "xml") {
      content = toXML(state.allRecords, state.originalFileName);
      mime = "application/xml;charset=utf-8";
      filename = `${base}.xml`;
    } else if (type === "txt") {
      content = toFormattedText(state.allRecords);
      mime = "text/plain;charset=utf-8";
      filename = `${base}.formatted.txt`;
    } else if (type === "html") {
      content = toHTML(state.allRecords, state.originalFileName);
      mime = "text/html;charset=utf-8";
      filename = `${base}.html`;
    } else if (type === "md") {
      content = toMarkdown(state.allRecords, state.originalFileName);
      mime = "text/markdown;charset=utf-8";
      filename = `${base}.md`;
    } else if (type === "tsv") {
      content = toTSV(state.allRecords);
      mime = "text/tab-separated-values;charset=utf-8";
      filename = `${base}.tsv`;
    }

    download(content, filename, mime);
  }

  function toCSV(rows) {
    const header = ["date", "time", "sender", "type", "message"];
    const body = rows.map((r) =>
      [r.date, r.time, r.sender, r.type, r.message].map(csvField).join(",")
    );
    return [header.join(","), ...body].join("\n");
  }

  function toTSV(rows) {
    const header = ["date", "time", "sender", "type", "message"];
    const body = rows.map((r) =>
      [r.date, r.time, r.sender, r.type, r.message].map((v) => String(v ?? "").replace(/\t/g, " ")).join("\t")
    );
    return [header.join("\t"), ...body].join("\n");
  }

  function csvField(value) {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  }

  function toXML(rows, sourceFileName) {
    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const items = rows
      .map(
        (r) => `  <message>
    <date>${esc(r.date)}</date>
    <time>${esc(r.time)}</time>
    <sender>${esc(r.sender)}</sender>
    <type>${esc(r.type)}</type>
    <text>${esc(r.message)}</text>
  </message>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<lineTalk source="${esc(sourceFileName)}">\n${items}\n</lineTalk>\n`;
  }

  function toFormattedText(rows) {
    const lines = ["[LINE] formatted export"];
    let lastDate = "";

    for (const r of rows) {
      if (r.date !== lastDate) {
        lines.push("");
        lines.push(r.date || "");
        lastDate = r.date;
      }
      lines.push(`${r.time}\t${r.sender}\t${r.message}`);
    }

    return lines.join("\n");
  }

  function toHTML(rows, sourceFileName) {
    const esc = escapeHtml;

    const body = rows
      .map(
        (r) => `
          <tr>
            <td>${esc(r.date)}</td>
            <td>${esc(r.time)}</td>
            <td>${esc(r.sender)}</td>
            <td>${esc(r.type)}</td>
            <td>${esc(r.message)}</td>
          </tr>`
      )
      .join("\n");

    return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(sourceFileName)} - LINEトーク履歴</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:24px;background:#f8fafc;color:#111827}
table{border-collapse:collapse;width:100%;background:#fff}
th,td{border:1px solid #e5e7eb;padding:10px;vertical-align:top;text-align:left}
th{background:#f1f5f9}
td:nth-child(5){white-space:pre-wrap;word-break:break-word}
h1{margin-top:0}
</style>
</head>
<body>
<h1>${esc(sourceFileName)}</h1>
<table>
<thead><tr><th>date</th><th>time</th><th>sender</th><th>type</th><th>message</th></tr></thead>
<tbody>
${body}
</tbody>
</table>
</body>
</html>`;
  }

  function toMarkdown(rows, sourceFileName) {
    const lines = [`# ${sourceFileName}`, "", "| date | time | sender | type | message |", "|---|---:|---|---|---|"];
    for (const r of rows) {
      lines.push(
        `| ${mdCell(r.date)} | ${mdCell(r.time)} | ${mdCell(r.sender)} | ${mdCell(r.type)} | ${mdCell(r.message)} |`
      );
    }
    return lines.join("\n");
  }

  function mdCell(value) {
    return String(value ?? "")
      .replace(/\|/g, "\\|")
      .replace(/\n/g, "<br>");
  }

  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
    showToast(`${filename} をダウンロードしました`);
  }

  function cell(text) {
    const td = document.createElement("td");
    td.textContent = text ?? "";
    return td;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getBaseName(name) {
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(0, idx) : name;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
})();