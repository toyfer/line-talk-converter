let allRecords = [];
let filteredRecords = [];

const $ = id => document.getElementById(id);

function showToast(msg, isError = false) {
  const toast = $('toast');
  toast.textContent = msg;
  toast.style.backgroundColor = isError ? '#ef4444' : '#10b981';
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2800);
}

$('dropzone').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', e => e.target.files[0] && handleFile(e.target.files[0]));

const dropzone = $('dropzone');
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = '#10b981'; });
dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = '#d1d5db');
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.style.borderColor = '#d1d5db';
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  $('status').innerHTML = '📂 ファイルを読み込んでいます...';
  try {
    const text = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsText(file, $('encoding').value);
    });

    allRecords = LineTalkParser.parse(text);
    filteredRecords = [...allRecords];

    renderStats();
    renderSenderFilter();
    renderPreview();
    $('result').classList.remove('hidden');
    showToast(`${allRecords.length}件のトークを変換しました`);
  } catch (err) {
    showToast('処理中にエラーが発生しました', true);
  }
}

function renderStats() {
  const empty = allRecords.filter(r => !r.date).length;
  const senders = new Set(allRecords.map(r => r.sender)).size;
  $('stats').innerHTML = `
    <div class="bg-white p-6 rounded-3xl shadow text-center"><div class="text-sm text-gray-500">総件数</div><div class="text-4xl font-bold text-emerald-600">${allRecords.length}</div></div>
    <div class="bg-white p-6 rounded-3xl shadow text-center"><div class="text-sm text-gray-500">送信者</div><div class="text-4xl font-bold">${senders}</div></div>
    <div class="bg-white p-6 rounded-3xl shadow text-center"><div class="text-sm text-gray-500">date欠損</div><div class="text-4xl font-bold text-amber-600">${empty}</div></div>
  `;
}

function renderSenderFilter() {
  const select = $('sender-filter');
  select.innerHTML = '<option value="">すべての送信者</option>';
  const senders = [...new Set(allRecords.map(r => r.sender))].sort();
  senders.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });
}

function renderPreview() {
  const tbody = $('table-body');
  tbody.innerHTML = '';

  const cardView = $('card-view');
  cardView.innerHTML = '';

  filteredRecords.forEach(r => {
    // テーブル行
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-emerald-50';
    tr.innerHTML = `<td class="py-5 px-6">${r.date}</td><td class="py-5 px-6">${r.time}</td><td class="py-5 px-6 font-medium">${r.sender}</td><td class="py-5 px-6 whitespace-pre-wrap">${r.message}</td>`;
    tbody.appendChild(tr);

    // カード
    const card = document.createElement('div');
    card.className = 'bg-white border border-gray-100 rounded-3xl p-6 shadow-sm';
    card.innerHTML = `
      <div class="flex justify-between text-sm text-gray-500 mb-3">
        <span>${r.date} ${r.time}</span>
        <span class="bg-emerald-100 text-emerald-700 px-4 py-1 rounded-3xl">${r.sender}</span>
      </div>
      <div class="whitespace-pre-wrap text-gray-700 leading-relaxed">${r.message}</div>
    `;
    cardView.appendChild(card);
  });
}

// フィルタリング
function applyFilter() {
  const keyword = $('search').value.toLowerCase();
  const sender = $('sender-filter').value;

  filteredRecords = allRecords.filter(r => {
    const matchKeyword = !keyword || 
      r.sender.toLowerCase().includes(keyword) || 
      r.message.toLowerCase().includes(keyword);
    const matchSender = !sender || r.sender === sender;
    return matchKeyword && matchSender;
  });

  renderPreview();
}

$('search').addEventListener('input', applyFilter);
$('sender-filter').addEventListener('change', applyFilter);

// ビュー切替
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isTable = btn.dataset.view === 'table';
    $('table-view').classList.toggle('hidden', !isTable);
    $('card-view').classList.toggle('hidden', isTable);
  });
});

// ダウンロード機能
function download(content, filename, type) {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

$('dl-csv').onclick = () => {
  let csv = "date,time,sender,message\n";
  csv += allRecords.map(r => `"${r.date}","${r.time}","${r.sender}","${r.message.replace(/"/g,'""')}"`).join('\n');
  download(csv, 'line_talk.csv', 'text/csv;charset=utf-8;');
};

$('dl-json').onclick = () => download(JSON.stringify(allRecords, null, 2), 'line_talk.json', 'application/json');
$('dl-xml').onclick = () => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<talk>\n';
  allRecords.forEach(r => {
    xml += `  <message date="${r.date}" time="${r.time}" sender="${r.sender}"><![CDATA[${r.message}]]></message>\n`;
  });
  xml += '</talk>';
  download(xml, 'line_talk.xml', 'application/xml');
};

$('dl-txt').onclick = () => {
  let txt = '[LINE] トーク履歴\n\n';
  allRecords.forEach(r => {
    txt += `${r.date} ${r.time} ${r.sender}\n${r.message}\n\n`;
  });
  download(txt, 'line_talk.txt', 'text/plain;charset=utf-8;');
};

showToast('準備完了。トーク履歴.txtをアップロードしてください');