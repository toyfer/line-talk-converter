(function (global) {
  "use strict";

  const PREVIEW_LIMIT = 300;

  function normalizeLineBreaks(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n");
  }

  function normalizeTime(value) {
    const parts = String(value).split(":");
    if (parts.length !== 2) return String(value);
    return `${String(parts[0]).padStart(2, "0")}:${String(parts[1]).padStart(2, "0")}`;
  }

  function normalizeDateFromLine(line) {
    const m = String(line).match(/^(\d{4})\/(\d{2})\/(\d{2})\([^)]+\)$/);
    if (!m) return "";
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  function parseMessageLine(line) {
    // 第一候補: 正式なタブ区切り
    let m = String(line).match(/^(\d{1,2}:\d{2})\t([^\t]+)\t([\s\S]*)$/);
    if (m) {
      return {
        time: normalizeTime(m[1]),
        sender: String(m[2]).trim(),
        message: m[3] ?? ""
      };
    }

    // 第二候補: スペース複数区切りを救済
    m = String(line).match(/^(\d{1,2}:\d{2})\s{2,}(.+?)\s{2,}([\s\S]*)$/);
    if (m) {
      return {
        time: normalizeTime(m[1]),
        sender: String(m[2]).trim(),
        message: m[3] ?? ""
      };
    }

    return null;
  }

  function parse(text) {
    const lines = normalizeLineBreaks(text);
    const records = [];

    let currentDate = "";
    let currentRecord = null;

    for (const raw of lines) {
      const line = String(raw ?? "");
      const trimmed = line.trim();

      if (!trimmed) continue;
      if (trimmed.startsWith("[LINE]")) continue;
      if (trimmed.startsWith("保存日時")) continue;

      const maybeDate = normalizeDateFromLine(trimmed);
      if (maybeDate) {
        currentDate = maybeDate;
        currentRecord = null;
        continue;
      }

      const parsedMessage = parseMessageLine(line);
      if (parsedMessage) {
        currentRecord = {
          date: currentDate,
          time: parsedMessage.time,
          sender: parsedMessage.sender,
          message: parsedMessage.message
        };
        records.push(currentRecord);
        continue;
      }

      // 継続行
      if (currentRecord) {
        currentRecord.message += `\n${line}`;
      }
    }

    return {
      records,
      meta: {
        recordCount: records.length,
        emptyDateCount: records.filter((r) => !r.date).length
      }
    };
  }

  global.LineTalkParser = {
    parse,
    PREVIEW_LIMIT
  };
})(window);