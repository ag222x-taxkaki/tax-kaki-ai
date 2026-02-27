import express from "express";
import OpenAI from "openai";
import { GoogleSpreadsheet } from "google-spreadsheet";

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

// Login Endpoint - Matches your Google Sheet structure
app.post("/login", async (req, res) => {
  const { pan, pin } = req.body;
  
  if (!pan || !pin) {
    return res.status(400).json({ error: "PAN and PIN required" });
  }

  try {
    // Connect to Google Sheet
    const doc = new GoogleSpreadsheet(SHEET_ID);
    
    await doc.useServiceAccountAuth({
      client_email: CLIENT_EMAIL,
      private_key: PRIVATE_KEY,
    });

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    // Find user by PAN (column name: "Your PAN - T")
    const user = rows.find(r => 
      String(r.get('Your PAN - T') || '').trim().toUpperCase() === pan.trim().toUpperCase()
    );

    if (!user) {
      return res.status(403).json({ error: "PAN not found" });
    }

    // Check PIN (column name: "Set your 4-dig")
    if (String(user.get('Set your 4-dig') || '').trim() !== pin.trim()) {
      return res.status(403).json({ error: "Invalid PIN" });
    }

    // Check activation status (column name: "Activation Status")
    const activationStatus = String(user.get('Activation Status') || '').trim().toLowerCase();
    if (activationStatus !== "active") {
      return res.status(403).json({ error: "Inactive user" });
    }

    // Check expiry date if exists (column name: "Expiry Date")
    const expiryDateValue = user.get('Expiry Date');
    if (expiryDateValue) {
      const expiry = new Date(expiryDateValue);
      const now = new Date();
      if (expiry < now) {
        return res.status(403).json({ error: "Account expired" });
      }
    }

    // Login successful
    res.json({ 
      status: "ok", 
      pan: pan,
      message: "Login successful" 
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: "Login failed" });
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
