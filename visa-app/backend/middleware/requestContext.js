const crypto = require("crypto");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

function createRequestContext() {
  return (req, res, next) => {
    const incomingRequestId = String(req.get("x-request-id") || "").trim();
    const requestId = REQUEST_ID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  };
}

module.exports = { REQUEST_ID_PATTERN, createRequestContext };
