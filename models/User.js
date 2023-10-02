let mongoose = require("mongoose");
let UserSchema = new mongoose.Schema({
  username: { type: String, required: true, min: 4 },
  password: { type: String, required: true },
});

let UserModel = mongoose.model("User", UserSchema);

module.exports = UserModel;
