# rsvp

> Hey! cmon rsvp to our party bitch!!

Implemented with a React frontend and a Rust/SQL backend.

## UI

The design is very human. [See for yourself](https://cmon.rsvp).

## Dev

- mariadb on 3306 (brew service), `cd server && cargo run` (7002), `cd client && bun run dev` (5174, proxies `/api` + ws).
- `/dev/states` — deterministic slot-state tiles for palette/fill work.
- fake rooms: open any live room with `?fake=N` (dev only, N ≤ 16). options stack with `&`:
  `absent=K` (default N/4) · `fill=0..1` (default 0.5; gold needs ~0.8+) · `seed=S` · `owner=0|1` ·
  `tz=Europe/Berlin` · `offline=1`. the cast is re-applied on every ws update. in `owner=0` the
  absent toggle stays client-side (server refuses absence from the owner, which the cookie still is).
- second browser profile or incognito for a real other participant.
- tests: `cd client && bun run test`. the server integration file runs only with
  `RSVP_TEST_SERVER=http://127.0.0.1:7003` against a spare instance started with
  `RSVP_NO_RATE_LIMIT=1 BACKEND_URL=127.0.0.1:7003 cargo run`.

## License

AGPL-3.0. [LICENSE](LICENSE).
