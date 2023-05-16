const express = require('express');
const bodyParser = require('body-parser');
const tf = require("@tensorflow/tfjs-node");
const use = require('@tensorflow-models/universal-sentence-encoder');

const app = express();
app.use(bodyParser.json());

//let model = null;
async function loadModel() {
  //if (!model) {
    model = await use.load();
  //}
  return model;
}

async function computeEmbeddings(req, res) {
  const { texts } = req.body;

  if (!Array.isArray(texts)) {
    return res.status(400).send('texts must be an array');
  }

  const model = await loadModel();
  const embeddings = await model.embed(texts)
  res_data = embeddings.arraySync();
  res.send({ 'embeddings':res_data });
}

app.get("/health-check", (req, res) => {
  res.status(200).send("OK");
});

app.post('/get_embeddings', computeEmbeddings);

app.listen(3001, () => {
  console.log('NLP microservice listening on port 3001');
});