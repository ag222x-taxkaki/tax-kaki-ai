import express from "express";

const app = express();
app.use(express.json());

// ======= Mock /ask route (for testing without API key) =======
app.post("/ask", async (req, res) => {
  const question = req.body.question || "No question provided";
  // Simulate AI thinking delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  res.json({
    answer: `📝 Mock answer for: "${question}". The real API response will appear here once your key is active.`
  });
});

// ======= Homepage =======
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Tax Kaki AI</title>
        <style>
          body { font-family: Arial; padding: 40px; background: #f9f9f9; }
          #q { width: 300px; padding: 8px; }
          #askBtn { padding: 8px 12px; margin-left: 5px; }
          .chat-bubble { 
            background: #e0f7fa; 
            padding: 10px; 
            border-radius: 8px; 
            margin: 10px 0;
          }
          #result { margin-top: 20px; }
        </style>
      </head>
      <body>
        <h2>Tax Kaki AI Test Page</h2>
        <input id="q" type="text" placeholder="Ask tax question" />
        <button id="askBtn">Ask</button>
        <div id="result"></div>

        <script>
          const btn = document.getElementById('askBtn');
          const input = document.getElementById('q');
          const resultDiv = document.getElementById('result');

          btn.onclick = async () => {
            const question = input.value.trim();
            if (!question) return alert("Please enter a question!");

            // Show loading
            const bubble = document.createElement('div');
            bubble.className = 'chat-bubble';
            bubble.innerText = '💭 Thinking...';
            resultDiv.appendChild(bubble);

            try {
              const res = await fetch("/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question })
              });
              const data = await res.json();

              bubble.innerText = `🤖 ${data.answer}`;
              input.value = "";
            } catch (err) {
              bubble.innerText = `⚠️ Error: ${err.message}`;
            }

            // Scroll to bottom
            resultDiv.scrollTop = resultDiv.scrollHeight;
          };
        </script>
      </body>
    </html>
  `);
});

// ======= Test route =======
app.get("/test", (req, res) => {
  res.send("Test route working");
});

// ======= Start server =======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
