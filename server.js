import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send(`
    <html>
      <body style="font-family: Arial; padding: 40px;">
        <h2>Tax Kaki AI Test Page</h2>
        <input id="q" type="text" placeholder="Ask tax question" style="width: 300px;" />
        <button onclick="ask()">Ask</button>
        <pre id="result"></pre>

        <script>
          async function ask() {
            const question = document.getElementById("q").value;
            const res = await fetch("/ask", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question })
            });
            const data = await res.json();
            document.getElementById("result").innerText = JSON.stringify(data, null, 2);
          }
        </script>
      </body>
    </html>
  `);
});

app.get("/test", (req, res) => {
  res.send("Test route working");
});

app.post("/ask", async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: req.body.question }
      ]
    });

    res.json({
      answer: completion.choices[0].message.content
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
