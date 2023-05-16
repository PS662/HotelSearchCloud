const express = require("express");
const bodyParser = require("body-parser");
const { processQuery } = require("./nlp_utils"); 

const app = express();
app.use(bodyParser.json());

app.get("/health-check", (req, res) => {
  res.status(200).send("OK");
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Hotel Search</title>
      </head>
      <body>
        <p>This is a hotel search service, served via Express.</p>
      </body>
    </html>
  `);
});

app.post("/search", async (req, res) => {
  const userQuery = req.body.userQuery;
  const hotelAnnotations = req.body.hotelAnnotations;

  try {
    const similarities = await processQuery(userQuery, hotelAnnotations);
    res.status(200).json(similarities);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing query");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});