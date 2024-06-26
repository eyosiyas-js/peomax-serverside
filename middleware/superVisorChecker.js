const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

module.exports = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.includes("Bearer ")
  ) {
    try {
      const token = req.headers.authorization.split("Bearer ")[1];

      if (!token) {
        res.status(403).send({ error: "No token provided" });
      }

      const decoded = jwt.verify(token, process.env.access_token_secret_key);

      req.user = decoded;
      const userData = await User.findOne({ userID: decoded.userID });

      if (userData.isBanned === true)
        return res.status(403).send({ error: "User is banned" });

      if (
        decoded.role === "supervisor" ||
        decoded.role === "manager" ||
        decoded.role === "admin"
      ) {
        next();
      } else {
        res.status(403).send({ error: "Action not allowed" });
      }
    } catch (err) {
      res.status(401).send({ error: "Invalid/expired Token" });
    }
  } else {
    res.status(401).send({ error: "Missing or invalid token" });
  }
};
