const express = require("express");
const bodyParser = require("body-parser");
const MongoClient = require('mongodb').MongoClient;
const { processQuery } = require("./nlp_utils"); 


const configName = process.env.CONFIG_NAME || 'local';
const config = require(`./config.${configName}`);
const mongodbUri = `mongodb://${config.mongodb.username}:${config.mongodb.password}@${config.mongodb.host}:${config.mongodb.port}/${config.mongodb.dbName}?authSource=${config.mongodb.authSource}` + (config.mongodb.directConnection ? "&directConnection=true" : "");


const app = express();
app.use(bodyParser.json());

let dbClient;

const connectToDb = async () => {
  const client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true , connectTimeoutMS: 100000});
  await client.connect();
  dbClient = client;
};


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


app.post("/compare", async (req, res) => {
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


app.post("/populate", async (req, res) => {
  const features = ['spa', 'ocean view', 'swimming pool', 'city view', 'fine dining', 'gym', 'free breakfast', 'beachfront', 'luxury', 'modern amenities', 'free Wi-Fi', 'parking'];
  const adjectives = ['Luxury', 'Beachfront', 'Modern', 'Cozy', 'Charming', 'Centrally-located', 'Boutique', 'Sophisticated', 'Vibrant', 'Peaceful'];
  function generateAnnotations() {
    return Array(3).fill().map(() => {
      const selectedFeatures = features.sort(() => 0.5 - Math.random()).slice(0, 3);
      const selectedAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      return `${selectedAdjective} hotel with ${selectedFeatures[0]}, ${selectedFeatures[1]}, and ${selectedFeatures[2]}.`;
    });
  }
  const client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const numAnnotations = req.body.numAnnotations || 10;
    const annotations = [];
    for (let i = 0; i < numAnnotations; i++) {
      const newAnnotations = generateAnnotations();
      const hotelId = await generateHotelId(client);
      annotations.push({ hotelId, annotations: newAnnotations });
    }
    const result = await collection.insertMany(annotations);
    console.log("Inserted documents with _ids: ", result.insertedIds);
    res.status(200).json({ message: `Inserted ${result.insertedCount} documents.` });
  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
    res.status(500).send("Error populating database");
  }
});


async function generateHotelId(client) {
  const db = client.db('hotel_db');
  const countersCollection = db.collection('counters');
  const result = await countersCollection.findOneAndUpdate(
    { _id: 'hotelId' },
    { $inc: { sequence_value: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return result.value.sequence_value;
}


app.post("/insert", async (req, res) => {
  const hotelId = req.body.hotelId; // This might be optional, I probably need to add more API validation, middeware to verify each request
  const newAnnotation = req.body.newAnnotations;
  const client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
    const db = client.db('hotel_db');
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    if(hotelId) {
      // If hotelid is provided, append to existing annotation
      const existingHotel = await collection.findOne({ hotelId });
      if(existingHotel) {
        const result = await collection.updateOne(
          { hotelId },
          { $push: { annotations: newAnnotation } } // Push new annotation to array
        );
        res.status(200).json({ message: `Updated ${result.modifiedCount} document.` });
      } else {
        // If no hotel exists with the given id, create a new one
        const result = await collection.insertOne({ hotelId, annotations: [newAnnotation] }); // Start with a new array of annotations
        res.status(200).json({ message: `Inserted document with _id: ${result.insertedId}` });
      }
    } else {
      // If no hotelid is provided, create a new one with a new id
      const newHotelId = await generateHotelId(client);
      const result = await collection.insertOne({ hotelId: newHotelId, annotations: [newAnnotation] }); // Start with a new array of annotations
      res.status(200).json({ message: `Inserted document with _id: ${result.insertedId} and hotel-id ${newHotelId}`});
    }
  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
    res.status(500).send("Error inserting into database");
  }
});


app.post("/search", async (req, res) => {
  const startTime = new Date().getTime();
  try {
    const userQuery = req.body.userQuery;
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const hotelsCursor = await collection.find({});
    const hotels = await hotelsCursor.toArray();
    const annotations = hotels.flatMap(hotel => hotel.annotations);

    const similarityStartTime = new Date().getTime();
    // Calculate similarities for all annotations in one call
    const similarities = await processQuery(userQuery, annotations, { timeout: 100000 });
    const similarityEndTime = new Date().getTime();

    const results = hotels.map((hotel, i) => {
      const annotationSimilarities = similarities.slice(i, i + hotel.annotations.length);
      const meanSimilarity = annotationSimilarities.reduce((a, b) => a + b, 0) / annotationSimilarities.length;
      const maxSimilarity = Math.max(...annotationSimilarities);
      return { hotelId: hotel.hotelId, annotations: hotel.annotations, meanSimilarity, maxSimilarity };
    });

    const sortStartTime = new Date().getTime();
    results.sort((a, b) => b.maxSimilarity - a.maxSimilarity);
    const sortEndTime = new Date().getTime();

    const executionTime = (new Date().getTime() - startTime)/1000;
    const similarityComputeTime = (similarityEndTime - similarityStartTime)/1000;
    const sortTime = (sortEndTime - sortStartTime)/1000;
    console.debug(`Total execution time: ${executionTime} s; similarity time: ${similarityComputeTime} s; sort time: ${sortTime} s`);

    res.status(200).json({
      executionTime,
      similarityComputeTime,
      sortTime,
      results
    });
  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
    res.status(500).send("Error searching database");
  }
});


app.post("/delete", async (req, res) => {
  const hotelId = req.body.hotelId;
  const deleteAll = req.body.deleteAll === true ? true : false;

  try {
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    if (deleteAll == true) {
      // Delete all records and reset the counter
      await collection.deleteMany({});
      const countersCollection = dbClient.db('hotel_db').collection('counters');
      await countersCollection.updateOne(
        { _id: 'hotelId' },
        { $set: { sequence_value: 0 } }
      );
      res.status(200).json({ message: "Deleted all documents and reset counter." });
    } else {
      const result = await collection.deleteOne({ hotelId });
      res.status(200).json({ message: `Deleted ${result.deletedCount} document.` });
    }
  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
    res.status(500).send("Error deleting document from database");
  }
});


app.post("/update", async (req, res) => {
  const hotelId = req.body.hotelId; 
  const newAnnotations = req.body.newAnnotations;
  const client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const result = await collection.updateOne(
      { hotelId },
      { $set: { annotations: [newAnnotations] } }
    );
    if (result.modifiedCount > 0) {
      res.status(200).json({ message: `Updated ${result.modifiedCount} document.` });
    } else {
      res.status(404).json({ message: "No hotel found with the provided ID or no change done" });
    }
  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
    res.status(500).send("Error updating document in database");
  }
});


const PORT = process.env.PORT || 3000;

connectToDb().then(() => {
  app.listen(PORT, function () {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch((err) => {
  console.log('Error connecting to database', err);
  process.exit(1);
});

process.on('exit', () => {
  if (dbClient && dbClient.isConnected()) {
    dbClient.close();
  }
});