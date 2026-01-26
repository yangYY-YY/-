import db from "./db.js";
import ExcelJS from "exceljs";

const nowIso = () => new Date().toISOString();

export const ensureActiveExhibition = () => {
  const active = db.prepare("SELECT * FROM exhibitions WHERE is_active = 1 LIMIT 1").get();
  if (!active) {
    const first = db.prepare("SELECT * FROM exhibitions ORDER BY id ASC LIMIT 1").get();
    if (first) {
      db.prepare("UPDATE exhibitions SET is_active = 1 WHERE id = ?").run(first.id);
    }
  }
};

export const getActiveExhibition = () =>
  db.prepare("SELECT * FROM exhibitions WHERE is_active = 1 LIMIT 1").get();

export const listExhibitions = () =>
  db.prepare("SELECT * FROM exhibitions ORDER BY created_at DESC").all();

export const createExhibition = (name) => {
  const createdAt = nowIso();
  const result = db
    .prepare("INSERT INTO exhibitions (name, created_at, is_active) VALUES (?, ?, 0)")
    .run(name, createdAt);
  return { id: result.lastInsertRowid, name, createdAt };
};

export const setActiveExhibition = (id) => {
  const tx = db.transaction(() => {
    db.prepare("UPDATE exhibitions SET is_active = 0").run();
    db.prepare("UPDATE exhibitions SET is_active = 1 WHERE id = ?").run(id);
  });
  tx();
  return getActiveExhibition();
};

export const insertCheckin = (exhibitionId, payload) => {
  const checkinTime = nowIso();
  const result = db
    .prepare(
      "INSERT INTO checkins (exhibition_id, company_name, signer_name, phone, location, checkin_time) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(exhibitionId, payload.companyName, payload.signerName, payload.phone, payload.location, checkinTime);
  return { id: result.lastInsertRowid, checkinTime };
};

export const getHistoryByPhone = (phone) =>
  db
    .prepare(
      "SELECT c.*, e.name AS exhibition_name FROM checkins c JOIN exhibitions e ON c.exhibition_id = e.id WHERE c.phone = ? ORDER BY c.checkin_time DESC"
    )
    .all(phone);

export const getMyCheckins = (phone) =>
  db
    .prepare(
      "SELECT c.*, e.name AS exhibition_name FROM checkins c JOIN exhibitions e ON c.exhibition_id = e.id WHERE c.phone = ? ORDER BY c.checkin_time DESC"
    )
    .all(phone);

export const hasDrawn = (exhibitionId, phone) => {
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM draw_records WHERE exhibition_id = ? AND phone = ?")
    .get(exhibitionId, phone);
  return row.count > 0;
};

export const getDrawSettings = () => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("draw");
  return row ? JSON.parse(row.value) : { winRate: 0, prizes: [] };
};

export const updateDrawSettings = ({ winRate, prizes }) => {
  const normalizedWinRate = Math.max(0, Math.min(1, Number(winRate || 0)));
  const cleanPrizes = Array.isArray(prizes) ? prizes : [];
  const value = JSON.stringify({ winRate: normalizedWinRate, prizes: cleanPrizes });
  db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value, "draw");
  return { winRate: normalizedWinRate, prizes: cleanPrizes };
};

const pickPrize = (prizes) => {
  const total = prizes.reduce((sum, p) => sum + Number(p.weight || 0), 0);
  if (!total) return null;
  let roll = Math.random() * total;
  for (const prize of prizes) {
    roll -= Number(prize.weight || 0);
    if (roll <= 0) return prize;
  }
  return prizes[prizes.length - 1];
};

export const recordDraw = (exhibitionId, phone, settings) => {
  const winRate = Number(settings.winRate || 0);
  const isWin = Math.random() < winRate;
  let result = "未中奖";

  if (isWin) {
    const prize = pickPrize(settings.prizes || []);
    result = prize?.name || "未配置奖品";
  }

  const drawTime = nowIso();
  db.prepare(
    "INSERT INTO draw_records (exhibition_id, phone, draw_time, result, is_win) VALUES (?, ?, ?, ?, ?)"
  ).run(exhibitionId, phone, drawTime, result, isWin ? 1 : 0);

  return { isWin, result, drawTime };
};

export const exportExhibitionExcel = async (exhibitionId) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("checkins");
  sheet.columns = [
    { header: "展会", key: "exhibition_name", width: 20 },
    { header: "公司名称", key: "company_name", width: 24 },
    { header: "签到人", key: "signer_name", width: 16 },
    { header: "手机", key: "phone", width: 16 },
    { header: "签到地点", key: "location", width: 20 },
    { header: "签到时间", key: "checkin_time", width: 22 },
    { header: "抽奖结果", key: "draw_result", width: 16 },
  ];

  const rows = db
    .prepare(
      `SELECT c.*, e.name AS exhibition_name,
        (SELECT result FROM draw_records d WHERE d.exhibition_id = c.exhibition_id AND d.phone = c.phone ORDER BY d.draw_time ASC LIMIT 1) AS draw_result
       FROM checkins c
       JOIN exhibitions e ON c.exhibition_id = e.id
       WHERE c.exhibition_id = ?
       ORDER BY c.checkin_time DESC`
    )
    .all(exhibitionId);

  for (const row of rows) {
    sheet.addRow(row);
  }

  return workbook.xlsx.writeBuffer();
};

export const getAdminSummary = () => {
  const active = getActiveExhibition();
  const countRow = db
    .prepare("SELECT COUNT(*) AS count FROM checkins WHERE exhibition_id = ?")
    .get(active.id);
  const drawRow = db
    .prepare("SELECT COUNT(*) AS count FROM draw_records WHERE exhibition_id = ? AND is_win = 1")
    .get(active.id);
  return {
    activeExhibition: active,
    checkins: countRow.count,
    winners: drawRow.count,
  };
};
