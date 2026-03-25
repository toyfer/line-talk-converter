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

const PREVIEW_LIMIT = 500;
previewLimitLabel.textContent = String(PREVIEW_LIMIT);

let records = [];
let filteredRecords = [];
let originalFileName = "";

convertBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    setStatus("ファイルを選択してください");
    return;
  }

  try {
    originalFileName = file.name;
    filenameEl.textContent = `${file.name} (${formatFileSize(file.size)})`;

    setStatus("読み込み中...");
    const text = await readFileAsText(file, encodingSelect.value);

    setStatus("解析中...");
    records = parseLineTalk(text);
    filteredRecords = [...records];

    const emptyDateCount = records.filter((r) => !r.date).length;
    countEl.textContent = String(records.length);
    emptyDateCountEl.textContent = String(emptyDateCount);

    renderAll(filteredRecords);

    setDownloadEnabled(records.length > 0);

    if (records.length === 0) {
      setStatus("メッセージを検出できませんでした");
    } else if (emptyDateCount > 0) {
      setStatus(`完了: ${records.length}件（date空 ${emptyDateCount}件）`);
    } else {
      setStatus(`完了: ${records.length}件`);
    }
  } catch (e) {
    console.error(e);
    setStatus("エラー: 読み込みまたは解析に失敗しました");
  }
});

searchEl.addEventListener("input", () => {
  const keyword = searchEl.value.trim().toLowerCase();

  if (!keyword) {
    filteredRecords = [...records];
  } else {
    filteredRecords = records.filter((r) => {
      return (
        r.sender.toLowerCase().includes(keyword) ||
        r.message.toLowerCase().includes(keyword) ||
        r.date.toLowerCase().includes(keyword)
      );
    });
  }

  renderAll(filteredRecords);
});

downloadCsvBtn.addEventListener("click", () => {
  if (!records.length) return;
  const csv = toCSV(records);
  downloadWithOriginalName(".csv", csv, "text/csv;charset=utf-8;");
});

downloadJsonBtn.addEventListener("click", () => {
  if (!records.length) return;
  const json = JSON.stringify(records, null, 2);
  downloadWithOriginalName(".json", json, "application/json;charset=utf-8;");
});

downloadXmlBtn.addEventListener("click", () => {
  if (!records.length) return;
  const xml = toXML(records);
  downloadWithOriginalName(".xml", xml, "application/xml;charset=utf-8;");
});

function setStatus(text) {
  statusEl.textContent = text;
}

function setDownloadEnabled(enabled) {
  [downloadCsvBtn, downloadJsonBtn, downloadXmlBtn].forEach((btn) => {
    btn.disabled = !enabled;
  });
}

function readFileAsText(file, encoding = "utf-8") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsText(file, encoding);
  });
}

function parseLineTalk(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const records = [];

  // 日付行だけが単独で現れ、その後のメッセージに適用される
  const dateLineRe = /^(\d{4})\/(\d{2})\/(\d{2})\([^)]+\)$/;
  const messageLineRe = /^(\d{1,2}:\d{2})\t([^\t]+)\t([\s\S]*)$/;

  let currentDate = "";
  let currentRecord = null;

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (trimmed.startsWith("[LINE]")) continue;
    if (trimmed.startsWith("保存日時")) continue;

    const dateMatch = trimmed.match(dateLineRe);
    if (dateMatch) {
      currentDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
      currentRecord = null;
      continue;
    }

    const msgMatch = line.match(messageLineRe);
    if (msgMatch) {
      currentRecord = {
        date: currentDate,
        time: normalizeTime(msgMatch[1]),
        sender: msgMatch[2].trim(),
        message: msgMatch[3] ?? ""
      };
      records.push(currentRecord);
      continue;
    }

    if (currentRecord) {
      currentRecord.message += "\n" + line;
    }
  }

  return records;
}

function normalizeTime(t) {
  const [h, m] = t.split(":");
  return `${String(h).padStart(2, "0")}:${m}`;
}

function renderAll(data) {
  renderTable(data, PREVIEW_LIMIT);
  renderMobileCards(data, PREVIEW_LIMIT);
}

function renderTable(data, limit = 500) {
  rowsEl.innerHTML = "";

  if (!data.length) {
    rowsEl.innerHTML = `<tr><td colspan="4" class="empty">該当データがありません</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  const max = Math.min(limit, data.length);

  for (let i = 0; i < max; i++) {
    const r = data[i];
    const tr = document.createElement("tr");

    tr.appendChild(createCell(r.date));
    tr.appendChild(createCell(r.time));
    tr.appendChild(createCell(r.sender));
    tr.appendChild(createCell(r.message));

    fragment.appendChild(tr);
  }

  rowsEl.appendChild(fragment);
}

function createCell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "";
  return td;
}

function renderMobileCards(data, limit = 500) {
  mobileCardsEl.innerHTML = "";

  if (!data.length) {
    mobileCardsEl.innerHTML = `<div class="mobile-empty">該当データがありません</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  const max = Math.min(limit, data.length);

  for (let i = 0; i < max; i++) {
    const r = data[i];
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

function toCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["date", "time", "sender", "message"];
  const body = rows.map((r) =>
    [r.date, r.time, r.sender, r.message].map(esc).join(",")
  );
  return [header.join(","), ...body].join("\n");
}

function toXML(rows) {
  const xmlEsc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const items = rows
    .map(
      (r) => `  <message>
    <date>${xmlEsc(r.date)}</date>
    <time>${xmlEsc(r.time)}</time>
    <sender>${xmlEsc(r.sender)}</sender>
    <text>${xmlEsc(r.message)}</text>
  </message>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<lineTalk>\n${items}\n</lineTalk>\n`;
}

function downloadWithOriginalName(ext, content, mime) {
  const base = getBaseName(originalFileName || "line_talk");
  const filename = `${base}${ext}`;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function getBaseName(name) {
  return name.replace(/\.[^/.]+$/, "");
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}