/* 工作結算書系統 — 網頁測試版模擬後端（在頁面內執行）
 * 攔截頁面對 /api/* 的請求，資料存在瀏覽器 IndexedDB。
 * 不需要另外安裝伺服器程式或資料庫。
 */
const SW_VERSION = "local-1.0.0";

const AREAS = {"總管理處": ["總管理處"], "第一區管理處": ["第一區管理處", "基隆服務所", "淡水營運所", "瑞芳營運所", "汐止營運所", "萬里金山營運所", "文山營運所", "貢寮雙溪營運所"], "第二區管理處": ["第二區管理處", "桃園服務所", "中壢服務所", "楊梅服務所", "龜山服務所", "大溪服務所", "大園服務所"], "第三區管理處": ["第三區管理處", "新竹服務所", "竹東營運所", "苗栗營運所", "竹南頭份營運所", "通霄銅鑼營運所", "湖口營運所", "竹北營運所"], "第四區管理處": ["第四區管理處", "台中服務所", "大里服務所", "霧峰營運所", "豐原服務所", "東勢營運所", "清水營運所", "大甲營運所", "烏日營運所", "沙鹿營運所", "大雅營運所"], "第五區管理處": ["第五區管理處", "嘉義服務所", "朴子服務所", "義竹服務所", "北港營運所", "斗南服務所", "台西營運所", "斗六服務所", "西螺服務所", "古坑營運所", "虎尾服務所", "新港營運所", "竹崎營運所", "民雄營運所"], "第六區管理處": ["第六區管理處", "台南服務所", "新市服務所", "歸仁服務所", "白河營運所", "佳里服務所", "新營營運所", "玉井營運所", "麻豆營運所", "永康服務所"], "第七區管理處": ["第七區管理處", "高雄服務所", "鳳山服務所", "路竹服務所", "岡山服務所", "楠梓服務所", "旗山營運所", "澎湖營運所", "美濃營運所"], "第八區管理處": ["第八區管理處", "宜蘭北區服務所", "宜蘭南區服務所"], "第九區管理處": ["第九區管理處", "花蓮服務所", "吉安壽豐服務所", "鳳林營運所", "玉里營運所"], "第十區管理處": ["第十區管理處", "台東營運所", "池上營運所", "成功營運所", "太麻里營運所"], "第十一區管理處": ["第十一區管理處", "草屯營運所", "南投營運所", "埔里營運所", "竹山營運所", "水里營運所", "彰化服務所", "北斗營運所", "員林營運所", "二水營運所", "鹿港營運所", "二林營運所", "溪湖營運所", "花壇營運所"], "第十二區管理處": ["第十二區管理處", "板橋服務所", "新莊服務所", "蘆洲服務所", "樹林服務所", "鶯歌服務所", "泰山營運所", "林口服務所", "土城服務所"], "屏東區管理處": ["屏東區管理處", "屏東營運所", "東港營運所", "恆春營運所", "高樹營運所", "潮州營運所"], "測試區處": ["測試區處", "測試A營運所", "測試B營運所"]};
const HQ = "總管理處";
const DEFAULT_PASSWORD = "1234";


/* ---------------- IndexedDB ---------------- */
const STORES = ["configs", "books", "sources", "support", "kv", "issues", "logs"];
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open("work-settlement-local", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      STORES.forEach((s) => d.objectStoreNames.contains(s) || d.createObjectStore(s));
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => (out = v));
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
  });
}
const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const get = (store, key) => tx(store, "readonly", (s) => reqP(s.get(key)));
const put = (store, key, val) => tx(store, "readwrite", (s) => reqP(s.put(val, key)));
const del = (store, key) => tx(store, "readwrite", (s) => reqP(s.delete(key)));
const all = (store) => tx(store, "readonly", (s) => reqP(s.getAll()));
const allKeys = (store) => tx(store, "readonly", (s) => reqP(s.getAllKeys()));
const clear = (store) => tx(store, "readwrite", (s) => reqP(s.clear()));

/* ---------------- 工具 ---------------- */
const today = () => new Date().toLocaleDateString("zh-TW");
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
const err = (status, msg) => json({ error: msg, detail: msg }, status);
const num = (v) => {
  if (typeof v === "number") return v;
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
};
const r2 = (v, d = 2) => Math.round((Number(v) || 0) * 10 ** d) / 10 ** d;
const rocDate = (o) => (o && o.y && o.m && o.d ? `${o.y}/${String(o.m).padStart(2, "0")}/${String(o.d).padStart(2, "0")}` : "");
const rocToIso = (o) => (o && o.y && o.m && o.d ? `${Number(o.y) + 1911}-${String(o.m).padStart(2, "0")}-${String(o.d).padStart(2, "0")}` : "");
// "2026/11/20" (toLocaleDateString zh-TW) -> Date
const parseLocal = (s) => {
  if (!s) return null;
  const m = String(s).match(/(\d{3,4})\D(\d{1,2})\D(\d{1,2})/);
  if (!m) return null;
  let y = Number(m[1]);
  if (y < 1911) y += 1911;
  return new Date(y, Number(m[2]) - 1, Number(m[3]));
};
const isoOf = (d) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "");
const rocMonth = (d) => (d ? `${d.getFullYear() - 1911}/${String(d.getMonth() + 1).padStart(2, "0")}` : "");

async function session() {
  return (await get("kv", "session")) || null;
}
const isHQ = (s) => s && s.officeArea === HQ;
const isArea = (s) => s && s.officeArea && s.officeArea === s.handlingUnit && !isHQ(s);
function canSee(s, area, unit) {
  if (!s) return false;
  if (isHQ(s)) return true;
  if (isArea(s)) return area === s.officeArea;
  return area === s.officeArea && unit === s.handlingUnit;
}
const isOwner = (s, area, unit) => s && area === s.officeArea && unit === s.handlingUnit;
const cfgOwner = (c) => [(c.契約書 || {}).辦理區處, (c.契約書 || {}).承辦單位];
const bookOwner = (b) => {
  const u = (b._meta || {}).建立單位 || {};
  return [u.辦理區處 || (b.契約書 || {}).辦理區處, u.承辦單位 || (b.契約書 || {}).承辦單位];
};
async function log(action, detail = "") {
  const s = await session();
  const id = Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  await put("logs", id, {
    id, time: new Date().toLocaleString("zh-TW"), action, detail,
    officeArea: s?.officeArea || "", handlingUnit: s?.handlingUnit || "",
  });
}

/* ---------------- 入口 ---------------- */
window.LocalAPI = {
  async handle(req) {
    const url = new URL(req.url);
    try { return await handle(req, url); }
    catch (e) { console.error("[本機後端]", e); return err(500, "本機後端發生錯誤：" + (e && e.message ? e.message : e)); }
  },
};

async function body(req) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("multipart/form-data")) return req.formData();
  const t = await req.text();
  if (!t) return {};
  try { return JSON.parse(t); } catch { return {}; }
}

async function handle(req, url) {
  const path = decodeURIComponent(url.pathname.replace(/^\/api/, ""));
  const m = req.method;
  const q = Object.fromEntries(url.searchParams.entries());
  const seg = path.split("/").filter(Boolean);
  const s = await session();

  /* ---- 不需登入 ---- */
  if (path === "/data-collector/download") {
    const r = await fetch(window.__BASE + "downloads/" + encodeURIComponent("結算案件收集器.zip"));
    if (!r.ok) return err(404, "找不到擴充功能壓縮檔");
    return new Response(await r.blob(), { headers: { "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent("結算案件收集器.zip") } });
  }
  if (path === "/online") return json({ count: 1 });
  if (path === "/auth/session") return s ? json(s) : err(401, "尚未登入");
  if (path === "/auth/login" && m === "POST") {
    const { officeArea, handlingUnit, password } = await body(req);
    if (!AREAS[officeArea] || !AREAS[officeArea].includes(handlingUnit)) return err(400, "辦理區處或承辦單位不正確");
    const pw = (await get("kv", "passwords")) || {};
    const rec = pw[`${officeArea}|${handlingUnit}`];
    if ((rec ? rec.password : DEFAULT_PASSWORD) !== password) return err(401, "密碼錯誤");
    const sess = { officeArea, handlingUnit, loginAt: new Date().toISOString() };
    await put("kv", "session", sess);
    const stats = (await get("kv", "loginStats")) || {};
    const k = `${officeArea}|${handlingUnit}`;
    stats[k] = (stats[k] || 0) + 1;
    await put("kv", "loginStats", stats);
    await log("登入");
    return json(sess);
  }
  if (path === "/auth/logout") {
    await log("登出");
    await del("kv", "session");
    return json({ ok: true });
  }

  if (!s) return err(401, "尚未登入或登入已逾時");

  /* ---- 密碼 ---- */
  if (path === "/auth/password" && m === "POST") {
    const { oldPassword, newPassword } = await body(req);
    const pw = (await get("kv", "passwords")) || {};
    const k = `${s.officeArea}|${s.handlingUnit}`;
    if ((pw[k] ? pw[k].password : DEFAULT_PASSWORD) !== oldPassword) return err(400, "原密碼錯誤");
    if (!newPassword) return err(400, "新密碼不可空白");
    pw[k] = { password: newPassword, updatedAt: new Date().toLocaleString("zh-TW") };
    await put("kv", "passwords", pw);
    return json({ ok: true });
  }
  if (path === "/auth/passwords" && m === "GET") {
    const pw = (await get("kv", "passwords")) || {};
    return json(Object.entries(pw).map(([k, v]) => {
      const [officeArea, handlingUnit] = k.split("|");
      return { officeArea, handlingUnit, updatedAt: v.updatedAt };
    }));
  }
  if (path === "/auth/passwords/reset" && m === "POST") {
    if (!isHQ(s)) return err(403, "僅總管理處可重設密碼");
    const { officeArea, handlingUnit, newPassword } = await body(req);
    const pw = (await get("kv", "passwords")) || {};
    const k = `${officeArea}|${handlingUnit}`;
    if (!newPassword || newPassword === DEFAULT_PASSWORD) delete pw[k];
    else pw[k] = { password: newPassword, updatedAt: new Date().toLocaleString("zh-TW") };
    await put("kv", "passwords", pw);
    return json({ ok: true });
  }

  /* ---- 契約書設定檔 ---- */
  if (seg[0] === "local" && seg[1] === "configs") return configs(req, m, seg, q, s);
  if (seg[0] === "local" && seg[1] === "books") return books(req, m, seg, q, s);
  if (seg[0] === "local" && seg[1] === "support-contracts") return support(req, m, seg, s);
  if (seg[0] === "statistics") return statistics(seg[1], q, s);

  /* ---- 匯出 ---- */
  if (seg[0] === "export" && seg[2] === "merged" && m === "POST") {
    const payload = await body(req);
    const book = await get("books", seg[1]);
    const fmt = payload.format || "xlsx";
    if (fmt === "pdf") {
      return err(400, "此版本不支援直接產生 PDF。請下載 xlsx 後，以 Excel「另存新檔 → PDF」。");
    }
    const bytes = window.ExportDocs.build(payload, book, window.XLSX);
    await log("轉檔", `${seg[1]} ${fmt}`);
    return new Response(bytes, {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  }

  /* ---- 問題回報 ---- */
  if (path === "/issue-report" && m === "POST") {
    const fd = await body(req);
    const id = Date.now().toString();
    const rec = { id, reportedAt: new Date().toLocaleString("zh-TW"), officeArea: s.officeArea, handlingUnit: s.handlingUnit, files: [] };
    if (fd instanceof FormData) {
      for (const [k, v] of fd.entries()) {
        if (v instanceof Blob) rec.files.push({ name: v.name || k, blob: v });
        else rec[k] = v;
      }
    }
    await put("issues", id, rec);
    return json({ ok: true, id });
  }
  if (path === "/issue-report" && m === "GET") {
    const list = (await all("issues")).map(({ files, ...r }) => ({ ...r, fileCount: (files || []).length }));
    return json(list.reverse());
  }
  if (seg[0] === "issue-report" && seg[2] === "download") {
    const rec = await get("issues", seg[1]);
    if (!rec) return err(404, "找不到資料");
    const { files, ...info } = rec;
    return new Response(JSON.stringify(info, null, 2), {
      headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="issue_${seg[1]}.json"` },
    });
  }

  /* ---- 管理功能（本機版簡化） ---- */
  if (path === "/login-stats") {
    const st = (await get("kv", "loginStats")) || {};
    return json(Object.entries(AREAS).map(([area, units]) => ({
      area,
      loginCount: units.reduce((a, u) => a + (st[`${area}|${u}`] || 0), 0),
      units: units.map((u) => ({ unit: u, name: u, handlingUnit: u, loginCount: st[`${area}|${u}`] || 0 })),
    })));
  }
  if (path === "/system-log" && m === "GET") {
    const logs = (await all("logs")).reverse();
    const page = Number(q.page || 1), size = Number(q.pageSize || 50);
    return json({
      items: logs.slice((page - 1) * size, page * size),
      total: logs.length,
      actions: [...new Set(logs.map((l) => l.action))].map((a) => ({ code: a, label: a, category: "一般" })),
      categories: [{ code: "一般", label: "一般" }],
    });
  }
  if (path === "/system-log/export.csv") {
    const logs = (await all("logs")).reverse();
    const csv = "﻿時間,辦理區處,承辦單位,動作,內容\r\n" +
      logs.map((l) => [l.time, l.officeArea, l.handlingUnit, l.action, l.detail].map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="system-log.csv"' } });
  }
  if (path === "/system-log/contract-export") {
    const b = await body(req);
    await log("匯出契約書", `${b.filename || ""} ${b.format || ""}`);
    return json({ ok: true });
  }
  if (seg[0] === "raw-configs") return json(seg.length > 2 ? {} : []);
  if (path === "/server-update/check")
    return json({ behind: 0, localCommit: SW_VERSION, output: "此版本不提供線上更新。", buildOutput: "" });
  if (path === "/server-update/export-db") return json({ commit: "", pushed: false, exportOutput: "此版本請使用畫面右下角「資料備份」。" });
  if (seg[0] === "server-update") return json({ ok: true, output: "此版本不提供此功能。" });

  /* ---- 本機版專用：備份 / 還原 ---- */
  if (path === "/_local/backup" && m === "GET") {
    const out = { app: "工作結算書系統-本機版", version: SW_VERSION, exportedAt: new Date().toISOString() };
    for (const st of ["configs", "books", "support"]) {
      const keys = await allKeys(st);
      out[st] = {};
      for (const k of keys) out[st][k] = await get(st, k);
    }
    out.passwords = (await get("kv", "passwords")) || {};
    return new Response(JSON.stringify(out), {
      headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="backup.json"' },
    });
  }
  if (path === "/_local/restore" && m === "POST") {
    const data = await body(req);
    if (!data || data.app !== "工作結算書系統-本機版") return err(400, "不是本系統的備份檔");
    for (const st of ["configs", "books", "support"]) {
      await clear(st);
      for (const [k, v] of Object.entries(data[st] || {})) await put(st, k, v);
    }
    if (data.passwords) await put("kv", "passwords", data.passwords);
    return json({ ok: true });
  }

  return err(404, `本機版尚未支援：${m} ${path}`);
}

/* ---------------- 契約書 ---------------- */
async function visibleConfigs(s) {
  return (await all("configs")).filter((c) => canSee(s, ...cfgOwner(c)));
}
async function configs(req, m, seg, q, s) {
  const fn = seg[2];
  if (!fn && m === "GET") {
    const list = await visibleConfigs(s);
    if (q.support) {
      const sup = ((await get("support", key(s))) || []);
      for (const x of sup) {
        const c = (await all("configs")).find((c) => (c.契約書 || {}).採購案號 === x.purchase_no);
        if (c && !list.includes(c)) list.push({ ...c, _support: true });
      }
    }
    return json(list);
  }
  if (!fn && m === "POST") {
    const b = await body(req);
    const 契約書 = b.契約書 || {};
    const pn = 契約書.採購案號;
    if (!pn) return err(400, "缺少採購案號");
    const others = await all("configs");
    const dup = others.find((c) => (c.契約書 || {}).採購案號 === pn && c._filename !== b._filename);
    if (dup) return err(409, "此採購案號已存在對應的契約設定檔，請修改採購案號後再儲存");
    let filename = b._filename;
    let old = filename ? await get("configs", filename) : null;
    if (!old) filename = `${pn}_契約書設定檔.json`;
    const rec = { ...(old || {}), ...b, _filename: filename };
    if (!b.變更設計) delete rec.變更設計;
    if (old && old._sourceName && !b._sourceName) rec._sourceName = old._sourceName;
    await put("configs", filename, rec);
    await log(old ? "修改契約書" : "新增契約書", pn);
    return json(rec);
  }
  const c = fn ? await get("configs", fn) : null;
  if (seg[3] === "source") {
    if (m === "PUT") {
      const fd = await body(req);
      const f = fd.get("file");
      await put("sources", "config:" + fn, { name: f.name || "source", blob: f });
      if (c) { c._sourceName = f.name || "source"; await put("configs", fn, c); }
      return json({ sourceName: f.name || "source" });
    }
    const src = await get("sources", "config:" + fn);
    if (!src) return err(404, "找不到原始檔");
    return new Response(src.blob, { headers: { "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(src.name) } });
  }
  if (!c) return err(404, "找不到契約書設定檔");
  if (seg[3] === "budget-prices" && m === "PUT") {
    const b = await body(req);
    const items = (c.契約書.工項 || []);
    items.forEach((it, i) => {
      it.預算單價 = (b.預算單價 || [])[i] ?? null;
      it.預算複價 = (b.預算複價 || [])[i] ?? null;
    });
    await put("configs", fn, c);
    return json(c);
  }
  if (m === "PUT") {
    const b = await body(req);
    const rec = { ...c, ...b, _filename: fn };
    await put("configs", fn, rec);
    return json(rec);
  }
  if (m === "DELETE") {
    const pn = (c.契約書 || {}).採購案號;
    const used = (await all("books")).some((b) => (b.契約書 || {}).採購案號 === pn);
    if (used) return err(409, "此契約已被結算書使用，不可移除");
    await del("configs", fn);
    await del("sources", "config:" + fn);
    await log("移除契約書", pn);
    return json({ ok: true });
  }
  if (m === "GET") return json(c);
  return err(405, "不支援的操作");
}

/* ---------------- 結算書 ---------------- */
const key = (s) => `${s.officeArea}|${s.handlingUnit}`;
function bookSums(b) {
  const cases = [...(b.當期結算 || []), ...(b.二次結算 || [])];
  const sumList = (l) => (Array.isArray(l) ? l.reduce((a, x) => a + num(x.結算金額), 0) : num(l));
  const 金額 = (b.結算書 || {}).金額 || {};
  return {
    施工費結算金額: num((金額.大類 || {}).作業費項目),
    物料費結算金額: r2(cases.reduce((a, c) => a + sumList(c.物料檔), 0)),
    路修費結算金額: r2(cases.reduce((a, c) => a + sumList(c.路修費), 0)),
    結算價款含稅: num(金額.結算價款含稅),
    本次實發: num(金額.本次實發),
  };
}
async function bookVisibility(s, b, cfgByPn) {
  const [ba, bu] = bookOwner(b);
  if (canSee(s, ba, bu)) return "full";
  const cfg = cfgByPn[(b.契約書 || {}).採購案號];
  if (cfg && canSee(s, ...cfgOwner(cfg))) return "full"; // 別人在本單位契約上建立的結算書
  const sup = (await get("support", key(s))) || [];
  if (sup.some((x) => x.purchase_no === (b.契約書 || {}).採購案號)) return "summary";
  return null;
}
async function cfgMap() {
  const o = {};
  (await all("configs")).forEach((c) => (o[(c.契約書 || {}).採購案號] = c));
  return o;
}
async function books(req, m, seg, q, s) {
  const fn = seg[2];
  if (fn === "summary" && m === "GET") {
    const cm = await cfgMap();
    const out = [];
    for (const b of await all("books")) {
      if (!(await bookVisibility(s, b, cm))) continue;
      const k = b.契約書 || {};
      out.push({ _filename: b._filename, 辦理區處: k.辦理區處, 承辦單位: k.承辦單位, 契約年度: k.契約年度, 合約名稱: k.合約名稱, 採購案號: k.採購案號, 驗收批次: (b._meta || {}).驗收批次 });
    }
    return json(out);
  }
  if (fn === "index" && m === "GET") {
    return json((await all("books")).map((b) => ({
      _filename: b._filename,
      採購案號: (b.契約書 || {}).採購案號,
      驗收批次: (b._meta || {}).驗收批次 ?? ((b.結算書 || {}).驗收 || {}).驗收批次,
      受理案件: [...(b.當期結算 || []), ...(b.二次結算 || [])].map((c) => c.受理資料 || {}),
    })));
  }
  if (!fn && m === "GET") {
    const cm = await cfgMap();
    const out = [];
    for (const b of await all("books")) {
      if (q.purchase_no && (b.契約書 || {}).採購案號 !== q.purchase_no) continue;
      const v = await bookVisibility(s, b, cm);
      if (v === "full") out.push(b);
      else if (v === "summary")
        out.push({ _filename: b._filename, _summaryOnly: true, _meta: b._meta, _reviewStatus: b._reviewStatus, _reviewedAt: b._reviewedAt,
          _createdAt: b._createdAt, _updatedAt: b._updatedAt, _displayOrder: b._displayOrder, 契約書: b.契約書, 結算書: b.結算書, 金額摘要: bookSums(b) });
    }
    out.sort((a, b) => (a._displayOrder ?? 1e9) - (b._displayOrder ?? 1e9));
    return json(out);
  }
  if (!fn && m === "POST") {
    const b = await body(req);
    const pn = (b.契約書 || {}).採購案號 || (b._meta || {}).採購案號 || "未命名";
    const batch = (b._meta || {}).驗收批次 ?? ((b.結算書 || {}).驗收 || {}).驗收批次;
    let filename = b._filename;
    let old = filename ? await get("books", filename) : null;
    if (!old) {
      // 結算書以「採購案號＋驗收批次」識別
      const same = (await all("books")).find((x) =>
        (x.契約書 || {}).採購案號 === pn && String((x._meta || {}).驗收批次 ?? "") === String(batch ?? ""));
      if (same && !b._updatedAt) return err(409, `採購案號 ${pn} 第 ${batch} 批的結算書已存在，請修改「驗收批次」後再儲存`);
      if (same) { old = same; filename = same._filename; }
      else filename = `${pn}_${batch ? `第${batch}批_` : ""}${Date.now()}.json`;
    }
    const rec = { ...(old || {}), ...b, _filename: filename };
    rec._meta = { ...(b._meta || {}) };
    rec._meta.建立單位 = (old && old._meta && old._meta.建立單位) || { 辦理區處: s.officeArea, 承辦單位: s.handlingUnit };
    rec._createdAt = (old && old._createdAt) || today();
    if (old) {
      if (old._reviewStatus !== undefined && b._reviewStatus === undefined) rec._reviewStatus = old._reviewStatus;
      if (!b._updatedAt && old._updatedAt) rec._updatedAt = old._updatedAt;
      if (b._updatedAt === "" && !("_displayOrder" in b && Object.keys(b).length < 5)) rec._updatedAt = today();
    }
    await put("books", filename, rec);
    if (!old) await log("新增結算書", filename);
    return json(rec);
  }
  const b = fn ? await get("books", fn) : null;
  if (seg[3] === "source") {
    if (m === "PUT") {
      const fd = await body(req);
      const f = fd.get("file");
      await put("sources", "book:" + fn, { name: f.name || "source.json", blob: f });
      if (b) { b._sourceName = f.name || "source.json"; await put("books", fn, b); }
      return json({ sourceName: f.name || "source.json" });
    }
    const src = await get("sources", "book:" + fn);
    if (!src) return err(404, "找不到原始檔");
    return new Response(src.blob, { headers: { "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(src.name) } });
  }
  if (seg[3] === "review" && m === "PUT") {
    if (!b) return json({ ok: false });
    const { status } = await body(req);
    b._reviewStatus = status || "";
    b._reviewedAt = status ? today() : "";
    await put("books", fn, b);
    await log("審查結算書", `${fn} ${status || "清除"}`);
    return json({ ok: true });
  }
  if (!b) return err(404, "找不到結算書");
  if (m === "DELETE") {
    await del("books", fn);
    await del("sources", "book:" + fn);
    await log("移除結算書", fn);
    return json({ ok: true });
  }
  if (m === "GET") return json(b);
  return err(405, "不支援的操作");
}

/* ---------------- 跨區支援 ---------------- */
async function support(req, m, seg, s) {
  const k = key(s);
  const list = (await get("support", k)) || [];
  if (seg[2] === "candidates") {
    return json((await all("configs"))
      .filter((c) => !isOwner(s, ...cfgOwner(c)))
      .filter((c) => !list.some((x) => x.purchase_no === c.契約書.採購案號))
      .map((c) => ({ purchase_no: c.契約書.採購案號, project_name: c.契約書.合約名稱, office_area: c.契約書.辦理區處, handling_unit: c.契約書.承辦單位, contract_year: c.契約書.契約年度 })));
  }
  if (m === "GET") {
    const cm = await cfgMap();
    const bs = await all("books");
    return json(list.map((x) => {
      const c = cm[x.purchase_no];
      const k2 = c ? c.契約書 : null;
      return {
        purchase_no: x.purchase_no, created_at: x.created_at,
        project_name: k2 ? k2.合約名稱 : "", office_area: k2 ? k2.辦理區處 : "", handling_unit: k2 ? k2.承辦單位 : "",
        contract_year: k2 ? k2.契約年度 : "", vendor_name: k2 ? (k2.廠商 || {}).名稱 : "",
        book_count: bs.filter((b) => (b.契約書 || {}).採購案號 === x.purchase_no && isOwner(s, ...bookOwner(b))).length,
        deleted: !c,
      };
    }));
  }
  if (m === "POST") {
    const { purchase_no } = await body(req);
    if (!list.some((x) => x.purchase_no === purchase_no)) list.push({ purchase_no, created_at: today() });
    await put("support", k, list);
    return json({ ok: true });
  }
  if (m === "DELETE") {
    await put("support", k, list.filter((x) => x.purchase_no !== seg[2]));
    return json({ ok: true });
  }
  return err(405, "不支援的操作");
}

/* ---------------- 統計 ---------------- */
async function scopedBooks(s) {
  const cm = await cfgMap();
  const out = [];
  for (const b of await all("books")) {
    // 統計計入契約所屬單位
    const cfg = cm[(b.契約書 || {}).採購案號];
    const [a, u] = cfg ? cfgOwner(cfg) : bookOwner(b);
    if (canSee(s, a, u)) out.push(b);
  }
  return out;
}
function dateOk(d, from, to) {
  if (!from && !to) return true;
  if (!d) return false;
  const iso = isoOf(d);
  return (!from || iso >= from) && (!to || iso <= to);
}
function basisDate(b, basis) {
  if (basis === "created") return parseLocal(b._createdAt);
  if (basis === "reviewed") return parseLocal(b._reviewedAt);
  return parseLocal(b._updatedAt || b._createdAt);
}
function filterBooks(list, q) {
  return list.filter((b) => {
    if (q.officeArea && (b.契約書 || {}).辦理區處 !== q.officeArea) return false;
    if (q.purchaseNo && (b.契約書 || {}).採購案號 !== q.purchaseNo) return false;
    if (q.contractYear && (b.契約書 || {}).契約年度 !== q.contractYear) return false;
    if (!dateOk(parseLocal(b._createdAt), q.createdFrom, q.createdTo)) return false;
    if (!dateOk(parseLocal(b._updatedAt || b._createdAt), q.updatedFrom, q.updatedTo)) return false;
    if (!dateOk(parseLocal(b._reviewedAt), q.reviewedFrom, q.reviewedTo)) return false;
    if (q.workFrom || q.workTo) {
      const 工期 = (b.結算書 || {}).工期 || {};
      const st = rocToIso(工期.實際開工日期), en = rocToIso(工期.實際竣工日期);
      if (q.workFrom && (!st || st < q.workFrom)) return false;
      if (q.workTo && (!en || en > q.workTo)) return false;
    }
    return true;
  });
}
const CAT_KEYS = ["作業費項目", "污染防治費", "職業安全衛生費項目", "工程用水費", "品質管制", "工程查核及參獎補助費"];
function bookItems(b) {
  const 工項 = (((b.結算書 || {}).明細 || {}).工項) || {};
  const pn = (b.契約書 || {}).採購案號;
  const remarkOf = {};
  ((b.契約書 || {}).工項 || []).forEach((it) => { if (it.備註) remarkOf[`${it.名稱}|${it.單位}`] = it.備註; });
  const out = [];
  CAT_KEYS.forEach((cat) => (工項[cat] || []).forEach((it) => {
    const qty = num(it.結算數量);
    if (!qty && !num(it.結算金額)) return;
    out.push({ purchaseNo: pn, category: cat, name: it.名稱 || "", unit: it.單位 || "", price: num(it.單價),
      remark: String(remarkOf[`${it.名稱}|${it.單位}`] || "").replace(/^\*\d+\s*/, ""), qty, amount: num(it.結算金額) });
  }));
  return out;
}
const itemKey = (x) => `${x.purchaseNo}\0${x.category}\0${x.name}\0${x.unit}\0${x.price}`;

async function statistics(kind, q, s) {
  const list = await scopedBooks(s);
  if (kind === "settlement-contracts") {
    const seen = new Map();
    filterBooks(list, { ...q, officeArea: "", purchaseNo: "" }).forEach((b) => {
      if (q.monthBasis && !basisDate(b, q.monthBasis)) return;
      const k = b.契約書 || {};
      if (!seen.has(k.採購案號)) seen.set(k.採購案號, { 辦理區處: k.辦理區處, 承辦單位: k.承辦單位, 契約年度: k.契約年度, 合約名稱: k.合約名稱, 採購案號: k.採購案號 });
    });
    return json([...seen.values()]);
  }
  if (kind === "area-monthly") {
    const rows = {};
    filterBooks(list, q).forEach((b) => {
      const d = basisDate(b, q.monthBasis || "updated");
      if (!d) return;
      const mo = rocMonth(d);
      const x = bookSums(b);
      const r = (rows[mo] = rows[mo] || { month: mo, settleAmt: 0, actualAmt: 0, matAmt: 0, roadAmt: 0, count: 0 });
      r.settleAmt = r2(r.settleAmt + x.結算價款含稅);
      r.actualAmt = r2(r.actualAmt + x.本次實發);
      r.matAmt = r2(r.matAmt + x.物料費結算金額);
      r.roadAmt = r2(r.roadAmt + x.路修費結算金額);
      r.count++;
    });
    return json(Object.values(rows).sort((a, b) => a.month.localeCompare(b.month)));
  }
  if (kind === "item-usage") {
    const agg = {};
    const from = q.monthFrom, to = q.monthTo; // "115/03"
    filterBooks(list, { purchaseNo: q.purchaseNo, officeArea: q.officeArea, contractYear: q.contractYear }).forEach((b) => {
      const d = basisDate(b, q.monthBasis || "created");
      if (!d) return;
      const mo = rocMonth(d);
      if ((from && mo < from) || (to && mo > to)) return;
      bookItems(b).forEach((it) => {
        const k = itemKey(it);
        const a = (agg[k] = agg[k] || { purchaseNo: it.purchaseNo, category: it.category, name: it.name, unit: it.unit, price: it.price, remark: it.remark, monthly: {}, total: 0, amount: 0 });
        a.monthly[mo] = r2((a.monthly[mo] || 0) + it.qty, 4);
        a.total = r2(a.total + it.qty, 4);
        a.amount = r2(a.amount + it.amount);
      });
    });
    return json(Object.values(agg));
  }
  if (kind === "settlement-items") {
    return json(filterBooks(list, { purchaseNo: q.purchaseNo, officeArea: q.officeArea, contractYear: q.contractYear }).map((b) => {
      const 工期 = (b.結算書 || {}).工期 || {};
      const st = rocDate(工期.實際開工日期), en = rocDate(工期.實際竣工日期);
      return {
        filename: b._filename,
        purchaseNo: (b.契約書 || {}).採購案號,
        batch: String((b._meta || {}).驗收批次 ?? ((b.結算書 || {}).驗收 || {}).驗收批次 ?? ""),
        period: st || en ? `${st}～${en}` : "",
        items: bookItems(b),
      };
    }));
  }
  if (kind === "contract-control") {
    const cfgs = (await all("configs")).filter((c) => canSee(s, ...cfgOwner(c)));
    return json(cfgs.map((c) => {
      const k = c.契約書 || {};
      const changes = Array.isArray(c.變更設計) ? c.變更設計 : c.變更設計 ? [c.變更設計] : [];
      const last = changes[changes.length - 1];
      const contractAmt = num((last && last.契約價額含稅) ?? k.契約價額含稅);
      const bs = list.filter((b) => (b.契約書 || {}).採購案號 === k.採購案號)
        .sort((a, b) => (a._displayOrder ?? 1e9) - (b._displayOrder ?? 1e9) || num((a._meta || {}).驗收批次) - num((b._meta || {}).驗收批次));
      return {
        officeArea: k.辦理區處, handlingUnit: k.承辦單位, contractYear: k.契約年度, projName: k.合約名稱,
        purchaseNo: k.採購案號, contractNo: k.契約編號, contractAmt,
        batches: bs.map((b) => {
          const 金額 = (b.結算書 || {}).金額 || {};
          const grand = num(金額.施工費小計);
          const 工期 = (b.結算書 || {}).工期 || {};
          return {
            batchNo: (b._meta || {}).驗收批次 ?? "",
            caseCount: (b.當期結算 || []).length + (b.二次結算 || []).length,
            constAmt: grand,
            tax: r2(num(金額.結算價款含稅) - grand),
            period: rocDate(工期.實際竣工日期),
          };
        }),
      };
    }));
  }
  return err(404, "未知的統計項目");
}
