import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Fetch Moralis Token Balances
  app.get("/api/balances/:address", async (req, res) => {
    const { address } = req.params;
    const apiKey = process.env.MORALIS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Moralis API Key not configured" });
    }

    try {
      const response = await fetch(
        `https://deep-index.moralis.io/api/v2.2/wallets/${address}/tokens?chain=bsc`,
        {
          headers: {
            "X-API-Key": apiKey,
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Moralis API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Moralis Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Route: Fetch BscScan Transactions (Optional but useful)
  app.get("/api/history/:address", async (req, res) => {
    const { address } = req.params;
    const apiKey = process.env.BSCSCAN_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "BscScan API Key not configured" });
    }

    try {
      const response = await fetch(
        `https://api.bscscan.com/api?module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`BscScan API error: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("BscScan Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
