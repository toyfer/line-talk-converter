const $ = (id) => document.getElementById(id);

const fileInput = $("file");
const encodingSelect = $("encoding");
const convertBtn = $("convert");
const downloadCsvBtn = $("downloadCsv");
const downloadJsonBtn = $("downloadJson");
const downloadXmlBtn = $("downloadXml");
const rowsEl = $("rows");
const countEl = $("count");
const filenameEl = $("filename");
const statusEl = $("status");
const previewLimitLabel = $("previewLimitLabel");

const PREVIEW_LIMIT = 500;
previewLimitLabel.textContent = String(PREVIEW_LIMIT);

let records = [];
let originalFileName = "";

convertBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    statusEl.textContent = "ファイルを選択してください";
    return;
  }

  try {
    originalFileName = file.name;
    filenameEl.textContent = originalFileName;

    statusEl.textContent = "読み込み中...";
    const text = await readFileAsText(file, encodingSelect.value);

    statusEl.textContent = "解析中...";
    const t0 = performance.now();
    records = parseLineTalk(text);
    const t1 = performance.now();

    countEl.textContent = String(records.length);
    renderTable(records, PREVIEW_LIMIT);

    statusEl.textContent = `完了: ${records.length}件 (${Math.round(t1 - t0)}ms)`;
  } catch (e) {
    console.error(e);
    statusEl.textContent = "エラー: 読み込みまたは解析に失敗しました";
  }
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

function readFileAsText(file, encoding = "utf-8") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = reject;
    reader.readAsText(file, encoding);
  });
}

/**
 * LINE .txt パース
 * 改善点:
 * - date行の検出を厳密化
 * - 日付なし行/継続行を安全に処理
 * - time sender message が揃う行のみ新規レコード
 */
function parseLineTalk(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // 例: 2021/02/22(月) / 2021/02/22(Mon) 等
  const dateRe = /^(\d{4})\/(\d{2})\/(\d{2})\([^)]+\)$/;
  // 例: 11:19\tme\tこんにちは
  const msgRe = /^(\d{1,2}:\d{2})\t([^\t]+)\t([\s\S]*)$/;

  const result = [];
  let currentDate = "";
  let lastRecord = null;

  for (let raw of lines) {
    const line = raw ?? "";
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (trimmed.startsWith("[LINE]")) continue;
    if (trimmed.startsWith("保存日時")) continue;

    const d = trimmed.match(dateRe);
    if (d) {
      currentDate = `${d[1]}-${d[2]}-${d[3]}`; // ISO寄りで保持
      continue;
    }

    const m = line.match(msgRe);
    if (m) {
      const rec = {
        date: currentDate || "",
        time: normalizeTime(m[1]),
        sender: m[2].trim(),
        message: m[3] ?? ""
      };
      result.push(rec);
      lastRecord = rec;
      continue;
    }

    // 継続行（複数行メッセージ）として連結
    if (lastRecord) {
      lastRecord.message += "\n" + line;
    }
  }

  return result;
}

function normalizeTime(t) {
  // 1:05 -> 01:05
  const [h, m] = t.split(":");
  return `${String(h).padStart(2, "0")}:${m}`;
}

function renderTable(data, limit = 500) {
  rowsEl.innerHTML = "";
  if (!data.length) {
    rowsEl.innerHTML = `<tr><td colspan="4" class="empty">データがありません</td></tr>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  const max = Math.min(limit, data.length);

  for (let i = 0; i < max; i++) {
    const r = data[i];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.time)}</td>
      <td>${escapeHtml(r.sender)}</td>
      <td>${escapeHtml(r.message)}</td>
    `;
    fragment.appendChild(tr);
  }

  rowsEl.appendChild(fragment);
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
  // "abc.txt" -> "abc"
  return name.replace(/\.[^/.]+$/, "");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c];
  });
}