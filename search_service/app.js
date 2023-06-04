const express = require("express");
const bodyParser = require("body-parser");
const MongoClient = require('mongodb').MongoClient;
const tf = require("@tensorflow/tfjs-node");
const { compareQueries, processBatchQuery, cosineSimilarity} = require("./nlp_utils"); 


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
        <p>This is a hotel search service, served via Express Server.</p>
      </body>
    </html>
  `);
});


app.post("/compare", async (req, res) => {
  const userQuery = req.body.userQuery;
  const hotelAnnotations = req.body.hotelAnnotations;
  try {
    const similarities = await compareQueries(userQuery, hotelAnnotations);
    res.status(200).json(similarities);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing query");
  }
});


app.post("/populate", async (req, res) => {
  const startTime = new Date().getTime();
  const features = ['spa', 'ocean view', 'swimming pool', 'city view', 'fine dining', 'gym', 'free breakfast', 'beachfront', 'luxury', 'modern amenities', 'free Wi-Fi', 'parking'];
  const adjectives = ['Luxury', 'Beachfront', 'Modern', 'Cozy', 'Charming', 'Centrally-located', 'Boutique', 'Sophisticated', 'Vibrant', 'Peaceful'];
  function generateAnnotations() {
    return Array(3).fill().map(() => {
      const selectedFeatures = features.sort(() => 0.5 - Math.random()).slice(0, 3);
      const selectedAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      return `${selectedAdjective} hotel with ${selectedFeatures[0]}, ${selectedFeatures[1]}, and ${selectedFeatures[2]}.`;
    });
  }
  try {
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const numAnnotations = req.body.numAnnotations || 10;
    const annotations = [];
    for (let i = 0; i < numAnnotations; i++) {
      const newAnnotations = generateAnnotations();
      const hotelId = await generateHotelId(dbClient);
      const embeddings = await processBatchQuery(newAnnotations);
      if (embeddings.length !== newAnnotations.length) {
        throw new Error("Number of embeddings doesn't match the number of annotations");
      }
      annotations.push({
        hotelId,
        annotations: newAnnotations,
        'embeddings-use': embeddings
      });
    }
    const result = await collection.insertMany(annotations);
    console.log("Inserted documents with _ids: ", result.insertedIds);
    const executionTime = (new Date().getTime() - startTime)/1000;
    res.status(200).json({ message: `Inserted ${result.insertedCount} documents in ${executionTime} seconds` });
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
  const hotelId = req.body.hotelId;
  const newAnnotations = Array.isArray(req.body.newAnnotations) ? req.body.newAnnotations : [req.body.newAnnotations];
  try {
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const embeddings = await processBatchQuery(newAnnotations);

    if (embeddings.length !== newAnnotations.length) {
      throw new Error("Number of embeddings doesn't match the number of annotations");
    }
    if (hotelId) {
      const existingHotel = await collection.findOne({ hotelId });
      if(existingHotel) {
        const result = await collection.updateOne(
          { hotelId },
          { 
            $push: { 
              annotations: { $each: newAnnotations }, 
              'embeddings-use': { $each: embeddings } 
            } 
          }
        );
        res.status(200).json({ message: `Updated ${result.modifiedCount} document.` });
      } else {
        const result = await collection.insertOne({ 
          hotelId, 
          annotations: newAnnotations, 
          'embeddings-use': embeddings 
        });
        res.status(200).json({ message: `Inserted document with _id: ${result.insertedId}` });
      }
    } else {
      const newHotelId = await generateHotelId();
      const result = await collection.insertOne({ 
        hotelId: newHotelId, 
        annotations: newAnnotations, 
        'embeddings-use': embeddings 
      });
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
    const similarities = await compareQueries(userQuery, annotations, { timeout: 100000 });
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


app.post("/searchEmbeddings", async (req, res) => {
  const startTime = new Date().getTime();
  try {
    const userQuery = req.body.userQuery;
    const userEmbeddingTimeStart = new Date().getTime();
    const userEmbeddings = (await processBatchQuery([userQuery]))[0];
    const userEmbeddingTimeEnd = new Date().getTime();
    const embeddingQueryTimeStart = new Date().getTime();
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const hotelsCursor = await collection.find({});
    const hotels = await hotelsCursor.toArray();
    const hotelEmbeddings = hotels.flatMap(hotel => hotel['embeddings-use']);
    const embeddingQueryTimeEnd = new Date().getTime();

    const similarityStartTime = new Date().getTime();
    const similarities = cosineSimilarity(tf.tensor2d([userEmbeddings]), tf.tensor2d(hotelEmbeddings));
    let similarityIndex = 0;
    const results = hotels.map((hotel, i) => {
      const hotelSimilarities = similarities.slice(similarityIndex, similarityIndex + hotel.annotations.length);
      similarityIndex += hotel.annotations.length;
      const meanSimilarity = hotelSimilarities.reduce((a, b) => a + b, 0) / hotelSimilarities.length;
      const maxSimilarity = Math.max(...hotelSimilarities);
      return { hotelId: hotel.hotelId, annotations: hotel.annotations, meanSimilarity, maxSimilarity };
    });
    const similarityEndTime = new Date().getTime();

    const sortTimeStart = new Date().getTime();
    results.sort((a, b) => b.maxSimilarity - a.maxSimilarity);
    const sortTimeEnd = new Date().getTime();

    const userEmbeddingTime = (userEmbeddingTimeEnd - userEmbeddingTimeStart)/1000;
    const embeddingQueryTime = (embeddingQueryTimeEnd - embeddingQueryTimeStart)/1000;
    const similarityComputeTime = (similarityEndTime - similarityStartTime)/1000;
    const sortTime = (sortTimeEnd - sortTimeStart)/1000;
    const executionTime = (new Date().getTime() - startTime)/1000;
    console.debug(`Total execution time: ${executionTime} s; user embedding time: ${userEmbeddingTime} s; embedding query time: ${embeddingQueryTime} s; similarity compute time: ${similarityComputeTime} s; sort time: ${sortTime} s`);

    res.status(200).json({
      executionTime,
      userEmbeddingTime,
      embeddingQueryTime,
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
  const newAnnotations = Array.isArray(req.body.newAnnotations) ? req.body.newAnnotations : [req.body.newAnnotations];
  try {
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const embeddings = await processBatchQuery(newAnnotations, { timeout: 100000 });
    if (embeddings.length !== newAnnotations.length) {
      throw new Error("Number of embeddings doesn't match the number of annotations");
    }
    const result = await collection.updateOne(
      { hotelId },
      { 
        $set: { 
          'annotations': newAnnotations,
          'embeddings-use': embeddings 
        }
      }
    );
    if (result.modifiedCount > 0) {
      res.status(200).json({ message: `Updated ${result.modifiedCount} document.` });
    } else {
      res.status(404).json({ message: `No hotel found with the provided ID or no change done` });
    }
  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
    res.status(500).send("Error updating document in database");
  }
});


async function saveEmbeddingsBulk(collection, allHotels) {
  try {
    const allAnnotations = allHotels.flatMap(hotel => hotel.annotations);
    const allEmbeddings = await processBatchQuery(allAnnotations);
    // prepare the ops array
    const bulkOps = allHotels.map((hotel, index) => {
      const hotelEmbeddings = allEmbeddings.slice(index, index + hotel.annotations.length);
      return {
        updateOne: {
          filter: { hotelId: hotel.hotelId },
          update: { $set: { "embeddings-use": hotelEmbeddings } }
        }
      };
    });
    // execute the bulk operation
    const result = await collection.bulkWrite(bulkOps);
    return result;
  } catch (error) {
    console.error('Error during batch embedding calculation and saving: ', error);
    throw error;
  }
}


app.post("/enrol", async (req, res) => {
  try {
    const collection = dbClient.db('hotel_db').collection('hotel_annotations');
    const allHotels = await collection.find({}).toArray();
    
    const bulkWriteResult = await saveEmbeddingsBulk(collection, allHotels);
    
    res.status(200).json({ message: "Embeddings calculated and saved successfully.", modifiedCount: bulkWriteResult.modifiedCount });
  } catch (err) {
    console.error('Error in /enrol endpoint: ', err);
    res.status(500).send("Error enrolling hotel annotations.");
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