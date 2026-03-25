const LineTalkParser = {
  parse(text) {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const records = [];
    let currentDate = '';
    let lastRecord = null;

    const dateRe = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\(.+\)$/;
    const msgRe = /^(\d{1,2}:\d{2})\s*[\t　]+([^\t　]+?)\s*[\t　]+(.+)$/;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('[LINE]') || line.startsWith('保存日時')) continue;

      const dateMatch = line.match(dateRe);
      if (dateMatch) {
        currentDate = `${dateMatch[1]}-${String(dateMatch[2]).padStart(2,'0')}-${String(dateMatch[3]).padStart(2,'0')}`;
        lastRecord = null;
        continue;
      }

      const msgMatch = raw.match(msgRe);
      if (msgMatch) {
        lastRecord = {
          date: currentDate,
          time: msgMatch[1].padStart(5, '0'),
          sender: msgMatch[2].trim(),
          message: msgMatch[3]
        };
        records.push(lastRecord);
        continue;
      }

      if (lastRecord) {
        lastRecord.message += '\n' + raw;
      }
    }
    return records;
  }
};

window.LineTalkParser = LineTalkParser;