# Rate-limiting plan

Cloudflare Workers Rate Limiting bindings are the implementation target. The API is edge-local and permissive/eventually consistent, so it is abuse protection rather than booking-concurrency control. The Durable Object remains responsible for serialized final availability checks.

| Endpoint/action | Proposed binding limit | Window | Key | Exceeded behavior |
| --- | ---: | ---: | --- | --- |
| `GET /api/availability` | 120 | 60 seconds | Route + client IP | `429`, JSON recovery message, `Retry-After: 60` |
| `POST /api/bookings` | 10 | 60 seconds | Route + client IP | Same |
| Race Control authentication | Cloudflare Access policy/rate-limit rule | Account policy | Access identity + Cloudflare signals | Deny/challenge before the application |
| Booking search / CSV export | 60 reads | 60 seconds | Owner actor ID | `429`; no partial CSV |
| Hero image upload | 10 | 60 seconds | Owner actor ID | `429`; no R2 write |
| Admin config/booking/block mutations | 60 | 60 seconds | Owner actor ID | `429`; no mutation |

The anonymous public routes use a deliberately generous IP key because no account identity exists and many Malaysian mobile users may share an address. Turnstile remains the stronger bot signal on booking creation. Ordinary page navigation is not limited.

The bindings are optional in code so local development works. The client Worker config declares all five bindings with unique namespace IDs `101001`–`101005`, using the limits in the table above. Wrangler created these bindings on the staging Worker deployment. They are local to each Cloudflare location, so use them as abuse protection rather than the booking serialization guarantee.
