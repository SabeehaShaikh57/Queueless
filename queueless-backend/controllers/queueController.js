
const mongoose = require("mongoose");
const Token = require("../models/Token");

exports.joinQueue = async (req,res)=>{

  try {
    const {business_id, customerName, service} = req.body;

    if(!mongoose.Types.ObjectId.isValid(String(business_id))){
      return res.status(400).json({message:"Invalid business id"});
    }

    const last = await Token.findOne({ business_id }).sort({ token_number: -1 }).lean();
    const next = last?.token_number ? last.token_number + 1 : 1;

    await Token.create({
      business_id,
      token_number: next,
      status: "waiting",
      customerName: customerName || "Customer",
      service: service || "General",
    });

    res.json({ token: next });
  } catch (err) {
    return res.status(500).json(err);
  }

};

exports.getQueue = async (req,res)=>{

  try {
    const {business_id} = req.params;

    if(!mongoose.Types.ObjectId.isValid(String(business_id))){
      return res.status(400).json({message:"Invalid business id"});
    }

    const tokens = await Token.find({
      business_id,
      status: { $in: ["waiting", "serving"] },
    })
      .sort({ token_number: 1 })
      .lean();

    const result = tokens.map((t) => ({
      ...t,
      id: t._id.toString(),
    }));

    res.json(result);
  } catch (err) {
    return res.status(500).json(err);
  }

};

exports.nextToken = async (req,res)=>{

  try {
    const {business_id} = req.body;

    if(!mongoose.Types.ObjectId.isValid(String(business_id))){
      return res.status(400).json({message:"Invalid business id"});
    }

    const token = await Token.findOne({ business_id, status: "waiting" }).sort({ token_number: 1 });

    if(!token){
      return res.status(404).json({message:"No tokens"});
    }

    token.status = "serving";
    await token.save();

    res.json({served: token.token_number, status: "serving"});
  } catch (err) {
    return res.status(500).json(err);
  }

};

exports.moveTokenUp = async (req,res)=>{

  try {
    const { token_id, business_id } = req.body;

    if(
      !token_id ||
      !business_id ||
      !mongoose.Types.ObjectId.isValid(String(token_id)) ||
      !mongoose.Types.ObjectId.isValid(String(business_id))
    ){
      return res.status(400).json({message:"Invalid token move payload"});
    }

    const token = await Token.findOne({ _id: token_id, business_id });

    if(!token){
      return res.status(404).json({message:"Token not found"});
    }

    const previous = await Token.findOne({
      business_id,
      status: { $in: ["waiting", "serving"] },
      token_number: { $lt: token.token_number },
    }).sort({ token_number: -1 });

    if(!previous){
      return res.json({message:"Token already at top"});
    }

    const currentNumber = token.token_number;
    token.token_number = previous.token_number;
    previous.token_number = currentNumber;

    await previous.save();
    await token.save();

    res.json({message:"Token moved up"});
  } catch (err) {
    return res.status(500).json(err);
  }

};

exports.updateTokenStatus = async (req,res)=>{

  try {
    const { token_id, business_id, status } = req.body;
    const allowed = ["waiting", "serving", "completed"];

    if(
      !token_id ||
      !business_id ||
      !allowed.includes(status) ||
      !mongoose.Types.ObjectId.isValid(String(token_id)) ||
      !mongoose.Types.ObjectId.isValid(String(business_id))
    ){
      return res.status(400).json({message:"Invalid token update payload"});
    }

    const result = await Token.findOneAndUpdate(
      { _id: token_id, business_id },
      { status },
      { new: true }
    );

    if(!result){
      return res.status(404).json({message:"Token not found"});
    }

    res.json({message:"Token status updated"});
  } catch (err) {
    return res.status(500).json(err);
  }

};
