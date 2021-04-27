const express = require("express");
const mongo = require("mongodb").MongoClient;
const promClient = require('prom-client');
const promBundle = require("express-prom-bundle");
const promMetrics = promBundle({includePath: true});

const http_requests = new promClient.Counter({

  // Name of the counter as it will be stored in Prometheus and used in Grafana
  name: 'http_requests',
    
  // Help text. Not really used anywhere, but set it properly anyway
  help: 'Cumulative number of HTTP requests',
    
  // Extra labels (dimensions) of the metric. For HTTP Requests labels could be path, status_code, method
  // Anything we might want to use later to filter or aggregate subsets of the data
  labelNames: ['path']
});


const app = express();
app.use(promMetrics);

const url = `mongodb://${process.env.MONGODB_USERNAME}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@${process.env.MONGODB_HOST}:27017/${process.env.MONGODB_DATABASE}`;

function startWithRetry() {
  mongo.connect(url, { 
    useUnifiedTopology: true,
    useNewUrlParser: true,
    connectTimeoutMS: 1000,
    socketTimeoutMS: 1000,
  }, (err, client) => {
    if (err) {
      console.error(`Error connecting, retrying in 1 sec: ${err}`);
      setTimeout(startWithRetry, 1000);
      return;
    }

    const db = client.db(process.env.MONGODB_DATABASE);

    app.listen(8080, () => {
      app.get("/api/healthz", (req, res, next) => {
        http_requests.inc({'path': '/api/healthz'});
        res.sendStatus(200)
        return;
      });

      app.get("/api/movies", (req, res, next) => {
        console.log(`GET /api/movies`)
        http_requests.inc({'path': '/api/movies'});
        db.collection('movies').find().toArray( (err, results) =>{
          if (err){
            console.log(`failed to query movies: ${err}`)
            res.json([]);
            return;
          }
          res.json(results);
        });
      });

      app.get("/api/watching", (req, res, next) => {
        console.log(`GET /api/watching`)
        http_requests.inc({'path': '/api/watching'});
        db.collection('movies').find().toArray( (err, results) =>{
          if (err){
            console.log(`failed to query watching: ${err}`)
            res.json([]);
            return;
          }

          res.json(results);
        });
      });

      console.log("Server running on port 8080.");
    });
  });
};

startWithRetry();