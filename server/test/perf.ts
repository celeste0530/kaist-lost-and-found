// SRS 3.2 performance check (run with `npm run perf`; not part of `npm test`).
//
//   "With up to 1,000 stored item records and five concurrent users, at least 95% of search requests
//    shall return results within 2 seconds under normal operating conditions."
//   "Updated item status shall be visible to subsequent requests within 2 seconds after a successful update."
//
// Uses the same throwaway test database as the API tests (see helpers.ts): it is rebuilt from the seed,
// then filled up to 1,000 items. The development database is not touched.
//
// Note: the API server and the five simulated users run in this one Node process, so the load generator
// competes with the server for CPU. The measured times are therefore, if anything, pessimistic.
import { performance } from "node:perf_hooks";
import { CATEGORIES } from "../src/constants";
import { type Client, SEED, dbQuery, startApi } from "./helpers";

const TOTAL_ITEMS = 1000;
const USERS = 5;
const REQUESTS_PER_USER = 100;
const LIMIT_MS = 2000;

// Seed centers 1-4 and the staff user of each (user id = center id + 1).
const CENTERS = [
  { id: 1, staff: 2, lng: 127.3608, lat: 36.3738 },
  { id: 2, staff: 3, lng: 127.3627, lat: 36.3697 },
  { id: 3, staff: 4, lng: 127.3561, lat: 36.3687 },
  { id: 4, staff: 5, lng: 127.3634, lat: 36.3683 },
];
const NAMES = ["검정 우산", "갤럭시 스마트폰", "학생증", "회색 후드티", "에어팟 케이스", "필통", "텀블러", "노트북 충전기", "카드지갑", "백팩"];
const WORDS = ["열람실", "식당", "강의실", "주차장", "세탁실", "카페", "엘리베이터", "운동장"];

const pick = <T>(arr: readonly T[], i: number) => arr[i % arr.length];
const pad = (n: number) => String(n).padStart(2, "0");

/** Fills the test database up to TOTAL_ITEMS items with a realistic mix of statuses. */
async function fillItems(): Promise<void> {
  const [{ n }] = await dbQuery<{ n: number }>("SELECT COUNT(*) AS n FROM item");
  const missing = TOTAL_ITEMS - Number(n);
  const rows: string[] = [];
  const params: unknown[] = [];
  for (let i = 0; i < missing; i++) {
    const c = CENTERS[i % CENTERS.length];
    const r = i % 20; // 14/20 Available, 3/20 Returned, 2/20 Disposed, 1/20 Removed
    const status = r < 14 ? "Available" : r < 17 ? "Returned" : r < 19 ? "Disposed" : "Removed";
    const day = 1 + (i % 28);
    const month = 8 + (i % 4); // August - November 2026
    const registered = `2026-${pad(month)}-${pad(day)} ${pad(8 + (i % 12))}:${pad(i % 60)}:00`;
    const found = `2026-${pad(month)}-${pad(day)}`;
    const lng = c.lng + ((i % 11) - 5) * 0.0002;
    const lat = c.lat + ((i % 7) - 3) * 0.0002;
    rows.push("(?, ?, ?, ?, ?, ?, ST_GeomFromText(?), ?, ?, ?, ?)");
    params.push(
      c.id,
      c.staff,
      status === "Returned" ? c.staff : null,
      `${pick(NAMES, i)} #${i + 1}`,
      pick(CATEGORIES, i),
      found,
      `POINT(${lng} ${lat})`,
      `${pick(WORDS, i)} 근처에서 발견된 물품 (성능 측정용 데이터 ${i + 1})`,
      status,
      registered,
      status === "Returned" ? registered : null,
    );
  }
  await dbQuery(
    `INSERT INTO item (center_id, registered_by, returned_by, name, category, found_date, found_location,
                       description, status, registration_date, return_date)
     VALUES ${rows.join(", ")}`,
    params,
  );
}

/** The search requests a user might send (FR-05 / FR-07). */
function searchQueries(): string[] {
  const q = (s: string) => encodeURIComponent(s);
  return [
    "", // default list / map: every Available item
    `?q=${q("우산")}`,
    `?q=${q("열람실")}`, // matches descriptions
    `?q=${q("충전기")}`,
    ...CATEGORIES.map((c) => `?category=${q(c)}`),
    ...CENTERS.map((c) => `?centerId=${c.id}`),
    "?foundDateFrom=2026-10-01&foundDateTo=2026-10-31",
    "?bbox=127.355,36.367,127.365,36.375",
    `?category=Electronics&centerId=2`,
    `?q=${q("학생증")}&foundDateFrom=2026-09-01`,
  ];
}

interface Sample {
  ms: number;
  status: number;
  count: number;
}

async function runUser(client: Client, user: number, queries: string[], samples: Sample[]): Promise<void> {
  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    // Each user walks through the query list from a different starting point.
    const query = queries[(user * 7 + i) % queries.length];
    const t0 = performance.now();
    const res = await client.get(`/api/items${query}`);
    samples.push({ ms: performance.now() - t0, status: res.status, count: Array.isArray(res.body) ? res.body.length : -1 });
  }
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

async function main() {
  console.log("Preparing the test database...");
  const api = await startApi();
  try {
    await fillItems();
    const counts = await dbQuery<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM item GROUP BY status");
    const total = counts.reduce((s, r) => s + Number(r.n), 0);
    console.log(`Items: ${total} (${counts.map((r) => `${r.status} ${r.n}`).join(", ")})`);

    // --- 1. Search: 5 concurrent users ---------------------------------------------------------
    const queries = searchQueries();
    const users: Client[] = [];
    for (let u = 0; u < USERS; u++) {
      // Four public users and one logged-in staff member (staff searches also go through attachUser).
      users.push(u === USERS - 1 ? await api.login(SEED.staff1) : api.client());
    }
    for (const c of users) await c.get("/api/items"); // warm-up, not measured

    const samples: Sample[] = [];
    const started = performance.now();
    await Promise.all(users.map((c, u) => runUser(c, u, queries, samples)));
    const elapsed = performance.now() - started;

    const times = samples.map((s) => s.ms).sort((a, b) => a - b);
    const within = samples.filter((s) => s.ms <= LIMIT_MS).length;
    const errors = samples.filter((s) => s.status !== 200).length;
    const largest = Math.max(...samples.map((s) => s.count));
    const ratio = within / samples.length;

    console.log("\n[1] Search with 5 concurrent users (SRS 3.2)");
    console.log(`  requests        : ${samples.length} (${USERS} users x ${REQUESTS_PER_USER}), ${queries.length} different searches`);
    console.log(`  errors (non-200): ${errors}`);
    console.log(`  largest result  : ${largest} items`);
    console.log(`  median          : ${percentile(times, 0.5).toFixed(1)} ms`);
    console.log(`  95th percentile : ${percentile(times, 0.95).toFixed(1)} ms`);
    console.log(`  max             : ${times[times.length - 1].toFixed(1)} ms`);
    console.log(`  within 2 s      : ${(ratio * 100).toFixed(1)}%  (required: at least 95%)`);
    console.log(`  throughput      : ${(samples.length / (elapsed / 1000)).toFixed(0)} requests/s`);
    const searchOk = ratio >= 0.95 && errors === 0;
    console.log(`  result          : ${searchOk ? "PASS" : "FAIL"}`);

    // --- 2. Status change visible to the next request -------------------------------------------
    console.log("\n[2] Status change visible to subsequent requests (SRS 3.2)");
    const staff = await api.login(SEED.staff1);
    const available = await dbQuery<{ item_id: number }>(
      "SELECT item_id FROM item WHERE center_id = 1 AND status = 'Available' ORDER BY item_id LIMIT 5",
    );
    const publicUser = api.client();
    let worst = 0;
    for (const { item_id } of available) {
      const res = await staff.post(`/api/items/${item_id}/return`);
      if (res.status !== 200) throw new Error(`return of item ${item_id} failed: ${res.status}`);
      const t0 = performance.now();
      // Poll the public search until the item is gone (it should be gone on the first try).
      let tries = 0;
      for (;;) {
        tries++;
        const list = await publicUser.get("/api/items?centerId=1");
        if (!list.body.some((i: { id: number }) => i.id === item_id)) break;
        if (performance.now() - t0 > LIMIT_MS * 2) throw new Error(`item ${item_id} still visible`);
      }
      const ms = performance.now() - t0;
      worst = Math.max(worst, ms);
      console.log(`  item ${item_id}: gone from public search after ${ms.toFixed(1)} ms (${tries} request${tries > 1 ? "s" : ""})`);
    }
    const visibleOk = worst <= LIMIT_MS;
    console.log(`  result          : ${visibleOk ? "PASS" : "FAIL"} (slowest ${worst.toFixed(1)} ms, limit 2000 ms)`);

    process.exitCode = searchOk && visibleOk ? 0 : 1;
  } finally {
    await api.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
