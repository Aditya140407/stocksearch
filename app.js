/* ================================================================
   Indian Market Dashboard
   - Indexes & prices : Yahoo Finance v8 chart API (via CORS proxy)
   - Fundamentals     : Yahoo quoteSummary (via YOUR Cloudflare Worker)
   - News             : Google News RSS (via CORS proxy)
================================================================ */
const PROXY = "https://api.allorigins.win/raw?url=";
const WORKER_URL = "";   // Paste your Cloudflare Worker URL here, e.g.
                         //    "https://imd-api.yourname.workers.dev"
const YF = "https://query1.finance.yahoo.com";
const REFRESH_MS = 30 * 1000;
const INDEXES = [
  { name: "NIFTY 50",     sym: "^NSEI" },
  { name: "SENSEX",       sym: "^BSESN" },
  { name: "BANK NIFTY",   sym: "^NSEBANK" },
  { name: "NIFTY IT",     sym: "^CNXIT" },
  { name: "NIFTY PHARMA", sym: "^CNXPHARMA" },
  { name: "INDIA VIX",    sym: "^INDIAVIX" }
];
const state = { sym: null, name: null };
const $ = (id) => document.getElementById(id);
/* ---------------- helpers ---------------- */
async function proxied(url) {
  const res = await fetch(PROXY + encodeURIComponent(url));
  if (!res.ok) throw new Error("Proxy error " + res.status);
  return res;
}
const yfJSON = async (path) => (await proxied(YF + path)).json();
const fmt = (n, d = 2) =>
  n == null || isNaN(n) ? "—"
    : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
function fmtBig(v) {
  if (v == null || isNaN(v)) return "—";
  if (v >= 1e12) return "₹" + (v / 1e12).toFixed(2) + " L Cr";
  if (v >= 1e7)  return "₹" + (v / 1e7).toFixed(2) + " Cr";
  if (v >= 1e5)  return "₹" + (v / 1e5).toFixed(2) + " L";
  return "₹" + Number(v).toLocaleString("en-IN");
}
const esc = (s) => { const d = document.createElement("div"); d.textContent = s ?? ""; return d.innerHTML; };
/* ---------------- live indexes ---------------- */
async function loadIndexes() {
  const box = $("indexes");
  box.innerHTML = "";
  await Promise.all(INDEXES.map(async (idx) => {
    try {
      const j = await yfJSON(`/v8/finance/chart/${encodeURIComponent(idx.sym)}?interval=1d&range=1d`);
      const m = j.chart.result[0].meta;
      const price = m.regularMarketPrice;
      const prev = m.chartPreviousClose || m.previousClose || m.regularMarketPreviousClose;
      const chg = price - prev, pct = prev ? (chg / prev) * 100 : 0;
      const card = document.createElement("div");
      card.className = "idx-card";
      card.innerHTML =
        `<div class="idx-name">${idx.name}</div>
         <div class="idx-price">${fmt(price)}</div>
         <div class="idx-chg ${chg >= 0 ? "up" : "down"}">${chg >= 0 ? "▲" : "▼"}
           ${fmt(Math.abs(chg))} (${fmt(pct)}%)</div>`;
      box.appendChild(card);
    } catch (e) { /* skip failed index */ }
  }));
}
/* ---------------- search ---------------- */
function showSuggestions(q) {
  const box = $("suggestions");
  q = q.trim().toUpperCase();
  if (!q) { box.style.display = "none"; return; }
  const matches = SYMBOLS.filter(s => s[0].includes(q) || s[1].toUpperCase().includes(q)).slice(0, 8);
  box.innerHTML = matches.length
    ? matches.map(m => `<div class="sug" data-sym="${m[0]}.NS">${m[0]}<span>${m[1]}</span></div>`).join("")
    : `<div class="sug" data-sym="__FREE__">Search Yahoo for "${esc(q)}"<span>NSE: .NS · BSE: .BO</span></div>`;
  box.style.display = "block";
  box.querySelectorAll(".sug").forEach(el => el.onclick = () => {
    box.style.display = "none";
    const v = el.dataset.sym === "__FREE__" ? $("searchInput").value : el.dataset.sym;
    loadCompany(v);
  });
}
async function resolveSymbol(q) {
  q = q.trim();
  if (!WORKER_URL || /\.(NS|BO)$/i.test(q)) return q.toUpperCase();
  try {
    const r = await fetch(`${WORKER_URL}/search?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    const hit = (d.quotes || []).find(x => /\.(NS|BO)$/.test(x.symbol)) || (d.quotes || [])[0];
    return hit ? hit.symbol : q.toUpperCase();
  } catch { return q.toUpperCase(); }
}
/* ---------------- company page ---------------- */
async function loadCompany(raw) {
  const sym = await resolveSymbol(raw);
  state.sym = sym.toUpperCase();
  state.name = (SYMBOLS.find(s => s[0] + ".NS" === state.sym) || [])[1] || state.sym;
  loadNews(state.sym.replace(/\.(NS|BO)$/, "") + " stock share");
  try {
    const j = await yfJSON(`/v8/finance/chart/${encodeURIComponent(state.sym)}?interval=1d&range=6mo`);
    const r = j.chart.result[0], m = r.meta;
    renderQuote(m, r.indicators.quote[0].close);
  } catch {
    $("company").innerHTML =
      `<div class="card"><h3>Could not load "${esc(state.sym)}"</h3>
       <p class="muted">Check the symbol — NSE stocks end with <b>.NS</b>, BSE with <b>.BO</b> (BSE scrip code).</p></div>`;
    return;
  }
  loadFundamentals(state.sym);
}
function sparkline(closes) {
  const pts = (closes || []).filter(c => c != null);
  if (pts.length < 2) return "";
  const min = Math.min(...pts), max = Math.max(...pts), rng = max - min || 1;
  const w = 560, h = 110, stepX = w / (pts.length - 1);
  const p = pts.map((c, i) => `${(i * stepX).toFixed(1)},${(h - ((c - min) / rng) * (h - 8) - 4).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= pts[0];
  return `<svg class="spark ${up ? "up" : "down"}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${p}"/></svg>`;
}
function renderQuote(m, closes) {
  const price = m.regularMarketPrice;
  const prev = m.chartPreviousClose || m.previousClose || m.regularMarketPreviousClose;
  const chg = price - prev, pct = prev ? (chg / prev) * 100 : 0;
  const kv = (k, v) => `<div class="kv"><div class="k">${k}</div><div class="v">${v == null ? "—" : fmt(v)}</div></div>`;
  $("company").innerHTML = `
    <div class="card">
      <div class="quote-head">
        <div>
          <h2><span id="coName">${esc(state.name)}</span> <span class="sym">${esc(state.sym)}</span></h2>
          <div class="exch">${esc(m.exchangeName || "")} · ${esc(m.instrumentType || "")}</div>
        </div>
        <div class="quote-price">
          <div class="p">₹${fmt(price)}</div>
          <div class="c ${chg >= 0 ? "up" : "down"}">${chg >= 0 ? "▲" : "▼"} ${fmt(Math.abs(chg))} (${fmt(pct)}%)</div>
        </div>
      </div>
      ${sparkline(closes)}
      <div class="kv-grid">
        ${kv("Day High", m.regularMarketDayHigh)}
        ${kv("Day Low", m.regularMarketDayLow)}
        ${kv("52W High", m.fiftyTwoWeekHigh)}
        ${kv("52W Low", m.fiftyTwoWeekLow)}
        ${kv("Prev Close", prev)}
        ${kv("Volume", m.regularMarketVolume)}
      </div>
    </div>
    <div id="fundamentals"><div class="card muted">Loading fundamentals…</div></div>`;
}
/* ---------------- fundamentals (worker) ---------------- */
const MODULES = "price,summaryDetail,defaultKeyStatistics,financialData," +
  "incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory";
async function loadFundamentals(sym) {
  const box = $("fundamentals");
  if (!WORKER_URL) {
    box.innerHTML = `<div class="card muted">
      Price data loaded. For full financial statements, connect your free Cloudflare Worker
      (see worker.js in the repo → set <b>WORKER_URL</b> in js/app.js).</div>`;
    return;
  }
  try {
    const res = await fetch(`${WORKER_URL}/summary?symbol=${encodeURIComponent(sym)}&modules=${MODULES}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    renderFundamentals(data.quoteSummary.result[0]);
  } catch (e) {
    box.innerHTML = `<div class="card muted">Fundamentals unavailable — ${esc(String(e.message || e))}</div>`;
  }
}
function renderFundamentals(j) {
  if (j.price?.longName) { const el = $("coName"); if (el) el.textContent = j.price.longName; }
  const g  = (o, ...k) => { for (const key of k) if (o && o[key] != null) return o[key]; return null; };
  const rr = (o, ...k) => { const v = g(o, ...k); return v && v.raw != null ? v.raw : null; };
  const pct = v => v == null ? null : v * 100;
  const pctStr = v => v == null ? "—" : fmt(v, 1) + "%";
  const metrics = [
    ["Market Cap",       rr(j.price, "marketCap"), fmtBig],
    ["Enterprise Value", rr(j.defaultKeyStatistics, "enterpriseValue"), fmtBig],
    ["P/E (TTM)",        rr(j.summaryDetail, "trailingPE"), fmt],
    ["EPS (TTM)",        rr(j.defaultKeyStatistics, "trailingEps"), fmt],
    ["Book Value",       rr(j.defaultKeyStatistics, "bookValue"), fmt],
    ["P/B",              rr(j.defaultKeyStatistics, "priceToBook"), fmt],
    ["Dividend Yield",   pct(rr(j.summaryDetail, "dividendYield")), pctStr],
    ["ROE",              pct(rr(j.financialData, "returnOnEquity")), pctStr],
    ["ROA",              pct(rr(j.financialData, "returnOnAssets")), pctStr],
    ["Profit Margin",    pct(rr(j.financialData, "profitMargins")), pctStr],
    ["Debt / Equity",    rr(j.financialData, "debtToEquity"), fmt],
    ["Total Cash",       rr(j.financialData, "totalCash"), fmtBig],
    ["Total Debt",       rr(j.financialData, "totalDebt"), fmtBig],
    ["Revenue Growth",   pct(rr(j.financialData, "revenueGrowth")), pctStr],
    ["Shares Outstanding", rr(j.defaultKeyStatistics, "sharesOutstanding"),
       v => v == null ? "—" : (v / 1e7).toFixed(2) + " Cr"]
  ];
  const STMT_KEY = {
    incomeStatementHistory: "incomeStatementStatements",
    balanceSheetHistory: "balanceSheetStatements",
    cashflowStatementHistory: "cashflowStatements"
  };
  function statement(mod, fields) {
    const stmts = (j[mod] || {})[STMT_KEY[mod]] || [];
    const cols = stmts.map(s => (s.endDate?.fmt || "").slice(0, 4));
    const rows = fields
      .map(([label, ...keys]) => [label, ...stmts.map(s => keys.reduce((a, k) => a ?? s[k]?.fmt ?? null, null))])
      .filter(r => r.slice(1).some(v => v != null));
    return { cols, rows };
  }
  const stmtTable = ({ cols, rows }) => rows.length
    ? `<div style="overflow-x:auto"><table><tr><th></th>${cols.map(c => `<th>${c}</th>`).join("")}</tr>
       ${rows.map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(v => `<td>${v ?? "—"}</td>`).join("")}</tr>`).join("")}
       </table></div>`
    : `<p class="muted">Not available for this company.</p>`;
  const inc = statement("incomeStatementHistory", [
    ["Total Revenue", "totalRevenue"], ["Gross Profit", "grossProfit"],
    ["Operating Income", "operatingIncome", "totalOperatingIncome", "ebit"],
    ["Net Income", "netIncome", "netIncomeFromContinuingOps"], ["Basic EPS", "basicEPS"]]);
  const bal = statement("balanceSheetHistory", [
    ["Total Assets", "totalAssets"],
    ["Total Liabilities", "totalLiabNetMinorityInterest", "totalLiabilitiesNetMinorityInterest"],
    ["Stockholders' Equity", "totalStockholderEquity", "totalEquityGrossMinorityInterest"],
    ["Long-Term Debt", "longTermDebt", "longTermDebtNoncurrent"],
    ["Cash", "cash", "cashAndCashEquivalents", "cashCashEquivalentsAndShortTermInvestments"],
    ["Inventory", "inventory"], ["Receivables", "accountsReceivable", "accountsReceivables"]]);
  const cfs = statement("cashflowStatementHistory", [
    ["Operating Cash Flow", "operatingCashflow"], ["Investing Cash Flow", "investingCashflow"],
    ["Financing Cash Flow", "financingCashflow"], ["Capital Expenditure", "capitalExpenditures"],
    ["Free Cash Flow", "freeCashflow"]]);
  $("fundamentals").innerHTML = `
    <div class="card"><h3>I Key Investment Metrics</h3>
      <div class="metrics-grid">${metrics.map(([k, v, f]) =>
        `<div class="metric"><div class="k">${k}</div><div class="v">${f(v)}</div></div>`).join("")}
      </div></div>
    <div class="card"><h3>Income Statement</h3>${stmtTable(inc)}</div>
    <div class="card"><h3>Balance Sheet</h3>${stmtTable(bal)}</div>
    <div class="card"><h3>Cash Flow</h3>${stmtTable(cfs)}</div>`;
}
/* ---------------- news sidebar ---------------- */
async function loadNews(query = "Indian stock market NSE BSE sensex") {
  const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const text = await (await proxied(rss)).text();
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const items = [...doc.querySelectorAll("item")].slice(0, 25);
    $("newsList").innerHTML = items.map(it => {
      const src = it.querySelector("source")?.textContent || "";
      const date = new Date(it.querySelector("pubDate").textContent);
      return `<a class="news-item" href="${it.querySelector("link").textContent}" target="_blank" rel="noopener">
        <div class="news-title">${esc(it.querySelector("title").textContent)}</div>
        <div class="news-meta">${esc(src)} · ${date.toLocaleString("en-IN",
          { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
      </a>`;
    }).join("") || `<div class="news-empty">No news found.</div>`;
  } catch {
    $("newsList").innerHTML = `<div class="news-empty">Could not load news right now.</div>`;
  }
}
/* ---------------- init ---------------- */
function init() {
  loadIndexes();
  setInterval(loadIndexes, REFRESH_MS);
  loadNews();
  setInterval(() => loadNews(), 5 * 60 * 1000);
  const inp = $("searchInput");
  inp.addEventListener("input", e => showSuggestions(e.target.value));
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") { $("suggestions").style.display = "none"; loadCompany(inp.value); }
  });
  document.addEventListener("click", e => {
    if (!e.target.closest(".search-wrap")) $("suggestions").style.display = "none";
  });
}
init();
