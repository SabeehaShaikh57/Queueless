const mongoose = require("mongoose");
const Faq = require("../models/Faq");

exports.listFaq = async (req, res) => {
  try {
    const items = await Faq.find().sort({ askedAt: -1 }).lean();
    const result = items.map((f) => ({ ...f, id: f._id.toString() }));
    res.json(result);
  } catch (err) {
    return res.status(500).json(err);
  }
};

exports.createFaq = async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();
    const askedBy = String(req.body?.askedBy || "Customer").trim();

    if (!question) {
      return res.status(400).json({ message: "Question is required" });
    }

    const created = await Faq.create({ question, askedBy });
    const payload = {
      id: created._id.toString(),
      question: created.question,
      askedBy: created.askedBy,
      askedAt: created.askedAt,
      answer: created.answer,
      answeredAt: created.answeredAt,
    };

    const io = req.app.get("io");
    if (io) io.emit("faq_submitted", payload);

    res.json(payload);
  } catch (err) {
    return res.status(500).json(err);
  }
};

exports.answerFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const answer = String(req.body?.answer || "").trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid FAQ id" });
    }

    if (!answer) {
      return res.status(400).json({ message: "Answer is required" });
    }

    const updated = await Faq.findByIdAndUpdate(
      id,
      { answer, answeredAt: new Date() },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ message: "FAQ not found" });
    }

    const payload = {
      id: updated._id.toString(),
      question: updated.question,
      askedBy: updated.askedBy,
      askedAt: updated.askedAt,
      answer: updated.answer,
      answeredAt: updated.answeredAt,
    };

    const io = req.app.get("io");
    if (io) io.emit("faq_answered", payload);

    res.json(payload);
  } catch (err) {
    return res.status(500).json(err);
  }
};
