import express from "express";
import OpenAI from "openai";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import fs from "fs";

// User Sheet (for login)
const saJsonRaw = fs.readFileSync("/etc/secrets/taxkaki-backend-697c8cc8baff.json", "utf8");
const saCredentials = JSON.parse(saJsonRaw);
// Auth sheet (user login and expiry)
const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1Y2h0SK4a68IDPmrZcadco8st6QtEufhzfMoJu8VY2MQ";
// Chat history sheet
const CHAT_SHEET_ID = "1E1bo1a2Iv9e9RJKauJfwMY3kLHFpJ7Sx8t92bmjpsCs";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// OpenAI Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Tax Kaki AI backend is running.");
});

// ===== LOGIN ENDPOINT =====
app.post("/login", async (req, res) => {
  const { pan, pin } = req.body;
  if (!pan || !pin) {
    return res.status(400).json({ error: "PAN and PIN required" });
  }

  try {
    const serviceAccountAuth = new JWT({
      email: saCredentials.client_email,
      key: saCredentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    // Find user by PAN (case-insensitive)
    const user = rows.find(r => {
      const sheetPan = r._rawData[1];
      if (!sheetPan) return false;
      return String(sheetPan).trim().toUpperCase() === pan.trim().toUpperCase();
    });

    if (!user) {
      return res.status(403).json({ error: "PAN not found" });
    }

    // Check PIN
    const sheetPin = String(user._rawData[2] || '').trim();
    if (sheetPin !== pin.trim()) {
      return res.status(403).json({ error: "Invalid PIN" });
    }

    // Activation
    const status = String(user._rawData[7] || '').trim().toLowerCase();
    if (status !== 'active') {
      return res.status(403).json({ error: "Account not activated" });
    }

    // Expiry
    const expiryStr = user._rawData[8];
    if (expiryStr && String(expiryStr).trim()) {
      try {
        const match = String(expiryStr).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) {
          return res.status(403).json({ error: "Account expired: invalid expiry date format" });
        }
        const [ , day, month, year ] = match;
        if (
          Number(day) < 1 || Number(day) > 31 ||
          Number(month) < 1 || Number(month) > 12 ||
          Number(year) < 2020
        ) {
          return res.status(403).json({ error: "Account expired: invalid expiry date value" });
        }
        const expiry = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        if (expiry < now) {
          return res.status(403).json({ error: "Account expired" });
        }
      } catch {
        return res.status(403).json({ error: "Account expired: invalid expiry date" });
      }
    }

    res.json({
      status: "ok",
      pan: pan.toUpperCase(),
      message: "Login successful"
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ===== AI CHAT ENDPOINT (NOW WITH TRUE CONTEXT) =====
app.post("/ask", async (req, res) => {
  try {
    const { question, pan } = req.body;
    if (!question || !pan) {
      return res.status(400).json({ error: "PAN and question are required." });
    }

    // 1. Fetch last N messages for this PAN from your chat history sheet
    const chatDoc = getChatSheetDoc(); // Uses your CHAT_SHEET_ID and credentials
    await chatDoc.loadInfo();
    const chatSheet = chatDoc.sheetsByIndex[0]; // "Sheet1"
    const allRows = await chatSheet.getRows();

    // 2. Extract this PAN's chat history only; sort by timestamp
    const history = allRows
      .filter(r => (r._rawData[1] || "").trim().toUpperCase() === pan.trim().toUpperCase())
      .map(r => ({
        role: ((r._rawData[2] || '').toLowerCase() === "user") ? "user" : "assistant", // OpenAI expects "assistant"
        content: r._rawData[3] || "",
        timestamp: r._rawData[0] || ""
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 3. Only most recent CONTEXT_MSGS (set as needed for context, cost, prompt size)
    const CONTEXT_MSGS = 12;
    const priorMessages = history.slice(-CONTEXT_MSGS);

    // 4. Build the message array for OpenAI:
    const openaiMsgs = [
      { role: "system", content: "You are an expert Indian income tax assistant specializing in defence personnel." },
      ...priorMessages,
      { role: "user", content: question }
    ];

    // 5. OpenAI call with full context
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMsgs
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "OpenAI error" });
  }
});

// ========== SHARED CHAT HISTORY ENDPOINTS ==========

// Helper function to get chat sheet
function getChatSheetDoc() {
  return new GoogleSpreadsheet(CHAT_SHEET_ID, new JWT({
    email: saCredentials.client_email,
    key: saCredentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  }));
}

// GET /chat-history?pan=XXXXX
app.get("/chat-history", async (req, res) => {
  try {
    const pan = req.query.pan;
    if (!pan) return res.status(400).json({ error: "PAN is required" });

    const doc = getChatSheetDoc();
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // Use Sheet1
    const rows = await sheet.getRows();
    const history = rows
      .filter(r => (r._rawData[1] || "").trim().toUpperCase() === pan.trim().toUpperCase())
      .map(r => ({
        timestamp: r._rawData[0],
        pan: r._rawData[1],
        role: r._rawData[2],
        message: r._rawData[3],
      }));
    res.json({ history });
  } catch (error) {
    console.error("Chat history fetch error:", error);
    res.status(500).json({ error: "Failed to load history" });
  }
});

// POST /chat-history   { pan, role, message }
app.post("/chat-history", async (req, res) => {
  try {
    const { pan, role, message } = req.body;
    if (!pan || !role || !message) {
      return res.status(400).json({ error: "Missing pan, role or message" });
    }

    const doc = getChatSheetDoc();
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // Use Sheet1
    await sheet.addRow([
      new Date().toISOString(),
      pan,
      role,
      message
    ]);

    res.json({ status: "ok" });
  } catch (error) {
    console.error("Chat history save error:", error);
    res.status(500).json({ error: "Failed to save message" });
  }
});

// ========== SERVER LISTEN ==========
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
