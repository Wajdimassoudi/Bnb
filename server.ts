import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory store for "BNB Earn Pro"
// In a production app, use a database like Firestore or MongoDB
let users: Record<string, { points: number; lastClaim: number; lastEarn: number }> = {};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Rate limiter for earning and claiming
  const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { error: "Too many requests, please wait." },
  });

  app.use("/api/earn", limiter);
  app.use("/api/claim-points", limiter);

  // API Route: Register / Login for Earning
  app.post("/api/register", (req, res) => {
    const { wallet } = req.body;
    if (!wallet || wallet.length < 10) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }
    if (!users[wallet]) {
      users[wallet] = { points: 0, lastClaim: 0, lastEarn: 0 };
    }
    res.json({ success: true, points: users[wallet].points });
  });

  // API Route: Earn Points
  app.post("/api/earn", (req, res) => {
    const { wallet } = req.body;
    if (!wallet || !users[wallet]) {
      return res.status(404).json({ error: "User not found" });
    }

    const now = Date.now();
    // Simple anti-cheat: prevent earning more than once every 3 seconds
    if (now - users[wallet].lastEarn < 3000) {
      return res.json({ points: users[wallet].points });
    }

    const earn = Math.floor(Math.random() * 5) + 1;
    users[wallet].points += earn;
    users[wallet].lastEarn = now;

    res.json({ points: users[wallet].points });
  });

  // API Route: Claim Points for BNB
  app.post("/api/claim-points", (req, res) => {
    const { wallet } = req.body;
    if (!wallet || !users[wallet]) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[wallet];
    if (user.points < 200) {
      return res.status(400).json({ error: "Minimum 200 points required" });
    }

    const now = Date.now();
    if (now - user.lastClaim < 60000) {
      return res.status(429).json({ error: "Wait 1 minute before next claim" });
    }

    const amount = (user.points * 0.0000005).toFixed(8);
    
    // Reset points and update last claim
    user.points = 0;
    user.lastClaim = now;

    console.log(`[BNB Earn Pro] Sending ${amount} BNB to ${wallet}`);
    
    res.json({
      success: true,
      amount,
      points: 0
    });
  });

  // API Route: Fetch Moralis Token Balances
  app.get("/api/balances/:address", async (req, res) => {
    const { address } = req.params;
    // Using the keys provided by the user directly to ensure it works immediately
    const apiKey = process.env.MORALIS_API_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjMxNmI3Yjc4LWU3ZGItNDkyZi1iNjM3LTkxYmE0ZTk0NmQ3YSIsIm9yZ0lkIjoiMzkyMjk1IiwidXNlcklkIjoiNDAzMDk5IiwidHlwZUlkIjoiMmU2MjMyNTUtYjQ3Mi00NTJkLWFkZWUtYWYwYjAzNmI2YzFmIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3MTU2OTg2NDIsImV4cCI6NDg3MTQ1ODY0Mn0.MOxb7fpJDIOW3CZZeP6dTW056IuZZYkRRDbv_r_6jZg";

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
    const apiKey = process.env.BSCSCAN_API_KEY || "Q5DHPUZX5HA9M4U7TMEJUCT4CF98RI645X";

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
