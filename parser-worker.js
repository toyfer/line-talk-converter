function normalizeLineBreaks(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
}

function normalizeDate(dateLine) {
  const m = String(dateLine).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\([^)]+\)$/);
  if (!m) return "";
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function normalizeTime(time) {
  const m = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return String(time || "");
  return `${String(m[1]).padStart(2, "0")}:${m[2]}`;
}

function detectType(message) {
  const m = String(message || "").trim();
  if (/^\[(スタンプ|写真|画像|動画|ファイル|URL|音声|位置情報|連絡先)\]$/.test(m)) return m.slice(1, -1);
  if (/^https?:\/\//i.test(m)) return "url";
  return "text";
}

function parse(text) {
  const lines = normalizeLineBreaks(text);
  const records = [];

  let currentDate = "";
  let lastRecord = null;

  for (const rawLine of lines) {
    const line = String(rawLine ?? "");
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (trimmed.startsWith("[LINE]")) continue;
    if (trimmed.startsWith("保存日時")) continue;

    const maybeDate = normalizeDate(trimmed);
    if (maybeDate) {
      currentDate = maybeDate;
      lastRecord = null;
      continue;
    }

    let m = line.match(/^(\d{1,2}:\d{2})\t([^\t]+)\t([\s\S]*)$/);
    if (!m) {
      m = line.match(/^(\d{1,2}:\d{2})\s{2,}(.+?)\s{2,}([\s\S]*)$/);
    }

    if (m) {
      const message = m[3] ?? "";
      lastRecord = {
        date: currentDate,
        time: normalizeTime(m[1]),
        sender: m[2].trim(),
        message,
        type: detectType(message)
      };
      records.push(lastRecord);
      continue;
    }

    if (lastRecord) {
      lastRecord.message += `\n${line}`;
    }
  }

  const emptyDateCount = records.filter((r) => !r.date).length;
  const senderCount = new Set(records.map((r) => r.sender).filter(Boolean)).size;
  const specialCount = records.filter((r) => r.type && r.type !== "text").length;
  const dates = records.map((r) => r.date).filter(Boolean).sort();
  const dateRange = dates.length ? `${dates[0]} ～ ${dates[dates.length - 1]}` : "";

  return {
    records,
    meta: {
      recordCount: records.length,
      emptyDateCount,
      senderCount,
      specialCount,
      dateRange
    }
  };
}

self.onmessage = (event) => {
  try {
    const { text } = event.data || {};
    const result = parse(text);
    self.postMessage({
      ok: true,
      records: result.records,
      meta: result.meta
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error?.message || "解析に失敗しました"
    });
  }
};