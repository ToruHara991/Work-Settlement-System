/* 工作結算書系統 本機版 — 「合併輸出」Excel 產生器
 * 原系統的制式範本存放在公司伺服器，本機版依前端送出的計算結果重新排版，
 * 欄位與金額與系統畫面一致，但版面為近似格式。
 */
(function () {
  const FONT = "標楷體";
  const thin = { style: "thin", color: { rgb: "000000" } };
  const BORDER = { top: thin, bottom: thin, left: thin, right: thin };
  const ST = {
    title: { font: { name: FONT, sz: 16, bold: true }, alignment: { horizontal: "center", vertical: "center" } },
    sub: { font: { name: FONT, sz: 12 }, alignment: { horizontal: "center", vertical: "center" } },
    th: { font: { name: FONT, sz: 11, bold: true }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: BORDER, fill: { fgColor: { rgb: "EDEDED" } } },
    td: { font: { name: FONT, sz: 11 }, alignment: { vertical: "center", wrapText: true }, border: BORDER },
    tdc: { font: { name: FONT, sz: 11 }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: BORDER },
    num: { font: { name: FONT, sz: 11 }, alignment: { horizontal: "right", vertical: "center" }, border: BORDER },
    bold: { font: { name: FONT, sz: 11, bold: true }, alignment: { vertical: "center", wrapText: true }, border: BORDER },
    boldnum: { font: { name: FONT, sz: 11, bold: true }, alignment: { horizontal: "right", vertical: "center" }, border: BORDER },
    text: { font: { name: FONT, sz: 11 }, alignment: { vertical: "top", wrapText: true } },
    sign: { font: { name: FONT, sz: 11 }, alignment: { horizontal: "left", vertical: "center" } },
  };
  const n = (v) => {
    if (typeof v === "number") return v;
    const x = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
    return isNaN(x) ? 0 : x;
  };
  const rnd = (v, d = 0) => Math.round((Number(v) || 0) * 10 ** d) / 10 ** d;
  const fmt = (d) => (d > 0 ? "#,##0." + "0".repeat(d) : "#,##0");
  const roc = (p, k) => (p[k + "Y"] ? `${p[k + "Y"]} 年 ${p[k + "M"]} 月 ${p[k + "D"]} 日` : "　　年　　月　　日");

  /* 簡易版面產生器：逐列放入儲存格 */
  function Sheet(cols) {
    this.rows = [];
    this.merges = [];
    this.cols = cols.map((w) => ({ wch: w }));
    this.heights = [];
  }
  Sheet.prototype.row = function (cells, height) {
    const r = this.rows.length;
    const out = [];
    let c = 0;
    cells.forEach((cell) => {
      if (cell == null) cell = { v: "" };
      if (typeof cell !== "object") cell = { v: cell };
      const span = cell.span || 1;
      out[c] = cell;
      for (let k = 1; k < span; k++) out[c + k] = { v: "", s: cell.s };
      if (span > 1) this.merges.push({ s: { r, c }, e: { r, c: c + span - 1 } });
      c += span;
    });
    this.rows.push(out);
    if (height) this.heights[r] = { hpt: height };
    return this;
  };
  Sheet.prototype.blank = function (h) { return this.row([{ v: "", s: {} }], h); };
  Sheet.prototype.build = function (XLSX) {
    const ws = {};
    let maxC = 0;
    this.rows.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (!cell) return;
        const addr = XLSX.utils.encode_cell({ r, c });
        const isNum = typeof cell.v === "number";
        ws[addr] = { v: isNum ? cell.v : String(cell.v ?? ""), t: isNum ? "n" : "s", s: cell.s || ST.td };
        if (isNum && cell.z) ws[addr].z = cell.z;
        maxC = Math.max(maxC, c);
      });
    });
    ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(this.rows.length - 1, 0), c: Math.max(maxC, this.cols.length - 1) } });
    ws["!merges"] = this.merges;
    ws["!cols"] = this.cols;
    ws["!rows"] = this.heights;
    ws["!margins"] = { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 };
    // 列印縮放：wide=一頁寬、tall=一頁高、其餘縮為單頁
    const fit = this.fit || "page";
    ws["!pageSetup"] = { paperSize: "9", orientation: this.landscape ? "landscape" : "portrait",
      fitToWidth: fit === "tall" ? "0" : "1", fitToHeight: fit === "wide" ? "0" : "1" };
    return ws;
  };
  const T = (v, span, s = ST.td) => ({ v: v ?? "", span, s });
  const N = (v, span = 1, d = 0, s = ST.num) => ({ v: rnd(n(v), d), span, s, z: fmt(d) });

  function header(sh, title, p, width) {
    sh.row([T("台灣自來水股份有限公司" + (p.officeArea || ""), width, ST.sub)], 20);
    sh.row([T(title, width, ST.title)], 28);
  }
  function infoRow(sh, a, av, b, bv, spans) {
    const [s1, s2, s3, s4] = spans;
    sh.row([T(a, s1, ST.th), T(av, s2), T(b, s3, ST.th), T(bv, s4)], 22);
  }

  /* 1. 竣工計價單（含保固保證金計算表） */
  function docInvoice(p, XLSX) {
    const sh = new Sheet([16, 16, 14, 16, 16, 18]);
    header(sh, "竣工計價單", p, 6);
    infoRow(sh, "工程名稱", p.contractName, "採購案號", p.contractNo, [1, 3, 1, 1]);
    infoRow(sh, "契約編號", p.projNo, "驗收批次", `第 ${p.vacBatch || ""} 批`, [1, 3, 1, 1]);
    infoRow(sh, "施工廠商", p.vendorName, "契約地點", p.projLocation, [1, 3, 1, 1]);
    infoRow(sh, "承辦單位", `${p.officeArea || ""} ${p.handlingUnit || ""}`, "作業方式", p.workMethod, [1, 3, 1, 1]);
    infoRow(sh, "實際開工日期", roc(p, "actualDateStart"), "實際竣工日期", roc(p, "dateEnd"), [1, 2, 1, 2]);
    sh.row([T("項目", 3, ST.th), T("說明", 2, ST.th), T("金額（元）", 1, ST.th)], 22);
    const line = (a, desc, v, bold) => sh.row([T(a, 3, bold ? ST.bold : ST.td), T(desc || "", 2), N(v, 1, 0, bold ? ST.boldnum : ST.num)], 22);
    line("發包部份預算價額（含稅）", "", p.budgetAmt);
    line("契約價額（含稅）", "", p.latestContractAmt || p.contractAmt);
    line("變更設計應增（含稅）　A", p.dsgnIncDesc, p.dsgnIncAmt);
    line("變更設計應減（含稅）　B", p.dsgnDecDesc, p.dsgnDecAmt);
    line("變更設計淨計　C＝A－B", "", p.dsgnNetAmt);
    line("結算實做應增（含稅）　D", p.addDedIncDesc, p.addDedIncAmt);
    line("結算實做應減（含稅）　E", p.addDedDecDesc, p.addDedDecAmt);
    line("物價調整指數　F", "", p.addDedPriceAdj);
    line("結算實做淨計　G＝D－E＋F", "", p.addDedNetAmt);
    line("結算價款（含營業稅）　H", "", p.settleAmt, true);
    line("以前實發（估驗款）　I", "", p.prevPaid);
    line("本次應發（含營業稅）　J＝H＋C＋G－I", "", p.nextPayable, true);
    line("扣款：逾期違約金", "", p.逾期違約金);
    line("扣款：其他違約金", "", p.其他違約金);
    line("扣款：其他扣款", "", p.otherDedTotal);
    line("保固金", "", p.warrantyAmt);
    line("扣款小計（含保固金）", "", p.dedSubtotal);
    line("本次實發（含營業稅）", "", p.actualAmt, true);
    sh.row([T("付款金額", 3, ST.bold), T("工程款", 1, ST.tdc), T("營業稅", 1, ST.tdc), T("合計", 1, ST.tdc)], 22);
    sh.row([T("", 3), N(p.payEngAmt), N(p.payTaxAmt), N(p.payTotal, 1, 0, ST.boldnum)], 22);
    sh.blank(10);
    sh.row([T("保固保證金計算表", 6, { ...ST.title, font: { name: FONT, sz: 13, bold: true } })], 22);
    sh.row([T("保固項目", 2, ST.th), T("保固年限", 1, ST.th), T("結算價款（含稅）", 1, ST.th), T("保固金比例", 1, ST.th), T("保固金", 1, ST.th)], 22);
    const alloc = p.warrantyAllocation || {};
    const types = [["CLSM", "CLSM 控制性低強度回填材料", "5 年"], ["AC、PC", "AC 瀝青混凝土、PC 混凝土", "3 年"], ["管線", "自來水管埋設工程", "2 年"]];
    let wsum = 0;
    types.forEach(([k, label, yrs]) => {
      const amt = n(alloc[k]);
      const w = Math.round(amt * 0.03);
      wsum += w;
      sh.row([T(label, 2), T(yrs, 1, ST.tdc), N(amt), T("3%", 1, ST.tdc), N(w)], 22);
    });
    sh.row([T("合計", 2, ST.bold), T("", 1), N(p.settleAmt, 1, 0, ST.boldnum), T("", 1), N(p.warrantyAmt || wsum, 1, 0, ST.boldnum)], 22);
    sh.blank(10);
    sh.row([T("承辦人：", 2, ST.sign), T("主管：", 2, ST.sign), T("機關首長：", 2, ST.sign)], 36);
    return sh.build(XLSX);
  }

  /* 2. 結算總(明細)表 */
  function docSummary(p, XLSX, range) {
    const d = n(p.settleDigits) || 2;
    const sh = new Sheet([7, 34, 7, 11, 13, 15, 11, 15]);
    sh.fit = "wide";
    header(sh, "工作結算總（明細）表", p, 8);
    sh.row([T(`工程名稱：${p.contractName}　　採購案號：${p.contractNo}　　驗收批次：第 ${p.vacBatch || ""} 批`, 8, ST.sign)], 20);
    sh.row([T("項次", 1, ST.th), T("項目及說明", 1, ST.th), T("單位", 1, ST.th), T("契約數量", 1, ST.th), T("單價", 1, ST.th), T("契約複價", 1, ST.th), T("結算數量", 1, ST.th), T("結算金額", 1, ST.th)], 30);
    const cw = {};
    (p.contractWorkItems || []).forEach((it) => (cw[it.名稱] = it));
    const item = (no, name, unit, price, qty, amt) => {
      const c = cw[name] || {};
      if (range === "nonzero" && !n(amt)) return;
      if (range === "subtotal") return;
      sh.row([T(no, 1, ST.tdc), T(name), T(unit, 1, ST.tdc), N(c.設計數量, 1, 2), N(price, 1, 2), N(c.複價, 1, d), N(qty, 1, 2), N(amt, 1, d)], 20);
    };
    const section = (no, name, contractAmt, settleAmt) =>
      sh.row([T(no, 1, ST.bold), T(name, 1, ST.bold), T("式", 1, ST.tdc), T("", 1), T("", 1), contractAmt == null ? T("", 1) : N(contractAmt, 1, d, ST.boldnum), T("", 1), N(settleAmt, 1, d, ST.boldnum)], 20);
    const lineSimple = (no, name, contractAmt, settleAmt) =>
      sh.row([T(no, 1, ST.tdc), T(name), T("式", 1, ST.tdc), T("1", 1, ST.tdc), T("", 1), N(contractAmt, 1, d), T("1", 1, ST.tdc), N(settleAmt, 1, d)], 20);
    const amtOf = (it) => n(it.qty) * n(it.unitPrice);
    const cSum = (list) => (list || []).reduce((a, it) => a + n((cw[it.name] || {}).複價), 0);

    section("（一）", "作業費(項目)", p.constContractAmt, p.constTotal);
    (p.constItems || []).forEach((it, i) => item(p.contractItemNoMode ? it.契約項次 : i + 1, it.名稱, it.單位, it.單價, it.結算數量, it.結算金額));
    section("（二）", "污染防治費", p.pollContractAmt, p.pollTotal);
    (p.pollItems || []).forEach((it, i) => item(p.contractItemNoMode ? it.contractItemNo : i + 1, it.name, it.unit, it.unitPrice, it.qty, amtOf(it)));
    section("（三）", "職業安全衛生費", n(p.safeItemsContractAmt) + n(p.otherSafeContractAmt), p.safeSectionTotal);
    (p.safeItems || []).forEach((it, i) => item(p.contractItemNoMode ? it.contractItemNo : i + 1, it.name, it.unit, it.unitPrice, it.qty, amtOf(it)));
    if (!p.noOtherSafe) lineSimple("", "其他安全衛生設施及作業費", p.otherSafeContractAmt, p.otherSafeCalcTotal);
    if (!p.noMaterialTransport) section("（四）", "材料運什費", p.materialTransportContractAmt, p.materialTransportTotal);
    section("（五）", "工程用水費", cSum(p.waterItems), p.waterTotal);
    (p.waterItems || []).forEach((it, i) => item(p.contractItemNoMode ? it.contractItemNo : i + 1, it.name, it.unit, it.unitPrice, it.qty, amtOf(it)));
    section("（六）", "包商利潤及什費", p.profitContractAmt, p.profitTotal);
    section("（七）", "品質管制作業費", n(p.qcContractAmt) + cSum(p.qcItems), p.qcSectionTotal);
    lineSimple("", "品管費", p.qcContractAmt, p.qcTotal);
    if (!p.noMaterialSection) (p.qcItems || []).forEach((it, i) => item(p.contractItemNoMode ? it.contractItemNo : i + 1, it.name, it.unit, it.unitPrice, it.qty, amtOf(it)));
    section("（八）", "承商管理及工程保險補助費", p.insureContractAmt, p.insureTotal);
    if (!p.noInspection) {
      section("（九）", "工程查核及參獎補助費", cSum(p.inspectionItems), p.inspectionTotal);
      (p.inspectionItems || []).forEach((it, i) => item(p.contractItemNoMode ? it.contractItemNo : i + 1, it.name, it.unit, it.unitPrice, it.qty, amtOf(it)));
    }
    const adj = n(p.headOfficeAdjust);
    sh.row([T("", 1, ST.bold), T("壹、施工費　小計" + (adj ? `（總處調整 ${adj > 0 ? "+" : ""}${adj}）` : ""), 4, ST.bold), N(p.contractConstSubtotal, 1, 0, ST.boldnum), T("", 1), N(p.grand, 1, 0, ST.boldnum)], 22);
    sh.row([T("", 1, ST.bold), T("營業稅（5%）", 4, ST.bold), N(p.contractTax, 1, 0, ST.boldnum), T("", 1), N(p.tax, 1, 0, ST.boldnum)], 22);
    sh.row([T("", 1, ST.bold), T("總　計", 4, ST.bold), N(p.contractWithTax, 1, 0, ST.boldnum), T("", 1), N(p.withTax, 1, 0, ST.boldnum)], 22);
    sh.blank(10);
    sh.row([T("製表：", 3, ST.sign), T("覆核：", 3, ST.sign), T("主管：", 2, ST.sign)], 36);
    return sh.build(XLSX);
  }

  /* 3. 施工數量結算明細表 */
  function docQuantity(p, XLSX) {
    const cq = p.constructionQuantity || { columns: [], sections: [], total: {} };
    const cols = cq.columns || [];
    const d = n(p.settleDigits) || 2;
    const sh = new Sheet([7, 30, 7, 11, 11, 13, ...cols.map(() => 12)]);
    const W = 6 + cols.length;
    sh.fit = "tall";
    sh.landscape = true;
    header(sh, "施工數量結算明細表", p, W);
    sh.row([T(`工程名稱：${p.contractName}　　採購案號：${p.contractNo}　　驗收批次：第 ${p.vacBatch || ""} 批`, W, ST.sign)], 20);
    sh.row([T("項次", 1, ST.th), T("名稱", 1, ST.th), T("單位", 1, ST.th), T("單價", 1, ST.th), T("結算數量", 1, ST.th), T("結算金額", 1, ST.th),
      ...cols.map((c) => T(`${c.number}\n${c.label}`, 1, ST.th))], 36);
    (cq.sections || []).forEach((sec) => {
      sh.row([T(sec.number, 1, ST.bold), T(sec.name, 4, ST.bold), N(sec.subtotalAmount, 1, d, ST.boldnum), ...(sec.subtotalColumnAmounts || []).map((v) => N(v, 1, d, ST.boldnum))], 20);
      (sec.items || []).forEach((it) =>
        sh.row([T(it.sequence, 1, ST.tdc), T(it.name), T(it.unit, 1, ST.tdc), N(it.unitPrice, 1, 2), N(it.quantity, 1, 2), N(it.amount, 1, d),
          ...(it.columnQuantities || []).map((q) => (q == null ? T("", 1) : N(q, 1, 2)))], 20));
    });
    const t = cq.total || {};
    sh.row([T("", 1, ST.bold), T("合　計", 4, ST.bold), N(t.amount, 1, d, ST.boldnum), ...(t.columnAmounts || []).map((v) => N(v, 1, d, ST.boldnum))], 22);
    return sh.build(XLSX);
  }

  /* 4. 工作結算驗收證明書 */
  function docCertificate(p, XLSX) {
    const sh = new Sheet([18, 22, 18, 22]);
    header(sh, "工作結算驗收證明書", p, 4);
    const r = (a, av, b, bv) => sh.row([T(a, 1, ST.th), T(av), T(b, 1, ST.th), T(bv)], 26);
    const r1 = (a, av) => sh.row([T(a, 1, ST.th), T(av, 3)], 26);
    r1("工程名稱", p.contractName);
    r("採購案號", p.contractNo, "契約編號", p.projNo);
    r1("工程地點", p.projLocation);
    r1("施工廠商", p.vendorName);
    r("採購級距", p.procurementLevel, "契約變更次數", p.contractChangeTimes);
    r("契約價額（含稅）", n(p.latestContractAmt || p.contractAmt).toLocaleString(), "結算價款（含稅）", n(p.settleAmt).toLocaleString());
    r("原限開工日期", roc(p, "dateStart"), "原限竣工日期", roc(p, "predDateEnd"));
    r("實際開工日期", roc(p, "actualDateStart"), "實際竣工日期", roc(p, "dateEnd"));
    r("履約期限", `${p.contractPeriod || ""} ${p.contractPeriodType || ""}`, "實際工作日數", p.actualWorkDays);
    r("履約有無逾期", p.overdueStatus, "逾期天數", p.overdueTotal);
    r("初驗日期", p.noFirstInspection ? "無初驗程序" : roc(p, "firstInspectionDate"), "驗收日期", roc(p, "acceptDateStart"));
    r("驗收完畢日期", roc(p, "acceptDateEnd"), "驗收批次", `第 ${p.vacBatch || ""} 批`);
    r("驗收奉准日", roc(p, "dateApproved"), "字號", p.vacAreaNo);
    sh.row([T("驗收結果", 1, ST.th), T("□ 符合　□ 不符合（說明：　　　　　　　　　　）", 3)], 40);
    sh.blank(10);
    sh.row([T("主驗人員：", 2, ST.sign), T("會驗人員：", 2, ST.sign)], 36);
    sh.row([T("協驗人員：", 2, ST.sign), T("監驗人員：", 2, ST.sign)], 36);
    return sh.build(XLSX);
  }

  /* 5. 合約執行管制表 */
  function docControl(p, XLSX) {
    const sh = new Sheet([7, 12, 9, 15, 13, 15, 15, 13, 15, 15, 11]);
    sh.landscape = true;
    header(sh, "合約執行管制表", p, 11);
    const amt = n(p.latestContractAmt || p.contractAmt);
    sh.row([T(`工程名稱：${p.contractName}　　採購案號：${p.contractNo}　　契約價額（含稅）：${amt.toLocaleString()}`, 11, ST.sign)], 20);
    sh.row([T("項次", 1, ST.th), T("驗收批次", 1, ST.th), T("案件數", 1, ST.th), T("本期施工費", 1, ST.th), T("本期營業稅", 1, ST.th), T("本期小計", 1, ST.th),
      T("累計施工費", 1, ST.th), T("累計營業稅", 1, ST.th), T("累計小計", 1, ST.th), T("餘額", 1, ST.th), T("進度百分比", 1, ST.th)], 30);
    let cc = 0, ct = 0;
    (p.contractBatches || []).forEach((b, i) => {
      const c = n(b.作業費小計), t = n(b.營業稅);
      cc = rnd(cc + c, 2); ct = rnd(ct + t, 2);
      const cum = rnd(cc + ct, 2);
      sh.row([T(i + 1, 1, ST.tdc), T(b.驗收批次 ? `第 ${b.驗收批次} 次` : "", 1, ST.tdc), N(b.案件數量), N(c), N(t), N(c + t), N(cc), N(ct), N(cum), N(amt - cum),
        T(amt ? `${(Math.round((cum / amt) * 1000) / 10).toFixed(1)}%` : "", 1, ST.tdc)], 22);
    });
    return sh.build(XLSX);
  }

  /* 6~8. 驗收類紀錄 */
  function docRecord(p, XLSX, title, kind) {
    const sh = new Sheet([18, 22, 18, 22]);
    header(sh, title, p, 4);
    const r = (a, av, b, bv) => sh.row([T(a, 1, ST.th), T(av), T(b, 1, ST.th), T(bv)], 26);
    const r1 = (a, av, h = 26) => sh.row([T(a, 1, ST.th), T(av, 3)], h);
    r1("工程名稱", p.contractName);
    r("採購案號", p.contractNo, "契約編號", p.projNo);
    r1("施工廠商", p.vendorName);
    r1("工程地點", p.projLocation);
    r("契約價額（含稅）", n(p.latestContractAmt || p.contractAmt).toLocaleString(), "結算價款（含稅）", n(p.settleAmt).toLocaleString());
    r("實際開工日期", roc(p, "actualDateStart"), "實際竣工日期", roc(p, "dateEnd"));
    if (kind === "first") r1("初驗日期", p.noFirstInspection ? "無初驗程序" : roc(p, "firstInspectionDate"));
    else r("驗收日期", roc(p, "acceptDateStart"), "驗收完畢日期", roc(p, "acceptDateEnd"));
    r("驗收批次", `第 ${p.vacBatch || ""} 批`, "案件數量", p.caseCount);
    r1(kind === "report" ? "驗收經過" : "紀錄內容", "", 90);
    r1(kind === "first" ? "初驗結果" : "驗收結果", "□ 符合契約規定　□ 與契約規定不符，限期改善", 40);
    sh.blank(10);
    sh.row([T("主驗（持）人員：", 2, ST.sign), T("會驗人員：", 2, ST.sign)], 36);
    sh.row([T("協驗人員：", 2, ST.sign), T("廠商代表：", 2, ST.sign)], 36);
    return sh.build(XLSX);
  }

  /* 9. 工作保固切結書 */
  function docWarranty(p, XLSX, separate) {
    const sh = new Sheet([10, 34, 12, 18, 18]);
    header(sh, "工作保固切結書", p, 5);
    const alloc = p.warrantyAllocation || {};
    const types = [["CLSM", "CLSM 控制性低強度回填材料", 5], ["AC、PC", "AC 瀝青混凝土、PC 混凝土", 3], ["管線", "自來水管埋設工程", 2]];
    const endDate = (yrs) => (p.dateEndY ? `${n(p.dateEndY) + yrs} 年 ${p.dateEndM} 月 ${p.dateEndD} 日` : "");
    const text = `立切結書人 ${p.vendorName || "　　　　"}（以下簡稱本廠商）承攬「${p.contractName}」（採購案號：${p.contractNo}）第 ${p.vacBatch || ""} 批工作，業經驗收合格，` +
      `本廠商願依契約規定負保固責任，保固期間自驗收合格之日起算，保固期間內如有損壞或瑕疵，本廠商願無條件負責修復，絕無異議。`;
    sh.row([T(text, 5, ST.text)], 80);
    sh.row([T("項次", 1, ST.th), T("保固項目", 1, ST.th), T("保固年限", 1, ST.th), T("結算價款（含稅）", 1, ST.th), T("保固期限至（參考）", 1, ST.th)], 24);
    let i = 0;
    const used = types.filter(([k]) => n(alloc[k]) > 0);
    (used.length ? used : [types[2]]).forEach(([k, label, yrs]) => {
      i++;
      sh.row([T(i, 1, ST.tdc), T(label), T(`${yrs} 年`, 1, ST.tdc), N(alloc[k] ?? p.settleAmt), T(endDate(yrs), 1, ST.tdc)], 24);
    });
    if (separate) sh.row([T("※ 不同保固年限工項分開列印", 5, ST.sign)]);
    sh.blank(16);
    sh.row([T("此致", 5, ST.sign)]);
    sh.row([T(`台灣自來水股份有限公司${p.officeArea || ""}`, 5, ST.sign)]);
    sh.blank(16);
    sh.row([T(`立切結書人（廠商）：${p.vendorName || ""}`, 5, ST.sign)], 22);
    sh.row([T(`負責人：${p.vendorOwner || ""}`, 5, ST.sign)], 22);
    sh.row([T(`地址：${p.vendorAddr || ""}`, 5, ST.sign)], 22);
    sh.row([T(`電話：${p.vendorPhone || ""}`, 5, ST.sign)], 22);
    sh.blank(16);
    sh.row([T("中　華　民　國　　　　年　　　　月　　　　日", 5, ST.sub)], 24);
    return sh.build(XLSX);
  }

  // 對應前端文件清單（1 起算）
  const DOCS = {
    1: ["竣工計價單", (p, X) => docInvoice(p, X)],
    2: ["結算總(明細)表", (p, X) => docSummary(p, X, "all")],
    3: ["結算總(明細)表", (p, X) => docSummary(p, X, "nonzero")],
    4: ["結算總(明細)表", (p, X) => docSummary(p, X, "subtotal")],
    5: ["施工數量結算明細表", (p, X) => docQuantity(p, X)],
    6: ["工作結算驗收證明書", (p, X) => docCertificate(p, X)],
    7: ["合約執行管制表", (p, X) => docControl(p, X)],
    8: ["初驗紀錄", (p, X) => docRecord(p, X, "初驗紀錄", "first")],
    9: ["工作驗收報告", (p, X) => docRecord(p, X, "工作驗收報告", "report")],
    10: ["驗收紀錄", (p, X) => docRecord(p, X, "驗收紀錄", "record")],
    11: ["工作保固切結書", (p, X) => docWarranty(p, X, false)],
    12: ["工作保固切結書", (p, X) => docWarranty(p, X, true)],
  };

  self.ExportDocs = {
    build(payload, book, XLSX) {
      const p = payload || {};
      const idx = p.mergedDocIndexes && p.mergedDocIndexes.length ? p.mergedDocIndexes : [1, 3, 5, 6, 7, 8, 9, 10, 11];
      const wb = XLSX.utils.book_new();
      const used = {};
      idx.forEach((i) => {
        const d = DOCS[i];
        if (!d) return;
        let name = d[0];
        used[name] = (used[name] || 0) + 1;
        if (used[name] > 1) name += used[name];
        XLSX.utils.book_append_sheet(wb, d[1](p, XLSX), name.replace(/[\\/?*\[\]:]/g, "").slice(0, 31));
      });
      return XLSX.write(wb, { type: "array", bookType: "xlsx" });
    },
  };
})();
