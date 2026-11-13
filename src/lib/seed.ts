import type Database from "better-sqlite3";
import { CURRENCIES, convertToBndCents } from "./currency";
import { computeSplits } from "./split";
import type { CurrencyCode, SplitRule } from "./types";

const DAY = 86_400_000;

/** A deterministic, clearly-fake QR-style tile used for seeded payment profiles. */
function placeholderQr(seed: string): string {
  const size = 27;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const cells: string[] = [];
  const inFinder = (x: number, y: number) => {
    const boxes = [
      [0, 0],
      [size - 7, 0],
      [0, size - 7],
    ];
    return boxes.some(
      ([bx, by]) => x >= bx && x < bx + 7 && y >= by && y < by + 7,
    );
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (inFinder(x, y)) continue;
      hash = (hash * 1103515245 + 12345) >>> 0;
      if ((hash >>> 16) % 100 < 44) {
        cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`);
      }
    }
  }
  const finder = (x: number, y: number) => {
    return `<rect x="${x}" y="${y}" width="7" height="7" fill="#0d2b2a"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fffdf8"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#0d2b2a"/>`;
  };
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${size + 4} ${size + 4}">` +
    `<rect x="-2" y="-2" width="${size + 4}" height="${size + 4}" fill="#fffdf8"/>` +
    `<g fill="#0d2b2a">${cells.join("")}</g>` +
    finder(0, 0) +
    finder(size - 7, 0) +
    finder(0, size - 7) +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface SeedExpense {
  id: string;
  groupId: string;
  paidBy: string;
  title: string;
  category: string;
  amountCents: number;
  currency: CurrencyCode;
  rule: SplitRule;
  participants: Array<{ userId: string; value?: number }>;
  items?: Array<{ name: string; amountCents: number }>;
  notes?: string;
  spentAt: number;
}

export function seedDatabase(db: Database.Database): void {
  const now = Date.now();

  const users = [
    ["usr_aiman", "aiman", "Aiman", "+6738123456", "#0f6b5d"],
    ["usr_nurul", "nurul", "Nurul", "+6738234567", "#c96f3b"],
    ["usr_hakim", "hakim", "Hakim", "+6738345678", "#3d5a80"],
    ["usr_sofia", "sofia", "Sofia", "+6738456789", "#9a5b8f"],
    ["usr_faridah", "faridah", "Faridah", "+6738567890", "#5c7a3e"],
  ] as const;

  const insertUser = db.prepare(
    `INSERT INTO users (id, username, name, phone, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const insertProfile = db.prepare(
    `INSERT INTO payment_profiles
       (id, user_id, preferred_rail, tarus_proxy, tarus_qr_data, pocket_link, whatsapp_opt_in, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
  );

  for (const [id, username, name, phone, color] of users) {
    insertUser.run(id, username, name, phone, color, now - 30 * DAY);
  }

  const profiles: Array<[string, string, string, string | null, string | null, string | null]> = [
    [
      "prof_aiman",
      "usr_aiman",
      "tarus",
      "+6738123456",
      placeholderQr("aiman"),
      null,
    ],
    [
      "prof_nurul",
      "usr_nurul",
      "tarusqr",
      "+6738234567",
      placeholderQr("nurul"),
      null,
    ],
    [
      "prof_hakim",
      "usr_hakim",
      "pocket",
      "+6738345678",
      null,
      "https://pocket.com.bn/pay/@hakim",
    ],
    [
      "prof_sofia",
      "usr_sofia",
      "tarus",
      "+6738456789",
      placeholderQr("sofia"),
      null,
    ],
    [
      "prof_faridah",
      "usr_faridah",
      "pocket",
      "+6738567890",
      null,
      "https://pocket.com.bn/pay/@faridah",
    ],
  ];
  for (const [id, userId, rail, proxy, qr, pocket] of profiles) {
    insertProfile.run(id, userId, rail, proxy, qr, pocket, now - 10 * DAY);
  }

  // Dayang is kept out of `users` on purpose: she is not on the Miri trip, so
  // she shows how connection requests and group invitations look to a newcomer.
  insertUser.run("usr_dayang", "dayang", "Dayang", "+6738678901", "#a65d57", now - 2 * DAY);
  insertProfile.run("prof_dayang", "usr_dayang", "tarus", "+6738678901", null, null, now - 2 * DAY);

  const insertGroup = db.prepare(
    `INSERT INTO "groups" (id, name, emoji, kind, description, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertMember = db.prepare(
    `INSERT INTO group_members (id, group_id, user_id, role, joined_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  insertGroup.run(
    "grp_miri",
    "Miri Road Trip",
    "🚗",
    "trip",
    "Weekend drive to Miri — petrol, groceries and seafood.",
    "usr_aiman",
    now - 6 * DAY,
  );
  insertGroup.run(
    "grp_dinner",
    "Friday Dinner",
    "🍣",
    "dinner",
    "The rotating Excapade crew.",
    "usr_nurul",
    now - 12 * DAY,
  );
  insertGroup.run(
    "grp_gift",
    "Kak Siti's Gift",
    "🎁",
    "gift",
    "Pooling for Kak Siti's wedding present — no cash held in Vantage.",
    "usr_aiman",
    now - 3 * DAY,
  );

  const memberships: Array<[string, string, string]> = [
    ["grp_miri", "usr_aiman", "owner"],
    ["grp_miri", "usr_nurul", "member"],
    ["grp_miri", "usr_hakim", "member"],
    ["grp_miri", "usr_sofia", "member"],
    ["grp_miri", "usr_faridah", "member"],
    ["grp_dinner", "usr_nurul", "owner"],
    ["grp_dinner", "usr_aiman", "member"],
    ["grp_dinner", "usr_hakim", "member"],
    ["grp_gift", "usr_aiman", "owner"],
    ["grp_gift", "usr_nurul", "member"],
    ["grp_gift", "usr_sofia", "member"],
    ["grp_gift", "usr_faridah", "member"],
  ];
  memberships.forEach(([groupId, userId, role], i) => {
    insertMember.run(`gm_${groupId}_${userId}`, groupId, userId, role, now - 5 * DAY + i);
  });

  // Account connections. The five regulars are all connected with each other;
  // Dayang is connected to Nurul and has a request waiting for Aiman.
  const insertConnection = db.prepare(
    `INSERT INTO connections (id, requester_id, addressee_id, status, created_at, responded_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const regulars = users.map(([id]) => id);
  regulars.forEach((a, i) => {
    regulars.slice(i + 1).forEach((b) => {
      insertConnection.run(`con_${a}_${b}`, a, b, "accepted", now - 20 * DAY, now - 20 * DAY);
    });
  });
  insertConnection.run("con_nurul_dayang", "usr_nurul", "usr_dayang", "accepted", now - 2 * DAY, now - 2 * DAY);
  insertConnection.run("con_dayang_aiman", "usr_dayang", "usr_aiman", "pending", now - 1 * DAY, null);

  // Nurul invited Dayang to Friday Dinner. She has not accepted, so she sees
  // nothing of the ledger and cannot be put in an expense.
  db.prepare(
    `INSERT INTO group_members (id, group_id, user_id, role, joined_at, status, invited_by)
     VALUES (?, ?, ?, 'member', ?, 'invited', ?)`,
  ).run("gm_grp_dinner_usr_dayang", "grp_dinner", "usr_dayang", now - 1 * DAY, "usr_nurul");

  const insertExpense = db.prepare(
    `INSERT INTO expenses
       (id, group_id, paid_by, title, category, amount_cents, currency, fx_rate_to_bnd,
        amount_bnd_cents, split_rule, receipt_data, items_json, notes, spent_at, created_at)
     VALUES (@id, @groupId, @paidBy, @title, @category, @amountCents, @currency, @fxRate,
        @amountBndCents, @splitRule, NULL, @itemsJson, @notes, @spentAt, @createdAt)`,
  );
  const insertSplit = db.prepare(
    `INSERT INTO expense_splits
       (id, expense_id, user_id, amount_bnd_cents, share_units, percent)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const addExpense = (e: SeedExpense) => {
    const fxRate = CURRENCIES[e.currency].defaultRateToBnd;
    const amountBndCents = convertToBndCents(e.amountCents, fxRate);
    insertExpense.run({
      id: e.id,
      groupId: e.groupId,
      paidBy: e.paidBy,
      title: e.title,
      category: e.category,
      amountCents: e.amountCents,
      currency: e.currency,
      fxRate,
      amountBndCents,
      splitRule: e.rule,
      itemsJson: e.items ? JSON.stringify(e.items) : null,
      notes: e.notes ?? null,
      spentAt: e.spentAt,
      createdAt: e.spentAt + 60_000,
    });
    const splits = computeSplits({
      rule: e.rule,
      amountBndCents,
      amountCents: e.amountCents,
      fxRateToBnd: fxRate,
      participants: e.participants,
    });
    for (const split of splits) {
      insertSplit.run(
        `sp_${e.id}_${split.userId}`,
        e.id,
        split.userId,
        split.amountBndCents,
        split.shareUnits,
        split.percent,
      );
    }
  };

  addExpense({
    id: "exp_petrol",
    groupId: "grp_miri",
    paidBy: "usr_aiman",
    title: "Petrol — Shell Miri",
    category: "transport",
    amountCents: 9000,
    currency: "BND",
    rule: "equal",
    participants: users.map(([id]) => ({ userId: id })),
    notes: "Two fill-ups for the drive.",
    spentAt: now - 3 * DAY,
  });

  addExpense({
    id: "exp_groceries",
    groupId: "grp_miri",
    paidBy: "usr_nurul",
    title: "Groceries — Soon Lee",
    category: "groceries",
    amountCents: 24000,
    currency: "MYR",
    rule: "equal",
    participants: users.map(([id]) => ({ userId: id })),
    notes: "Snacks, water and breakfast supplies. Entered in MYR.",
    spentAt: now - 3 * DAY + 3_600_000,
  });

  addExpense({
    id: "exp_seafood",
    groupId: "grp_miri",
    paidBy: "usr_hakim",
    title: "Seafood dinner — Miri Waterfront",
    category: "food",
    amountCents: 12850,
    currency: "BND",
    rule: "shares",
    participants: [
      { userId: "usr_aiman", value: 2 },
      { userId: "usr_nurul", value: 1 },
      { userId: "usr_hakim", value: 1 },
      { userId: "usr_sofia", value: 1 },
      { userId: "usr_faridah", value: 1 },
    ],
    items: [
      { name: "Butter prawns", amountCents: 5800 },
      { name: "Sambal stingray", amountCents: 3850 },
      { name: "Drinks", amountCents: 3200 },
    ],
    notes: "Aiman had a double share of the prawns.",
    spentAt: now - 2 * DAY,
  });

  addExpense({
    id: "exp_hotel",
    groupId: "grp_miri",
    paidBy: "usr_sofia",
    title: "Hotel — 2 nights",
    category: "stay",
    amountCents: 42000,
    currency: "BND",
    rule: "percent",
    participants: [
      { userId: "usr_aiman", value: 25 },
      { userId: "usr_nurul", value: 25 },
      { userId: "usr_hakim", value: 20 },
      { userId: "usr_sofia", value: 15 },
      { userId: "usr_faridah", value: 15 },
    ],
    notes: "Sofia booked the family room, so she took a smaller percentage.",
    spentAt: now - 2 * DAY + 5_400_000,
  });

  addExpense({
    id: "exp_toll",
    groupId: "grp_miri",
    paidBy: "usr_faridah",
    title: "Toll & parking",
    category: "transport",
    amountCents: 2400,
    currency: "BND",
    rule: "equal",
    participants: users.map(([id]) => ({ userId: id })),
    spentAt: now - 1 * DAY,
  });

  addExpense({
    id: "exp_coffee",
    groupId: "grp_miri",
    paidBy: "usr_aiman",
    title: "Coffee stop — Miri",
    category: "food",
    amountCents: 3360,
    currency: "BND",
    rule: "equal",
    participants: users.map(([id]) => ({ userId: id })),
    spentAt: now - 1 * DAY + 2_000_000,
  });

  addExpense({
    id: "exp_excapade",
    groupId: "grp_dinner",
    paidBy: "usr_nurul",
    title: "Excapade sushi",
    category: "food",
    amountCents: 8760,
    currency: "BND",
    rule: "equal",
    participants: [
      { userId: "usr_aiman" },
      { userId: "usr_nurul" },
      { userId: "usr_hakim" },
    ],
    notes: "Friday rotation.",
    spentAt: now - 9 * DAY,
  });

  // Hakim logged a dessert stop that touches Aiman and Sofia. It waits for their
  // confirmations, so it is not in anyone's balance yet.
  addExpense({
    id: "exp_ice_cream",
    groupId: "grp_miri",
    paidBy: "usr_hakim",
    title: "Ice cream — Pelita Mall",
    category: "food",
    amountCents: 1800,
    currency: "BND",
    rule: "equal",
    participants: [
      { userId: "usr_aiman" },
      { userId: "usr_hakim" },
      { userId: "usr_sofia" },
    ],
    spentAt: now - 6 * 3_600_000,
  });
  db.exec("UPDATE expenses SET created_by = paid_by WHERE created_by IS NULL");
  db.prepare(
    "UPDATE expenses SET status = 'pending', resolved_at = NULL WHERE id = 'exp_ice_cream'",
  ).run();
  const insertConfirmation = db.prepare(
    `INSERT INTO expense_confirmations (id, expense_id, user_id, status, responded_at)
     VALUES (?, 'exp_ice_cream', ?, 'pending', NULL)`,
  );
  insertConfirmation.run("ec_ice_cream_aiman", "usr_aiman");
  insertConfirmation.run("ec_ice_cream_sofia", "usr_sofia");

  const insertSettlement = db.prepare(
    `INSERT INTO settlements
       (id, group_id, from_user, to_user, amount_bnd_cents, status, rail, proof_data, note, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertSettlement.run(
    "stl_dinner_aiman",
    "grp_dinner",
    "usr_aiman",
    "usr_nurul",
    2920,
    "completed",
    "tarus",
    null,
    "Paid via tarus after dinner.",
    now - 8 * DAY,
    now - 8 * DAY + 120_000,
  );
  insertSettlement.run(
    "stl_dinner_hakim_pending",
    "grp_dinner",
    "usr_hakim",
    "usr_nurul",
    2920,
    "pending",
    "tarus",
    null,
    "Paid after sushi — ref 5512. Waiting for confirmation.",
    now - 2 * DAY,
    null,
  );

  const insertPool = db.prepare(
    `INSERT INTO pools (id, group_id, title, note, goal_bnd_cents, deadline, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertPool.run(
    "pool_photobook",
    "grp_miri",
    "Miri photo book",
    "Print a little photo book of the trip once everyone has pledged.",
    12000,
    now + 14 * DAY,
    "usr_aiman",
    now - 2 * DAY,
  );
  insertPool.run(
    "pool_gift",
    "grp_gift",
    "Kak Siti's wedding present",
    "Pledges only. Someone buys the gift offline; Vantage just tracks who has chipped in.",
    20000,
    now + 10 * DAY,
    "usr_aiman",
    now - 3 * DAY,
  );

  const insertPledge = db.prepare(
    `INSERT INTO pool_pledges (id, pool_id, user_id, amount_bnd_cents, status, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const pledges: Array<[string, string, number, "pledged" | "received"]> = [
    ["pool_photobook", "usr_aiman", 4000, "pledged"],
    ["pool_photobook", "usr_nurul", 3000, "pledged"],
    ["pool_photobook", "usr_hakim", 2000, "pledged"],
    ["pool_photobook", "usr_sofia", 3000, "pledged"],
    ["pool_gift", "usr_aiman", 5000, "pledged"],
    ["pool_gift", "usr_nurul", 4000, "received"],
    ["pool_gift", "usr_sofia", 3000, "pledged"],
    ["pool_gift", "usr_faridah", 2500, "pledged"],
  ];
  pledges.forEach(([poolId, userId, amount, status], i) => {
    insertPledge.run(
      `pl_${poolId}_${userId}`,
      poolId,
      userId,
      amount,
      status,
      null,
      now - 2 * DAY + i * 60_000,
      now - 2 * DAY + i * 60_000,
    );
  });

  const insertOutbox = db.prepare(
    `INSERT INTO whatsapp_outbox (id, group_id, user_id, phone, template, body, status, error, created_at, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
  );
  insertOutbox.run(
    "wa_seed_1",
    "grp_miri",
    "usr_nurul",
    "+6738234567",
    "expense_added",
    "💸 Aiman added “Petrol — Shell Miri” (BND 90.00) in Miri Road Trip. Your share: BND 18.00.\nOpen Vantage: http://localhost:3000/groups/grp_miri",
    "simulated",
    now - 3 * DAY,
    now - 3 * DAY,
  );
  insertOutbox.run(
    "wa_seed_2",
    "grp_miri",
    "usr_aiman",
    "+6738123456",
    "pool_created",
    "🎯 Aiman started the pool “Miri photo book” with a BND 120.00 goal in Miri Road Trip.",
    "simulated",
    now - 2 * DAY,
    now - 2 * DAY,
  );
}
