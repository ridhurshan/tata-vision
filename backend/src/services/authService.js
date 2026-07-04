const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");

exports.register = async (user) => {
  const { fullName, email, password } = user;

  const [existing] = await db.query("SELECT * FROM users WHERE email=?", [email]);
  if (existing.length > 0) {
    throw new Error("Email already exists");
  }

  const hash = await bcrypt.hash(password, 10);

  await db.query(
    "INSERT INTO users(full_name, email, password) VALUES(?,?,?)",
    [fullName, email, hash]
  );

  return { message: "User Registered" };
};

exports.login = async (user) => {
  const { email, password } = user;

  const [result] = await db.query("SELECT * FROM users WHERE email=?", [email]);
  if (result.length === 0) {
    throw new Error("User Not Found");
  }

  const isMatch = await bcrypt.compare(password, result[0].password);
  if (!isMatch) {
    throw new Error("Wrong Password");
  }

  const token = jwt.sign(
    { id: result[0].id, email: result[0].email, role: result[0].role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    token,
    user: {
      id: result[0].id,
      name: result[0].full_name,
      email: result[0].email,
      role: result[0].role,
    },
  };
};