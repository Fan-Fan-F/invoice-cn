/* 发票开具工具页面逻辑 */
(function () {
  'use strict';

  var lines = [
    { name: '无线蓝牙耳机 Pro', spec: 'ANC 降噪版 黑色', unit: '件', qty: 2, price: 899, rate: 0.13 },
    { name: 'USB-C 数据线', spec: '2m 编织款', unit: '条', qty: 10, price: 39.9, rate: 0.13 },
    { name: '延保服务费', spec: '一年期', unit: '次', qty: 1, price: 200, rate: 0.06 }
  ];

  /* ---------- 编辑区 ---------- */
  function renderEditor() {
    var body = document.getElementById('lines-body');
    body.innerHTML = '';
    lines.forEach(function (l, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input data-k="name" value="' + esc(l.name) + '"></td>' +
        '<td><input data-k="spec" value="' + esc(l.spec) + '"></td>' +
        '<td><input data-k="unit" value="' + esc(l.unit) + '" style="width:52px"></td>' +
        '<td><input data-k="qty" type="number" min="0" step="1" value="' + l.qty + '" style="width:70px"></td>' +
        '<td><input data-k="price" type="number" min="0" step="0.01" value="' + l.price + '" style="width:90px"></td>' +
        '<td><select data-k="rate">' +
        InvoiceEngine.TAX_RATES.map(function (r) {
          return '<option value="' + r.value + '"' + (r.value === l.rate ? ' selected' : '') + '>' + r.label + '</option>';
        }).join('') + '</select></td>' +
        '<td><button class="del-line" title="删除">✕</button></td>';

      tr.querySelectorAll('input, select').forEach(function (el) {
        el.onchange = function () {
          var k = el.dataset.k;
          lines[i][k] = (k === 'qty' || k === 'price' || k === 'rate') ? Number(el.value) : el.value;
        };
      });
      tr.querySelector('.del-line').onclick = function () {
        lines.splice(i, 1);
        renderEditor();
      };
      body.appendChild(tr);
    });
  }

  function esc(s) {
    return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /* ---------- 预览 ---------- */
  function collectInvoice() {
    return {
      buyer: {
        name: val('buyer-name'), taxNo: val('buyer-taxno'),
        addr: val('buyer-addr'), bank: val('buyer-bank')
      },
      seller: {
        name: val('seller-name'), taxNo: val('seller-taxno'),
        addr: val('seller-addr'), bank: val('seller-bank')
      },
      lines: lines
    };
  }

  function val(id) { return document.getElementById(id).value.trim(); }
  function setText(id, t) { document.getElementById(id).textContent = t; }

  function render() {
    var invoice = collectInvoice();
    var errs = InvoiceEngine.validate(invoice);
    var errBox = document.getElementById('errors');
    errBox.innerHTML = errs.map(function (e) { return '<div>' + e + '</div>'; }).join('');

    setText('p-buyer-name', invoice.buyer.name || '—');
    setText('p-buyer-taxno', invoice.buyer.taxNo || '—');
    setText('p-seller-name', invoice.seller.name || '—');
    setText('p-seller-taxno', invoice.seller.taxNo || '—');

    var now = new Date();
    setText('inv-date', now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日');

    var calc = InvoiceEngine.calcInvoice(lines);
    var tbody = document.getElementById('inv-lines');
    tbody.innerHTML = '';
    calc.lines.forEach(function (l) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + esc(l.name || '（未命名商品）') + '</td>' +
        '<td>' + esc(l.spec) + '</td>' +
        '<td>' + esc(l.unit) + '</td>' +
        '<td>' + l.qty + '</td>' +
        '<td>' + InvoiceEngine.toYuan(InvoiceEngine.toFen(l.price)) + '</td>' +
        '<td>' + InvoiceEngine.toYuan(l.amount) + '</td>' +
        '<td>' + Math.round(l.rate * 100) + '%</td>' +
        '<td>' + InvoiceEngine.toYuan(l.tax) + '</td>';
      tbody.appendChild(tr);
    });
    /* 空白补齐到 5 行，贴近真实票样 */
    for (var i = calc.lines.length; i < 5; i++) {
      var empty = document.createElement('tr');
      empty.innerHTML = '<td>&nbsp;</td>'.repeat(8);
      tbody.appendChild(empty);
    }

    setText('inv-sum-amount', '¥' + InvoiceEngine.toYuan(calc.sumAmount));
    setText('inv-sum-tax', '¥' + InvoiceEngine.toYuan(calc.sumTax));
    setText('inv-sum-upper', calc.sumAmountUpper);
    setText('inv-sum-total', '¥' + InvoiceEngine.toYuan(calc.sumTotal));
  }

  document.getElementById('btn-add-line').onclick = function () {
    lines.push({ name: '', spec: '', unit: '件', qty: 1, price: 0, rate: 0.13 });
    renderEditor();
  };
  document.getElementById('btn-preview').onclick = render;
  document.getElementById('btn-print').onclick = function () {
    render();
    window.print();
  };

  renderEditor();
  render();
})();
