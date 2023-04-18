const express = require("express");
const Twitter = require("twitter");
const puppeteer = require("puppeteer");
const { PDFDocument } = require("pdf-lib");
const axios = require("axios");
const fs = require("fs");

const app = express();
const client = new Twitter({
  consumer_key: "YOUR_CONSUMER_KEY",
  consumer_secret: "YOUR_CONSUMER_SECRET",
  access_token_key: "USER_ACCESS_TOKEN",
  access_token_secret: "USER_ACCESS_TOKEN_SECRET",
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Endpoint for getting the user's Twitter bookmarks
app.get("/bookmarks", async (req, res) => {
  try {
    const bookmarks = await client.get("bookmarks/list", {
      count: 50, // Change the count as per your need
    });

    res.json(bookmarks);
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// Endpoint for generating a PDF for each tweet in the user's Twitter bookmarks
app.get("/pdf", async (req, res) => {
  try {
    const bookmarks = await client.get("bookmarks/list", {
      count: 50, // Change the count as per your need
    });

    const tweets = bookmarks.map((bookmark) => bookmark.tweet);

    for (const tweet of tweets) {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();

      await page.goto(`https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`);

      // Wait for the tweet to load
      await page.waitForSelector(".css-901oao");

      // Take a screenshot of the tweet
      const screenshot = await page.screenshot();
      const pdf = await generatePDF(screenshot, tweet);

      // Save the PDF file to disk
      const fileName = `${tweet.id_str}.pdf`;
      const filePath = `./${fileName}`;
      fs.writeFileSync(filePath, pdf);

      // Send the PDF file to the client
      res.set({
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/pdf",
      });
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

      await browser.close();
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// Helper function to generate a PDF from a screenshot of a tweet
async function generatePDF(screenshot, tweet) {
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(screenshot);

  const link = `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id_str}`;
  const footer = `Link to tweet: ${link}`;
  const { width, height } = image.scale(0.5);
  const textWidth = PDFDocument.measureText(footer, { size: 8 });
  const textHeight = 8;
  const textX = width / 2 - textWidth / 2;
  const textY = textHeight / 2;

  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: width,
    height: height,
  });
  page.drawText(footer, {
    x: textX,
    y: textY,
    size: 8,
    opacity: 0.7,
});

return await pdfDoc.save();
}

app.listen(3000, () => console.log("Server running on port 3000"));