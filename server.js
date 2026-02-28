import express from "express";
import OpenAI from "openai";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// OpenAI Setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Google Sheets Setup - Using Environment Variables (SECURE for production)
const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1Y2h0SK4a68IDPmrZcadco8st6QtEufhzfMoJu8VY2MQ";
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

app.get("/", (req, res) => {
  res.send("Tax Kaki AI backend is running.");
});

// Login Endpoint - Uses COLUMN INDEX (stable, won't break with form changes)
app.post("/login", async (req, res) => {
  const { pan, pin } = req.body;
    
  if (!pan || !pin) {
    return res.status(400).json({ error: "PAN and PIN required" });
  }

  try {
    // Initialize Google Sheets authentication
    const serviceAccountAuth = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    
    const sheet = doc.sheetsByIndex[0]; // First sheet tab
    const rows = await sheet.getRows();

    console.log("Login attempt - input PAN:", pan, "input PIN:", pin);
rows.forEach((r, idx) => {
  console.log(`Row ${idx}: PAN: [${r._rawData[1]}] PIN: [${r._rawData[2]}] STATUS: [${r._rawData[7]}] EXPIRY: [${r._rawData[8]}]`);
});
    
    // Column mapping (based on your Sheet structure):
    // Column A (index 0) = Timestamp
    // Column B (index 1) = PAN
    // Column C (index 2) = PIN
    // Column D (index 3) = Name
    // Column E (index 4) = Mobile
    // Column F (index 5) = QR Code
    // Column G (index 6) = Referred by
    // Column H (index 7) = Activation Status
    // Column I (index 8) = Expiry Date

    // Find user by PAN (case-insensitive)
    const user = rows.find(r => {
      const sheetPan = r._rawData[1]; // Column B
      if (!sheetPan) return false;
      return String(sheetPan).trim().toUpperCase() === pan.trim().toUpperCase();
    });
    console.log("User found?", !!user);
if (!user) {
  console.log("No matching PAN found for:", pan);
}

    if (!user) {
      return res.status(403).json({ error: "PAN not found" });
    }

    // Check PIN (exact match)
    const sheetPin = String(user._rawData[2] || '').trim(); // Column C
    if (sheetPin !== pin.trim()) {
      return res.status(403).json({ error: "Invalid PIN" });
    }

    // Check Activation Status
    const status = String(user._rawData[7] || '').trim().toLowerCase(); // Column H
    if (status !== 'active') {
      return res.status(403).json({ error: "Account not activated" });
    }

    // Check Expiry Date (if present)
    const expiryStr = user._rawData[8]; // Column I
    if (expiryStr && String(expiryStr).trim()) {
      try {
        // Handle dd/mm/yyyy format
        const expiryTrimmed = String(expiryStr).trim();
        const [day, month, year] = expiryTrimmed.split('/');
        const expiry = new Date(`${year}-${month}-${day}`);
        const now = new Date();
        now.setHours(0, 0, 0, 0); // Reset time to start of day
        
        if (expiry < now) {
          return res.status(403).json({ error: "Account expired" });
        }
      } catch (dateError) {
        console.error('Date parsing error:', dateError);
        // Continue if date format is invalid (don't block login)
      }
    }

    // Login successful
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

// AI Chat Endpoint
app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question field is required." });
    }
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert Indian income tax assistant specializing in defence personnel." },
        { role: "user", content: question }
      ]
    });
    
    res.json({ answer: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "OpenAI error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
