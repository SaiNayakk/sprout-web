# sprout-web

The Sprout web app: sign in or **explore as a fictional customer** (no sign-up), invest, set up monthly
plans, round up UPI spends into goals, build a streak and spend the points it earns. Everything is
simulated: no real money, no real trades.

Angular 21, standalone components and signals, no UI framework. It is one origin with its API: nginx serves
the app and forwards `/api` to Sprout's gateway, so there is no CORS and no second site to trust.

## Run it

```bash
npm ci
npm start            # http://localhost:4200, /api goes to the gateway on localhost:8100 (proxy.conf.json)
npm test -- --watch=false
docker build -t sprout-web . && docker run -p 8080:80 -e SPROUT_API=http://host.docker.internal:8100 sprout-web
```

It needs a running Sprout (see [sprout-platform](https://github.com/SaiNayakk/sprout-platform) for its
environments). With the sandbox switched on, the front page lets anyone explore as one of fifteen
fictional customers: choose a woman, a man, someone non-binary or of another gender, or no preference.

## How it is put together

| | |
|---|---|
| `core/` | The API client, sign-in and token refresh, live prices, money formatting, the shapes the gateway returns |
| `pages/` | One lazily loaded page each: landing, sign-in, onboarding, home, markets, a share and its order ticket, orders, money, plans, goals, habits, rewards, statements |
| `ui/` | Shared pieces: the shell and navigation, add money (the UPI approval flow), AutoPay, UPI payment, the price chart |

Decisions worth knowing:

- **Money is a string, never a float.** The services send and expect decimal strings ("1450.50"). The app
  only ever formats them (Indian digit grouping, ₹1,00,000) and does the few display sums in whole paise.
- **A gain or loss is never only a colour**: always a sign and ▲/▼.
- **Token refresh is serialised.** Access tokens last 15 minutes and refresh tokens are single use, so presenting
  one twice ends the session. Calls that fail together share one refresh, refreshes run under a cross-tab lock
  (Web Locks), and a tab that finds a newer stored token uses it instead of refreshing. See `core/auth.ts` and its tests.
- **Live prices over a streaming `fetch`**, because the browser's `EventSource` can't send the login token. It
  reconnects with a growing pause and asks for a new token when the old one has run out.
- **A retried order or payment can't happen twice**: writes carry an `Idempotency-Key`, kept across a retry when
  the outcome was unknown and renewed when the person changes the request.
- **A strict Content-Security-Policy** (own scripts only, no inline script); CI fails if the build gains one.
- **Tokens are kept in `localStorage`**, which script can read and an HttpOnly cookie couldn't be. Sprout's gateway
  issues tokens in JSON, and the sandbox's customers are fictional.

## License

MIT
