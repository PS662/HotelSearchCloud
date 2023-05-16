const axios = require("axios");
async function testSearchEndpoint() {
  const userQuery = "I'm looking for a hotel with a spa and an ocean view.";
  const hotelAnnotations = [
    "Hotel with a spa, ocean view, and swimming pool.",
    "Luxury hotel with a city view and fine dining.",
    "Beachfront hotel with a gym and free breakfast.",
  ];

  try {
    const response = await axios.post("http://localhost:3000/search", {
      userQuery: userQuery,
      hotelAnnotations: hotelAnnotations,
    });

    console.log("Status:", response.status);
    console.log("Search Similarities:", response.data);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testSearchEndpoint();