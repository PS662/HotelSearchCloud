const axios = require("axios");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv)).argv;

const BASE_URL = argv.host || "http://localhost:3000";

const userQuery = argv.userQuery || "I'm looking for a hotel with a spa and an ocean view.";
const hotelId = argv.hotelId || 1;
const newAnnotation = argv.newAnnotation || "Test new annotation for the hotel.";
const numAnnotations = argv.numAnnotations || 10;
const deleteAll = argv.deleteAll === "true" ? true : false;

async function testCompareEndpoint() {
  console.log("Compare");
  const hotelAnnotations = [
    "Hotel with a spa, ocean view, and swimming pool.",
    "Luxury hotel with a city view and fine dining.",
    "Beachfront hotel with a gym and free breakfast.",
  ];

  try {
    const response = await axios.post(`${BASE_URL}/compare`, {
      userQuery: userQuery,
      hotelAnnotations: hotelAnnotations,
    });

    console.log("Status:", response.status);
    console.log("Search Similarities:", response.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function testInsertEndpoint() {
  console.log("Insert");
  try {
    const response = await axios.post(`${BASE_URL}/insert`, {
      hotelId: hotelId,
      newAnnotations: newAnnotation,
    });

    console.log("Status:", response.status);
    console.log("Response:", response.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function testSearchEndpoint() {
  console.log("Search");
  try {
    const response = await axios.post(`${BASE_URL}/search`, {
      userQuery: userQuery,
    });

    console.log("Status:", response.status);
    console.log("Search Results:", response.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function testDeleteEndpoint() {
  console.log("Delete");
  try {
    const response = await axios.post(`${BASE_URL}/delete`, {
      hotelId: hotelId,
      deleteAll: deleteAll
    });

    console.log("Status:", response.status);
    console.log("Response:", response.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function testUpdateEndpoint() {
  console.log("Update");
  try {
    const response = await axios.post(`${BASE_URL}/update`, {
      hotelId: hotelId,
      newAnnotations: newAnnotation,
    });

    console.log("Status:", response.status);
    console.log("Response:", response.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

async function populateDatabase() {
  console.log("Populate");
  try {
    const response = await axios.post(`${BASE_URL}/populate`, {
      numAnnotations: numAnnotations
    });
    console.log("Response Status:", response.status);
    console.log("Response Data:", response.data);
  } catch (err) {
    console.error('Error while populating database: ', err.message);
  }
}

if (argv._.includes('compare') || argv.all) {
  testCompareEndpoint();
}

if (argv._.includes('insert') || argv.all) {
  testInsertEndpoint();
}

if (argv._.includes('search') || argv.all) {
  testSearchEndpoint();
}

if (argv._.includes('update') || argv.all) {
  testUpdateEndpoint();
}

if (argv._.includes('populate') || argv.all) {
  populateDatabase();
}

if (argv._.includes('delete') || argv.all) {
  testDeleteEndpoint();
}