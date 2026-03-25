(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const fileInput = $("file");
  const encodingSelect = $("encoding");
  const convertBtn = $("convert");
  const downloadCsvBtn = $("downloadCsv");
  const downloadJsonBtn = $("downloadJson");
  const downloadXmlBtn = $("downloadXml");
  const rowsEl = $("rows");
  const mobileCardsEl = $("mobileCards");
  const countEl = $("count");
  const filenameEl = $("filename");
  const emptyDateCountEl = $("emptyDateCount");
  const statusEl = $("status");
  const previewLimitLabel = $("previewLimitLabel");
  const searchEl = $("search");

  const PREVIEW_LIMIT = LineTalkParser.PREVIEW_LIMIT;
  previewLimitLabel.textContent = String(PREVIEW_LIMIT);

  let state = {
    records: [],
    filtered: [],
    originalFileName: ""
  };

  convertBtn.addEventListener("click", onConvert);
  searchEl.addEventListener("input", onSearch);
  downloadCsvBtn.addEventListener("click", onDownloadCsv);
  downloadJsonBtn.addEventListener("click", onDownloadJson);
  downloadXmlBtn.addEventListener("click", onDownloadXml);

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function setDownloadEnabled(enabled) {
    [downloadCsvBtn, downloadJsonBtn, downloadXmlBtn].forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  async function onConvert() {
    const file = fileInput.files?.[0];
    if (!file) {
      setStatus("ファイルを選択してください");
      return;
    }

    try {
      setStatus("読み込み中...");
      state.originalFileName = file.name;
      filenameEl.textContent = `${file.name} (${formatFileSize(file.size)})`;

      const text = await readFileAsText(file, encodingSelect.value || "utf-8");

      setStatus("解析中...");
      const result = LineTalkParser.parse(text);

      state.records = result.records;
      state.filtered = [...result.records];

      countEl.textContent = String(result.meta.recordCount);
      emptyDateCountEl.textContent = String(result.meta.emptyDateCount);

      renderAll(state.filtered);
      setDownloadEnabled(result.meta.recordCount > 0);

      if (result.meta.recordCount === 0) {
        setStatus("メッセージを検出できませんでした。文字コードやファイル形式を確認してください");
      } else if (result.meta.emptyDateCount > 0) {
        setStatus(`完了: ${result.meta.recordCount}件（date空 ${result.meta.emptyDateCount}件）`);
      } else {
        setStatus(`完了: ${result.meta.recordCount}件`);
      }
    } catch (error) {
      console.error(error);
      setStatus("エラー: 読み込みまたは解析に失敗しました");
      setDownloadEnabled(false);
    }
  }

  function onSearch() {
    const keyword = String(searchEl.value || "").trim().toLowerCase();

    if (!keyword) {
      state.filtered = [...state.records];
    } else {
      state.filtered = state.records.filter((r) => {
        return (
          String(r.date).toLowerCase().includes(keyword) ||
          String(r.time).toLowerCase().includes(keyword) ||
          String(r.sender).toLowerCase().includes(keyword) ||
          String(r.message).toLowerCase().includes(keyword)
        );
      });
    }

    renderAll(state.filtered);
  }

  function renderAll(records) {
    renderTable(records, PREVIEW_LIMIT);
    renderMobileCards(records, PREVIEW_LIMIT);
  }

  function renderTable(records, limit) {
    rowsEl.innerHTML = "";

    if (!records.length) {
      rowsEl.innerHTML = `<tr><td colspan="4" class="empty">該当データがありません</td></tr>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    const max = Math.min(limit, records.length);

    for (let i = 0; i < max; i++) {
      const r = records[i];
      const tr = document.createElement("tr");
      tr.appendChild(createCell(r.date || ""));
      tr.appendChild(createCell(r.time || ""));
      tr.appendChild(createCell(r.sender || ""));
      tr.appendChild(createCell(r.message || ""));
      fragment.appendChild(tr);
    }

    rowsEl.appendChild(fragment);
  }

  function renderMobileCards(records, limit) {
    mobileCardsEl.innerHTML = "";

    if (!records.length) {
      mobileCardsEl.innerHTML = `<div class="mobile-empty">該当データがありません</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    const max = Math.min(limit, records.length);

    for (let i = 0; i < max; i++) {
      const r = records[i];

      const card = document.createElement("article");
      card.className = "mobile-card";

      const meta = document.createElement("div");
      meta.className = "mobile-card__meta";

      const date = document.createElement("span");
      date.textContent = r.date || "-";

      const time = document.createElement("span");
      time.textContent = r.time || "-";

      const sender = document.createElement("span");
      sender.className = "mobile-card__sender";
      sender.textContent = r.sender || "-";

      meta.append(date, time, sender);

      const message = document.createElement("div");
      message.className = "mobile-card__message";
      message.textContent = r.message || "";

      card.append(meta, message);
      fragment.appendChild(card);
    }

    mobileCardsEl.appendChild(fragment);
  }

  function createCell(text) {
    const td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  function readFileAsText(file, encoding = "utf-8") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || "");
      reader.onerror = () => reject(new Error("read failed"));
      reader.readAsText(file, encoding);
    });
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function toCSV(rows) {
    const header = ["date", "time", "sender", "message"];
    const body = rows.map((r) =>
      [r.date, r.time, r.sender, r.message].map(csvEscape).join(",")
    );
    return [header.join(","), ...body].join("\n");
  }

  function toXML(rows) {
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
    <text>${esc(r.message)}</text>
  </message>`
      )
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>\n<lineTalk>\n${items}\n</lineTalk>\n`;
  }

  function onDownloadCsv() {
    if (!state.records.length) return;
    downloadWithOriginalName(".csv", toCSV(state.records), "text/csv;charset=utf-8;");
  }

  function onDownloadJson() {
    if (!state.records.length) return;
    downloadWithOriginalName(
      ".json",
      JSON.stringify(state.records, null, 2),
      "application/json;charset=utf-8;"
    );
  }

  function onDownloadXml() {
    if (!state.records.length) return;
    downloadWithOriginalName(".xml", toXML(state.records), "application/xml;charset=utf-8;");
  }

  function downloadWithOriginalName(ext, content, mime) {
    const base = getBaseName(state.originalFileName || "line_talk");
    const filename = `${base}${ext}`;
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function getBaseName(name) {
    const idx = name.lastIndexOf(".");
    return idx >= 0 ? name.slice(0, idx) : name;
  }

  function formatFileSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
})();