require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');

async function checkCollections() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cinelog';
  await mongoose.connect(mongoURI);
  console.log('Connected to:', mongoURI.replace(/:([^:@]+)@/, ':****@'));

  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();

  for (const coll of collections) {
    console.log(`Collection: ${coll.name}`);
    console.log(`- Type: ${coll.type}`);
    if (coll.options && coll.options.timeseries) {
      console.log(`- TimeSeries Options:`, coll.options.timeseries);
    }
  }

  process.exit(0);
}

checkCollections();
