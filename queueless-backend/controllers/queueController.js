
const mongoose = require("mongoose");
const Token = require("../models/Token");
const Business = require("../models/Business");

exports.joinQueue = async (req,res)=>{

  try {
    const { business_id, customerName, service } = req.body;
    const isAdminRequest = req.user?.role === "admin";
    const customerId = isAdminRequest ? null : req.user?.id;

    if(!mongoose.Types.ObjectId.isValid(String(business_id))){
      return res.status(400).json({message:"Invalid business id"});
    }

    if (!isAdminRequest && (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId)))) {
      return res.status(401).json({ message: "Login required to join queue" });
    }

    const activeExistingToken = isAdminRequest
      ? null
      : await Token.findOne({
          business_id,
          customer_id: customerId,
          status: { $in: ["waiting", "serving"] },
        }).lean();

    if (activeExistingToken) {
      return res.status(409).json({
        message: "You already have an active token for this business",
        token: activeExistingToken.token_number,
      });
    }

    const last = await Token.findOne({ business_id }).sort({ token_number: -1 }).lean();
    const next = last?.token_number ? last.token_number + 1 : 1;

    const created = await Token.create({
      customer_id: customerId,
      business_id,
      token_number: next,
      status: "waiting",
      customerName: customerName || "Customer",
      service: service || "General",
    });

    res.json({ token: next, tokenId: created._id.toString() });
  } catch (err) {
    return res.status(500).json({ message: "Failed to join queue" });
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
    const allowed = ["waiting", "serving", "completed", "cancelled"];

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
    return res.status(500).json({ message: "Failed to update token status" });
  }

};

exports.cancelMyToken = async (req, res) => {
  try {
    const customerId = req.user?.id;
    const { token_id, token_number, business_id } = req.body;

    if (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId))) {
      return res.status(401).json({ message: "Login required" });
    }

    if (
      !business_id ||
      !mongoose.Types.ObjectId.isValid(String(business_id))
    ) {
      return res.status(400).json({ message: "Invalid cancel payload" });
    }

    const tokenFilter = token_id && mongoose.Types.ObjectId.isValid(String(token_id))
      ? { _id: token_id }
      : { token_number: Number(token_number) };

    if (!tokenFilter._id && !Number.isFinite(tokenFilter.token_number)) {
      return res.status(400).json({ message: "Token reference is required" });
    }

    const updated = await Token.findOneAndUpdate(
      {
        ...tokenFilter,
        business_id,
        customer_id: customerId,
        status: { $in: ["waiting", "serving"] },
      },
      { status: "cancelled" },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "Active token not found" });
    }

    return res.json({ message: "Token cancelled" });
  } catch (err) {
    return res.status(500).json({ message: "Failed to cancel token" });
  }
};

exports.getMyHistory = async (req, res) => {
  try {
    const customerId = req.user?.id;

    if (!customerId || !mongoose.Types.ObjectId.isValid(String(customerId))) {
      return res.status(401).json({ message: "Login required" });
    }

    const tokens = await Token.find({ customer_id: customerId })
      .sort({ created_at: -1 })
      .lean();

    const businessIds = [...new Set(tokens.map((t) => String(t.business_id)))];
    const businesses = await Business.find({ _id: { $in: businessIds } }).lean();
    const businessMap = new Map(businesses.map((b) => [String(b._id), b.name]));

    const result = tokens.map((t) => ({
      id: t._id.toString(),
      token: t.token_number,
      businessId: String(t.business_id),
      business: businessMap.get(String(t.business_id)) || "Business",
      service: t.service || "General",
      status: t.status,
      customerName: t.customerName || "Customer",
      timestamp: t.created_at,
      updatedAt: t.updated_at,
    }));

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch queue history" });
  }
};
