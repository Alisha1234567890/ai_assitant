import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Backend running"));

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    const aiRes = await axios.post("http://127.0.0.1:8000/ask", {
      question
    });

    res.json(aiRes.data);
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "AIno service failed" });
  }
});

app.listen(5000, () => {
  console.log("Backend on http://localhost:5000");
});