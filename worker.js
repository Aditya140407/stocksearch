const YQ1 = "https://query1.finance.yahoo.com";
const YQ2 = "https://query2.finance.yahoo.com";
let crumbCache = null;
async function getCrumb() {
  if (crumbCache) return crumbCache;
  const res = await fetch("https://fc.yahoo.com", { redirect: "manual" });
  const cookie = res.headers.get("set-cookie") || "";
  const crumb = (await (await fetch(`${YQ1}/v1/test/getcrumb`, { headers: { cookie } })).text()).trim();
  crumbCache = { cookie, crumb };
  return crumbCache;
}
async function yahoo(url, params = {}) {
  for (let i = 0; i < 2; i++) {
    const { cookie, crumb } = await getCrumb();
    const res = await fetch(`${url}?${new URLSearchParams({ ...params, crumb })}`, { headers: { cookie } });
    if (res.status === 401) { crumbCache = null; continue; }   // crumb expired → retry
    if (!res.ok) throw new Error("Yahoo error " + res.status);
    return res.json();
  }
  throw new Error("Yahoo auth failed");
}
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };
export default {
  async fetch(req) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const u = new URL(req.url);
    try {
      if (u.pathname === "/search") {
        const data = await yahoo(`${YQ1}/v1/finance/search`,
          { q: u.searchParams.get("q"), quotesCount: 8, newsCount: 0 });
        return Response.json(data, { headers: cors });
      }
      if (u.pathname === "/summary") {
        const data = await yahoo(`${YQ2}/v10/finance/quoteSummary/${encodeURIComponent(u.searchParams.get("symbol"))}`,
          { modules: u.searchParams.get("modules") || "price,summaryDetail" });
        return Response.json(data, { headers: cors });
      }
      return new Response("Not found", { status: 404, headers: cors });
    } catch (e) {
      return new Response(String(e.message || e), { status: 500, headers: cors });
    }
  }
};
