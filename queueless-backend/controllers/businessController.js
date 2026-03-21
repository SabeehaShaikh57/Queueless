
const mongoose = require("mongoose");
const Business = require("../models/Business");
const Token = require("../models/Token");

exports.createBusiness = async (req,res)=>{

  try {
    const {name,type,location} = req.body;

    const business = await Business.create({name,type,location});

    res.json({message:"Business created", id: business._id.toString()});
  } catch (err) {
    return res.status(500).json(err);
  }

};

exports.getBusinesses = async (req,res)=>{

  try {
    const businesses = await Business.find().sort({ createdAt: -1 }).lean();
    const result = businesses.map((b) => ({
      ...b,
      id: b._id.toString(),
    }));
    res.json(result);
  } catch (err) {
    return res.status(500).json(err);
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

    res.json({message:"Business deleted"});
  } catch (err) {
    return res.status(500).json(err);
  }

};
