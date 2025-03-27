import express from "express";
import cors from "cors";
import { AssemblyAI } from "assemblyai";
import dotenv from "dotenv";

dotenv.config();

const DEFAULT_API_KEY = "";

const app = express();
app.use(express.json());
app.use(cors());

app.get("/token", async (req, res) => {
  try {
    const apiKey = req.query.apiKey || DEFAULT_API_KEY;
    const client = new AssemblyAI({ apiKey: apiKey });
    
    const token = await client.realtime.createTemporaryToken({
      expires_in: 3600,
    });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.set("port", 8000);
const server = app.listen(app.get("port"), () => {
  console.log(`Server is running on port ${server.address().port}`);
});
