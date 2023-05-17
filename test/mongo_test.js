const MongoClient = require('mongodb').MongoClient;

const mongodbUri = "mongodb://admin:hotel_password@localhost:32000/hotel_db?authSource=admin&directConnection=true";

async function testMongoDBDirect() {
  const client = new MongoClient(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    await client.connect();

    const db = client.db('hotel_db');
    const collection = db.collection('test');

    // Insert a document
    const doc = { name: "Test Document", message: "This is a test document from Node.js." };
    const result = await collection.insertOne(doc);

    console.log("Inserted document with _id: " + result.insertedId);

    // Find one document
    const myDoc = await collection.findOne();
    console.log("Found one document: \n", myDoc);

  } catch (err) {
    console.error('Error connecting to MongoDB: ', err);
  } finally {
    await client.close();
  }
}

testMongoDBDirect();