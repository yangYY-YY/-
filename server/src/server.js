import dotenv from "dotenv";
dotenv.config();

import express from "express";
import session from "express-session";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import crypto from "crypto";
import db from "./db.js";
import {
  ensureActiveExhibition,
  getActiveExhibition,
  listExhibitions,
  createExhibition,
  setActiveExhibition,
  insertCheckin,
  getHistoryByPhone,
  getMyCheckins,
  hasDrawn,
  recordDraw,
  getDrawSettings,
  updateDrawSettings,
  exportExhibitionExcel,
  getAdminSummary,
  getDrawPreview,
} from "./services.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_this_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 },
  })
);

app.use("/admin", express.static(path.join(__dirname, "..", "public", "admin")));

const tokenSecret = process.env.SESSION_SECRET || "change_this_secret";
const tokenTtlMs = 12 * 60 * 60 * 1000;

const createToken = (username) => {
  const payload = { u: username, exp: Date.now() + tokenTtlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
};

const verifyToken = (token) => {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac("sha256", tokenSecret).update(body).digest("base64url");
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
};

const requireAdmin = (req, res, next) => {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (verifyToken(token)) return next();
  }
  const queryToken = req.query?.token || req.query?.t;
  if (typeof queryToken === "string" && verifyToken(queryToken)) {
    return next();
  }
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: "unauthorized" });
};

const getBaseUrl = (req) => {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  const forwarded = req.headers["x-forwarded-proto"];
  const proto = (forwarded || req.protocol || "http").split(",")[0].trim();
  return `${proto}://${req.get("host")}`;
};

const ensureQrImage = async () => {
  const baseUrl = process.env.PUBLIC_BASE_URL;
  if (!baseUrl) return;
  const loginUrl = `${baseUrl.replace(/\/$/, "")}/admin/`;
  const qrPath = path.join(__dirname, "..", "public", "admin", "qr.png");
  try {
    await QRCode.toFile(qrPath, loginUrl, { width: 280, margin: 1 });
  } catch (err) {
    console.error("QR generation failed", err);
  }
};

app.get("/api/admin/qr", async (req, res) => {
  const loginUrl = `${getBaseUrl(req)}/admin/`;
  try {
    const buffer = await QRCode.toBuffer(loginUrl, { width: 280, margin: 1 });
    res.setHeader("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "qr_failed" });
  }
});

app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "missing" });

  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    const token = createToken(username);
    return res.json({ ok: true, token });
  }

  res.status(401).json({ error: "invalid" });
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/summary", requireAdmin, (req, res) => {
  res.json(getAdminSummary());
});

app.get("/api/admin/draw-preview", requireAdmin, (req, res) => {
  const limit = Number(req.query.limit || 50);
  res.json(getDrawPreview(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50));
});

app.get("/api/admin/exhibitions", requireAdmin, (req, res) => {
  res.json(listExhibitions());
});

app.post("/api/admin/exhibitions", requireAdmin, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "missing" });
  res.json(createExhibition(name));
});

app.post("/api/admin/exhibitions/:id/activate", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid" });
  res.json(setActiveExhibition(id));
});

app.get("/api/admin/draw", requireAdmin, (req, res) => {
  res.json(getDrawSettings());
});

app.post("/api/admin/draw", requireAdmin, (req, res) => {
  const { winRate, prizes } = req.body || {};
  res.json(updateDrawSettings({ winRate, prizes }));
});

app.get("/api/admin/export", requireAdmin, async (req, res) => {
  const active = getActiveExhibition();
  const buffer = await exportExhibitionExcel(active.id);
  const fileName = `checkins_${active.id}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
  res.send(buffer);
});

app.get("/api/public/active", (req, res) => {
  res.json(getActiveExhibition());
});

app.get("/api/public/draw-settings", (req, res) => {
  const settings = getDrawSettings();
  res.json({ prizes: settings.prizes || [], winRate: settings.winRate || 0 });
});

app.get("/api/public/draw-settings", (req, res) => {
  const settings = getDrawSettings();
  res.json({ prizes: settings.prizes || [], winRate: settings.winRate || 0 });
});

app.post("/api/public/checkin", (req, res) => {
  const { companyName, signerName, phone, location } = req.body || {};
  if (!companyName || !signerName || !phone || !location) {
    return res.status(400).json({ error: "missing" });
  }
  if (!/^\d{11}$/.test(phone)) {
    return res.status(400).json({ error: "phone" });
  }
  const active = getActiveExhibition();
  const record = insertCheckin(active.id, { companyName, signerName, phone, location });
  res.json(record);
});

app.get("/api/public/history", (req, res) => {
  const { phone } = req.query || {};
  if (!/^\d{11}$/.test(phone || "")) {
    return res.status(400).json({ error: "phone" });
  }
  res.json(getHistoryByPhone(phone));
});

app.get("/api/public/my-checkins", (req, res) => {
  const { phone } = req.query || {};
  if (!/^\d{11}$/.test(phone || "")) {
    return res.status(400).json({ error: "phone" });
  }
  res.json(getMyCheckins(phone));
});

app.post("/api/public/draw", (req, res) => {
  const { phone } = req.body || {};
  if (!/^\d{11}$/.test(phone || "")) {
    return res.status(400).json({ error: "phone" });
  }
  const active = getActiveExhibition();
  if (hasDrawn(active.id, phone)) {
    return res.status(400).json({ error: "drawn" });
  }
  const settings = getDrawSettings();
  const outcome = recordDraw(active.id, phone, settings);
  res.json(outcome);
});

const start = async () => {
  ensureActiveExhibition();
  await ensureQrImage();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

start();
