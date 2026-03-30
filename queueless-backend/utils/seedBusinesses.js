const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Business = require("../models/Business");

async function seedBusinessesFromJson() {
  try {
    // Check if businesses already exist
    const count = await Business.countDocuments();
    if (count > 0) {
      console.log(`✓ Businesses already seeded (${count} found)`);
      return;
    }

    // Read the JSON file
    const jsonPath = path.join(__dirname, "../../database/businesses.json");
    if (!fs.existsSync(jsonPath)) {
      console.log("⚠ businesses.json not found, skipping seed");
      return;
    }

    const rawData = fs.readFileSync(jsonPath, "utf-8");
    const businesses = JSON.parse(rawData);

    // Insert businesses
    const inserted = await Business.insertMany(businesses);
    console.log(`✓ Seeded ${inserted.length} businesses into MongoDB`);
  } catch (err) {
    console.error("Error seeding businesses:", err.message);
  }
}

module.exports = { seedBusinessesFromJson };
