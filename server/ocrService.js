/**
 * OCR SERVICE
 * Uses Tesseract.js to extract text from receipt images/PDFs.
 * After extracting raw text, uses regex + heuristics to parse:
 *   - Total amount
 *   - Date
 *   - Merchant name
 *   - Line items
 *   - Currency
 *   - Tax amounts
 */

const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ── IMAGE PREPROCESSING ────────────────────────────────────────────────────────
/**
 * Preprocess image for better OCR accuracy:
 * - Convert to grayscale
 * - Increase contrast
 * - Resize to optimal DPI
 */
async function preprocessImage(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  const outputPath = imagePath.replace(ext, '_processed.png');

  try {
    await sharp(imagePath)
      .grayscale()
      .normalize()           // Auto-levels contrast
      .sharpen()             // Improve text clarity
      .resize({ width: 2000, withoutEnlargement: false }) // Optimal OCR resolution
      .png({ quality: 100 })
      .toFile(outputPath);

    return outputPath;
  } catch (err) {
    console.warn('Image preprocessing failed, using original:', err.message);
    return imagePath;
  }
}

// ── CURRENCY DETECTION ─────────────────────────────────────────────────────────
const CURRENCY_PATTERNS = [
  { pattern: /\$\s*[\d,]+\.?\d*/g, code: 'USD', symbol: '$' },
  { pattern: /USD\s*[\d,]+\.?\d*/gi, code: 'USD', symbol: '$' },
  { pattern: /£\s*[\d,]+\.?\d*/g, code: 'GBP', symbol: '£' },
  { pattern: /GBP\s*[\d,]+\.?\d*/gi, code: 'GBP', symbol: '£' },
  { pattern: /€\s*[\d,]+\.?\d*/g, code: 'EUR', symbol: '€' },
  { pattern: /EUR\s*[\d,]+\.?\d*/gi, code: 'EUR', symbol: '€' },
  { pattern: /₹\s*[\d,]+\.?\d*/g, code: 'INR', symbol: '₹' },
  { pattern: /INR\s*[\d,]+\.?\d*/gi, code: 'INR', symbol: '₹' },
  { pattern: /¥\s*[\d,]+\.?\d*/g, code: 'JPY', symbol: '¥' },
  { pattern: /JPY\s*[\d,]+\.?\d*/gi, code: 'JPY', symbol: '¥' },
  { pattern: /CA\$\s*[\d,]+\.?\d*/g, code: 'CAD', symbol: 'CA$' },
  { pattern: /A\$\s*[\d,]+\.?\d*/g, code: 'AUD', symbol: 'A$' },
  { pattern: /S\$\s*[\d,]+\.?\d*/g, code: 'SGD', symbol: 'S$' },
  { pattern: /AED\s*[\d,]+\.?\d*/gi, code: 'AED', symbol: 'AED' },
  { pattern: /CHF\s*[\d,]+\.?\d*/gi, code: 'CHF', symbol: 'CHF' },
  { pattern: /CNY\s*[\d,]+\.?\d*/gi, code: 'CNY', symbol: '¥' },
];

function detectCurrency(text) {
  for (const { pattern, code } of CURRENCY_PATTERNS) {
    if (pattern.test(text)) {
      pattern.lastIndex = 0; // reset regex state
      return code;
    }
  }
  return 'USD'; // default fallback
}

// ── AMOUNT EXTRACTION ──────────────────────────────────────────────────────────
/**
 * Finds the total amount from receipt text.
 * Priority: "Total", "Grand Total", "Amount Due", "Balance Due"
 * Falls back to the largest number found.
 */
function extractAmount(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Priority keywords for total line
  const totalKeywords = [
    /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*amount|net\s*total)\b/i,
    /\b(total)\b/i,
    /\b(subtotal|sub\s*total)\b/i,
  ];

  for (const keywordRe of totalKeywords) {
    for (const line of lines) {
      if (keywordRe.test(line)) {
        // Extract number from this line
        const numMatch = line.match(/[\d,]+\.\d{2}|\d+/g);
        if (numMatch) {
          const amounts = numMatch.map(n => parseFloat(n.replace(/,/g, '')));
          const largest = Math.max(...amounts.filter(a => a > 0));
          if (largest > 0) return largest;
        }
      }
    }
  }

  // Fallback: find all monetary values and return the largest
  const allNumbers = [];
  const moneyRe = /(?:[$€£₹¥]|USD|EUR|GBP|INR)\s*([\d,]+\.?\d*)|(\b[\d,]+\.\d{2}\b)/g;
  let match;
  while ((match = moneyRe.exec(text)) !== null) {
    const val = parseFloat((match[1] || match[2]).replace(/,/g, ''));
    if (!isNaN(val) && val > 0) allNumbers.push(val);
  }

  if (allNumbers.length) return Math.max(...allNumbers);
  return null;
}

// ── DATE EXTRACTION ────────────────────────────────────────────────────────────
function extractDate(text) {
  const datePatterns = [
    // MM/DD/YYYY or DD/MM/YYYY
    /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/,
    // Month name formats: Jan 15, 2024 | 15 January 2024 | January 15, 2024
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})\b/i,
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i,
    // YYYY-MM-DD (ISO)
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
  ];

  const monthMap = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        let dateStr;
        if (pattern.source.includes('jan|feb')) {
          // Named month format
          if (/^\d/.test(match[1])) {
            // DD Month YYYY
            const month = monthMap[match[2].toLowerCase().slice(0, 3)];
            dateStr = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`;
          } else {
            // Month DD YYYY
            const month = monthMap[match[1].toLowerCase().slice(0, 3)];
            dateStr = `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
          }
        } else if (match[1].length === 4) {
          // YYYY-MM-DD
          dateStr = `${match[1]}-${match[2]}-${match[3]}`;
        } else {
          // MM/DD/YYYY or DD/MM/YYYY — assume MM/DD for US receipts
          const year = match[3].length === 2 ? `20${match[3]}` : match[3];
          dateStr = `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
        }

        const parsed = new Date(dateStr);
        if (!isNaN(parsed) && parsed.getFullYear() > 2000) {
          return parsed.toISOString().split('T')[0];
        }
      } catch {
        continue;
      }
    }
  }

  return new Date().toISOString().split('T')[0]; // fallback to today
}

// ── MERCHANT NAME EXTRACTION ───────────────────────────────────────────────────
/**
 * Merchant name is usually in the first 3-5 lines of a receipt
 * before address/phone/date info appears.
 */
function extractMerchantName(text) {
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  // Skip lines that look like addresses, phones, dates, or common header words
  const skipPatterns = [
    /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,  // phone numbers
    /\b(street|st|ave|blvd|rd|road|lane|ln|dr|suite|ste|floor|fl)\b/i,
    /\b(tel|phone|fax|email|www|http)/i,
    /^\d+\s+[a-z]/i,  // street address
    /\breceipt\b/i,
    /\binvoice\b/i,
    /\bdate\b/i,
    /\btime\b/i,
    /^[#*=\-_]{3,}/,  // separator lines
  ];

  for (const line of lines.slice(0, 6)) {
    const isSkip = skipPatterns.some(p => p.test(line));
    if (!isSkip && line.length >= 3 && line.length <= 60) {
      // Clean up common receipt artifacts
      return line
        .replace(/[*#=_\-|]{2,}/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  return null;
}

// ── LINE ITEMS EXTRACTION ──────────────────────────────────────────────────────
/**
 * Extracts individual line items from the receipt.
 * Pattern: description followed by price at end of line.
 */
function extractLineItems(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];

  // Skip header/footer lines
  const skipKeywords = /\b(total|subtotal|tax|tip|discount|change|cash|card|visa|mastercard|receipt|invoice|thank|date|time|server|table|order)\b/i;

  for (const line of lines) {
    if (skipKeywords.test(line)) continue;

    // Pattern: "Item Description    $12.50" or "2x Coffee   5.00"
    const lineItemRe = /^(.+?)\s+(\d+)?\s*x?\s*([\d,]+\.?\d*)\s*$/;
    const match = line.match(lineItemRe);

    if (match) {
      const description = match[1].trim();
      const quantity = match[2] ? parseInt(match[2]) : 1;
      const price = parseFloat(match[3].replace(/,/g, ''));

      // Filter out lines that are just numbers or too short
      if (description.length >= 3 && price > 0 && price < 100000) {
        items.push({
          description,
          quantity,
          unitPrice: price / quantity,
          totalPrice: price,
        });
      }
    }
  }

  return items.slice(0, 20); // cap at 20 line items
}

// ── EXPENSE CATEGORY INFERENCE ────────────────────────────────────────────────
function inferCategory(merchantName, text) {
  const combined = `${merchantName || ''} ${text}`.toLowerCase();

  const categoryKeywords = {
    'Meals & Entertainment': ['restaurant', 'cafe', 'coffee', 'food', 'dining', 'kitchen', 'burger', 'pizza', 'sushi', 'bar', 'pub', 'grill', 'diner', 'eatery', 'bistro', 'bakery'],
    'Travel': ['airline', 'flight', 'hotel', 'motel', 'airbnb', 'uber', 'lyft', 'taxi', 'cab', 'bus', 'train', 'rail', 'airport', 'transit', 'metro', 'parking', 'toll'],
    'Accommodation': ['hotel', 'motel', 'inn', 'resort', 'lodge', 'airbnb', 'hostel', 'suites'],
    'Office Supplies': ['office', 'staples', 'depot', 'paper', 'printer', 'toner', 'stationery', 'supplies'],
    'Software & Subscriptions': ['aws', 'azure', 'google cloud', 'saas', 'subscription', 'license', 'software', 'app store', 'adobe', 'microsoft', 'slack', 'zoom'],
    'Medical': ['pharmacy', 'medical', 'hospital', 'clinic', 'doctor', 'medicine', 'drug', 'health'],
    'Communication': ['phone', 'mobile', 'internet', 'carrier', 'telecom', 'courier', 'fedex', 'ups', 'dhl'],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => combined.includes(kw))) return category;
  }

  return 'Miscellaneous';
}

// ── MAIN OCR FUNCTION ──────────────────────────────────────────────────────────
async function processReceiptOCR(imagePath) {
  let processedPath = imagePath;

  try {
    // Step 1: Preprocess image
    processedPath = await preprocessImage(imagePath);

    // Step 2: Run Tesseract OCR
    console.log(`Running OCR on: ${path.basename(processedPath)}`);
    const { data } = await Tesseract.recognize(processedPath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r  OCR progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    console.log('\n  OCR complete');

    const rawText = data.text;
    const confidence = data.confidence;

    // Step 3: Parse extracted text
    const merchantName = extractMerchantName(rawText);
    const amount = extractAmount(rawText);
    const date = extractDate(rawText);
    const currency = detectCurrency(rawText);
    const lineItems = extractLineItems(rawText);
    const inferredCategory = inferCategory(merchantName, rawText);

    const parsed = {
      merchantName,
      amount,
      currencyCode: currency,
      expenseDate: date,
      inferredCategory,
      lineItems,
      confidence: Math.round(confidence),
    };

    // Cleanup preprocessed file
    if (processedPath !== imagePath && fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
    }

    return { rawText, parsed, confidence };
  } catch (err) {
    console.error('OCR processing error:', err);

    // Cleanup on error
    if (processedPath !== imagePath && fs.existsSync(processedPath)) {
      try { fs.unlinkSync(processedPath); } catch {}
    }

    // Return empty result rather than throwing
    return {
      rawText: '',
      parsed: {
        merchantName: null,
        amount: null,
        currencyCode: 'USD',
        expenseDate: new Date().toISOString().split('T')[0],
        inferredCategory: 'Miscellaneous',
        lineItems: [],
        confidence: 0,
      },
      confidence: 0,
    };
  }
}

module.exports = { processReceiptOCR };