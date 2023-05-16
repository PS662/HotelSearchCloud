//const fetch = require('node-fetch');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const tf = require("@tensorflow/tfjs-node");

const configName = process.env.CONFIG_NAME || 'local';
const config = require(`./config.${configName}`);

function cosineSimilarity(a, b) {
  a = a.cast("float32");
  b = b.cast("float32");
  const dotProduct = a.mul(b).sum(1);
  const normA = a.norm(2, 1);
  const normB = b.norm(2, 1);
  const similarity = dotProduct.div(normA.mul(normB));
  return similarity.arraySync();
}

async function processQuery(userQuery, hotelAnnotations) {
  const nlpServiceUrl = `http://${config.nlpService.ipAddress}:${config.nlpService.port}/get_embeddings`;
  const embeddingsRes = await fetch(nlpServiceUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [userQuery, ...hotelAnnotations] })
  });
  const embeddingsData = await embeddingsRes.json();
  const embeddings = embeddingsData.embeddings;
  const userEmbeddings = embeddings[0];
  const hotelEmbeddings = embeddings.slice(1);
  const similarities = cosineSimilarity(tf.tensor2d([userEmbeddings]), tf.tensor2d(hotelEmbeddings));
  return similarities[0];
}

module.exports = { processQuery };