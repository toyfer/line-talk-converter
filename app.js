// app.js
const fileInput = document.getElementById("file");
const convertBtn = document.getElementById("convert");
const tbody = document.getElementById("rows");
const downloadCsvBtn = document.getElementById("downloadCsv");

let records = [];

convertBtn.addEventListener("click", async () => {
  const file = fileInput.files?.[0];
  if (!file) return alert("txtファイルを選択してください");

  const text = await readFileAsText(file, "utf-8");
  records = parseLineTalk(text);
  renderTable(records);
});

downloadCsvBtn.addEventListener("click", () => {
  if (!records.length) return;
  const csv = toCsv(records);
  downloadText("line_talk_converted.csv", csv, "text/csv;charset=utf-8;");
});

function readFileAsText(file, encoding = "utf-8") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, encoding);
  });
}

function parseLineTalk(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let currentDate = "";
  let last = null;

  const dateRe = /^\d{4}\/\d{2}\/\d{2}\(.+\)$/;
  const msgRe = /^(\d{2}:\d{2})\t([^\t]+)\t([\s\S]*)$/;

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith("[LINE]") || line.startsWith("保存日時")) continue;

    if (dateRe.test(line)) {
      currentDate = line.slice(0, 10); // YYYY/MM/DD
      continue;
    }

    const m = line.match(msgRe);
    if (m) {
      const rec = {
        date: currentDate,
        time: m[1],
        sender: m[2],
        message: m[3]
      };
      out.push(rec);
      last = rec;
    } else if (last) {
      // 改行継続行
      last.message += "\n" + line;
    }
  }

  return out;
}

function toCsv(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["date", "time", "sender", "message"];
  const body = rows.map(r => [r.date, r.time, r.sender, r.message].map(esc).join(","));
  return [header.join(","), ...body].join("\n");
}

function renderTable(rows) {
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.time)}</td>
      <td>${escapeHtml(r.sender)}</td>
      <td>${escapeHtml(r.message)}</td>
    </tr>
  `).join("");
}

function downloadText(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}