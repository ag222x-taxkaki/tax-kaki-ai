import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.send("Tax Kaki AI backend is running");
});

app.get("/test", (req, res) => {
  res.send("Test route working");
});

app.post("/ask", async (req, res) => {
  try {
    console.log("Received question:", req.body.question);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: req.body.question,
        },
      ],
    });

    res.json({
      answer: completion.choices[0].message.content,
    });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
