const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderlust";
const CATEGORIES = ["Beach", "Mountain", "City", "Farm", "Lake", "Desert"];

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(MONGO_URL);
}

const initDB = async () => {
  await Listing.deleteMany({});
  const dataWithCategory = initData.data.map((listing, index) => ({
    ...listing,
    category: listing.category || CATEGORIES[index % CATEGORIES.length],
  }));
  await Listing.insertMany(dataWithCategory);
  console.log("data was initialized");
};

initDB();
