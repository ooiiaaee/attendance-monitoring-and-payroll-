const mongoose = require("mongoose");

const staffNoteSchema = new mongoose.Schema(
  {
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: [true, "Note text is required"], trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StaffNote", staffNoteSchema);
