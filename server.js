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
