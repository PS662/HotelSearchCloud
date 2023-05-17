const express = require("express");
const bodyParser = require("body-parser");
const MongoClient = require('mongodb').MongoClient;
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

const mongodbUri = "mongodb://admin:hotel_password@mongodb-svc.mongodb.svc.cluster.local:27017/hotel_db?authSource=admin";
//const mongodbUri = "mongodb://admin:hotel_password@localhost:32000/hotel_db?authSource=admin&directConnection=true";

app.post("/populate", async (req, res) => {
  const features = ['spa', 'ocean view', 'swimming pool', 'city view', 'fine dining', 'gym', 'free breakfast', 'beachfront', 'luxury', 'modern amenities', 'free Wi-Fi', 'parking'];
  const adjectives = ['Luxury', 'Beachfront', 'Modern', 'Cozy', 'Charming', 'Centrally-located', 'Boutique', 'Sophisticated', 'Vibrant', 'Peaceful'];
  const client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();

    const db = client.db('hotel_db');
    const collection = db.collection('hotel_annotations');

    const numAnnotations = req.body.numAnnotations || 10;

    const annotations = [];
    for (let i = 0; i < numAnnotations; i++) {
      const selectedFeatures = features.sort(() => 0.5 - Math.random()).slice(0, 3);
      const selectedAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];

      //FIXME: Construct the annotation string, probably should take arrays as input but works fine for random populate
      const annotation = `${selectedAdjective} hotel with ${selectedFeatures[0]}, ${selectedFeatures[1]}, and ${selectedFeatures[2]}.`;

      annotations.push({ annotation });
    }

    const result = await collection.insertMany(annotations);

    console.log("Inserted documents with _ids: ", result.insertedIds);

    res.status(200).json({ message: `Inserted ${result.insertedCount} documents.` });

  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
    res.status(500).send("Error populating database");
  } finally {
    await client.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});