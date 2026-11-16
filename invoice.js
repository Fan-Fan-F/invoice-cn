/* 增值税发票计算引擎（纯逻辑）
 *
 * 核心规则：
 * - 金额（不含税）= 单价 × 数量，保留两位小数（四舍五入到分）
 * - 税额 = 金额 × 税率，四舍五入到分
 * - 价税合计 = 金额 + 税额
 * - 合计行 = 各明细行之和（在分位累加，避免浮点误差 → 全程用"分"整数运算）
 */
(function (global) {
  'use strict';

  var TAX_RATES = [
    { value: 0.13, label: '13%（货物）' },
    { value: 0.09, label: '9%（运输/农产品）' },
    { value: 0.06, label: '6%（服务）' },
    { value: 0.01, label: '1%（小规模征收率）' },
    { value: 0, label: '0%（免税）' }
  ];

  /* 元 → 分 */
  function toFen(yuan) {
    return Math.round(yuan * 100);
  }

  /* 分 → 元（字符串，两位小数） */
  function toYuan(fen) {
    return (fen / 100).toFixed(2);
  }

  /* 计算单行明细 */
  function calcLine(line) {
    var qty = Number(line.qty) || 0;
    var price = Number(line.price) || 0;
    var rate = Number(line.rate);
    if (isNaN(rate)) rate = 0.13;
    var amount = toFen(qty * price);                    // 金额（不含税），分
    var tax = Math.round(amount * rate);                // 税额，分
    return {
      name: line.name || '',
      spec: line.spec || '',
      unit: line.unit || '件',
      qty: qty,
      price: price,
      rate: rate,
      amount: amount,
      tax: tax,
      total: amount + tax
    };
  }

  /* 计算整张发票 */
  function calcInvoice(lines) {
    var computed = lines.map(calcLine);
    var sumAmount = 0, sumTax = 0;
    computed.forEach(function (l) {
      sumAmount += l.amount;
      sumTax += l.tax;
    });
    return {
      lines: computed,
      sumAmount: sumAmount,
      sumTax: sumTax,
      sumTotal: sumAmount + sumTax,
      sumAmountUpper: toUpperMoney(sumAmount + sumTax)
    };
  }

  /* 人民币大写金额转换（分 → 大写） */
  var DIGITS = '零壹贰叁肆伍陆柒捌玖';
  var INT_UNITS = ['', '拾', '佰', '仟'];
  var GROUP_UNITS = ['', '万', '亿', '兆'];

  function fourToUpper(num) {
    /* 4 位以内整数转大写，返回 { text, hasZero } */
    var s = '';
    var zero = false;
    var str = String(num);
    for (var i = 0; i < str.length; i++) {
      var d = Number(str[i]);
      var unit = INT_UNITS[str.length - 1 - i];
      if (d === 0) {
        zero = true;
      } else {
        if (zero) s += '零';
        s += DIGITS[d] + unit;
        zero = false;
      }
    }
    return s;
  }

  function toUpperMoney(fen) {
    if (fen === 0) return '零元整';
    var yuan = Math.floor(fen / 100);
    var jiao = Math.floor((fen % 100) / 10);
    var fenDigit = fen % 10;

    var intPart = '';
    if (yuan > 0) {
      var groups = [];
      var n = yuan;
      while (n > 0) {
        groups.push(n % 10000);
        n = Math.floor(n / 10000);
      }
      var result = '';
      var needZero = false;
      for (var g = groups.length - 1; g >= 0; g--) {
        if (groups[g] === 0) {
          needZero = true;
          continue;
        }
        var seg = fourToUpper(groups[g]);
        /* 低位组不足 4 位且非最高组时，前面补零 */
        if (needZero || (result && groups[g] < 1000)) {
          if (result && result[result.length - 1] !== '零') result += '零';
        }
        result += seg + GROUP_UNITS[g];
        needZero = false;
      }
      intPart = result + '元';
    }

    if (jiao === 0 && fenDigit === 0) {
      return intPart ? intPart + '整' : '零元整';
    }
    var decPart = '';
    if (jiao > 0) decPart += DIGITS[jiao] + '角';
    else if (yuan > 0 && fenDigit > 0) decPart += '零';
    if (fenDigit > 0) decPart += DIGITS[fenDigit] + '分';
    return intPart + decPart;
  }

  /* 校验：返回错误信息数组 */
  function validateInvoice(invoice) {
    var errs = [];
    if (!invoice.buyer || !invoice.buyer.name) errs.push('购买方名称不能为空');
    if (!invoice.seller || !invoice.seller.name) errs.push('销售方名称不能为空');
    if (invoice.buyer && invoice.buyer.taxNo && !/^[0-9A-Z]{15,20}$/.test(invoice.buyer.taxNo)) {
      errs.push('购买方税号格式不正确（15-20 位数字或大写字母）');
    }
    if (invoice.seller && invoice.seller.taxNo && !/^[0-9A-Z]{15,20}$/.test(invoice.seller.taxNo)) {
      errs.push('销售方税号格式不正确（15-20 位数字或大写字母）');
    }
    if (!invoice.lines || !invoice.lines.length) {
      errs.push('至少需要一行商品明细');
    } else {
      invoice.lines.forEach(function (l, i) {
        if (!l.name) errs.push('第 ' + (i + 1) + ' 行：商品名称不能为空');
        if (!(Number(l.qty) > 0)) errs.push('第 ' + (i + 1) + ' 行：数量必须大于 0');
        if (!(Number(l.price) > 0)) errs.push('第 ' + (i + 1) + ' 行：单价必须大于 0');
      });
    }
    return errs;
  }

  global.InvoiceEngine = {
    TAX_RATES: TAX_RATES,
    calcLine: calcLine,
    calcInvoice: calcInvoice,
    toUpperMoney: toUpperMoney,
    toYuan: toYuan,
    toFen: toFen,
    validate: validateInvoice
  };
})(window);
