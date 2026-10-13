# Indian Market Dashboard

A single-page educational dashboard for Indian market indexes, NSE/BSE company quotes, key investment metrics, financial statements, and financial news.

## Files

- `index.html` — app structure
- `css/style.css` — styling
- `js/symbols.js` — quick-search list of NSE-listed companies
- `js/app.js` — dashboard behavior, quotes, sparklines, metrics, and news
- `worker.js` — optional Cloudflare Worker used for company search and financial statement data

## Publish on GitHub Pages

1. Create a **public** GitHub repository named `indian-market-dashboard`.
2. Upload the files and folders while preserving the structure above.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then save.
6. Wait for deployment. Your site URL will look like `https://YOUR-USERNAME.github.io/indian-market-dashboard/`.

## Data and optional financial statements

The dashboard requests quote/chart data from Yahoo Finance through the AllOrigins proxy and headlines from Google News RSS through the same proxy. These third-party endpoints can change, rate-limit requests, or fail; availability is not guaranteed.

Without a Cloudflare Worker, the dashboard is intended to show index prices, company quotes, sparklines, and news. To enable company fundamentals and financial statements:

1. Deploy `worker.js` as a Cloudflare Worker.
2. Copy the deployed Worker URL.
3. In `js/app.js`, set `WORKER_URL` to that URL, for example:
   `const WORKER_URL = "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev";`
4. Commit the updated `js/app.js` to GitHub.

## Symbols

- NSE symbols normally use the `.NS` suffix, e.g. `RELIANCE.NS`.
- BSE symbols can be entered as a scrip code with `.BO`, e.g. `500570.BO`.

## Important notes

- Market data may be delayed and may not be suitable for trading decisions.
- This project is for education and information only, not investment advice.
- The Cloudflare Worker uses Yahoo Finance endpoints that are not an official stable public API. It may stop working if those endpoints or authentication behavior change.
- Review third-party terms and availability before using this publicly.
