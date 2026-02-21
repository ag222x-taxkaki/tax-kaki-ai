import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("Tax Kaki AI backend is running");
});

app.get("/test", (req, res) => {
  res.send("Test route working");
});

app.post("/ask", async (req, res) => {

  const question = req.body.question;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are Tax Kaki AI, an expert Indian tax assistant helping users with income tax, capital gains, deductions, and compliance."
      },
      {
        role: "user",
        content: question
      }
    ]
  });

  res.json({
    answer: response.choices[0].message.content
  });

});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
