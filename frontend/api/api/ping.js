module.exports = (req, res) => {
  res.json({ message: "pong", time: new Date().toISOString() });
};
