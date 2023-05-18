module.exports = {
  nlpService: {
    ipAddress: "nlp-service",
    port: 3001,
  },
  mongodb: {
    username: "admin",
    password: "hotel_password",
    host: "mongodb-svc.mongodb.svc.cluster.local",
    port: 27017,
    dbName: "hotel_db",
    authSource: "admin"
  }
};