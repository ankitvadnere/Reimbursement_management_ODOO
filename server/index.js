const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { processReceiptOCR } = require("./ocrService");

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

app.post("/ocr", upload.single("file"), async (req, res) => {
  try {
    const result = await processReceiptOCR(req.file.path);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "OCR failed" });
  }
});

app.listen(5000, () => console.log("OCR server running on port 5000"));