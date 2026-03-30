
const mongoose = require("mongoose");
const Business = require("../models/Business");
const Token = require("../models/Token");

exports.createBusiness = async (req,res)=>{

  try {
    const name = String(req.body?.name || "").trim();
    const type = String(req.body?.type || "other").trim();
    const hours = String(req.body?.hours || "").trim();
    const services = Array.isArray(req.body?.services) ? req.body.services : [];

    const rawLocation = String(req.body?.location || "").trim();
    const rawAddress = String(req.body?.address || "").trim();
    const rawCity = String(req.body?.city || "").trim();

    const locParts = rawLocation.split(",").map((p) => p.trim()).filter(Boolean);
    const addressFromLocation = locParts.length > 1 ? locParts.slice(0, -1).join(", ") : rawLocation;
    const cityFromLocation = locParts.length > 1 ? locParts[locParts.length - 1] : "";

    const address = rawAddress || addressFromLocation;
    const city = rawCity || cityFromLocation || rawLocation;

    if (!name || !address) {
      return res.status(400).json({ message: "Name and location are required" });
    }

    const business = await Business.create({
      name,
      type,
      address,
      city: city || "Unknown",
      hours,
      services,
    });

    const payload = {
      id: business._id.toString(),
      name: business.name,
      type: business.type,
      address: business.address,
      city: business.city,
      location: business.city ? `${business.address}, ${business.city}` : business.address,
      hours: business.hours,
      services: business.services,
    };

    const io = req.app.get("io");
    if (io) {
      io.emit("business_changed", { action: "created", business: payload });
    }

    res.json({
      message:"Business created", 
      id: business._id.toString(),
      business: payload,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to create business" });
  }

};

exports.getBusinesses = async (req,res)=>{

  try {
    const businesses = await Business.find().sort({ createdAt: -1 }).lean();
    const result = businesses.map((b) => {
      const constLocation = String(b.location || "").trim();
      const constAddress = String(b.address || "").trim();
      const constCity = String(b.city || "").trim();

      return {
        id: b._id.toString(),
        name: b.name,
        type: b.type,
        address: constAddress || constLocation,
        city: constCity || (constLocation.includes(",") ? constLocation.split(",").pop().trim() : constLocation),
        location: constLocation || (constCity ? `${constAddress}, ${constCity}` : constAddress),
        hours: b.hours,
        services: Array.isArray(b.services) ? b.services : [],
      };
    });
    res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch businesses" });
  }

};

exports.deleteBusiness = async (req,res)=>{

  try {
    const { id } = req.params;

    if(!mongoose.Types.ObjectId.isValid(id)){
      return res.status(400).json({message:"Invalid business id"});
    }

    await Token.deleteMany({ business_id: id });
    const result = await Business.findByIdAndDelete(id);

    if(!result){
      return res.status(404).json({message:"Business not found"});
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("business_changed", { action: "deleted", businessId: id });
    }

    res.json({message:"Business deleted"});
  } catch (err) {
    return res.status(500).json({ message: "Failed to delete business" });
  }

};
