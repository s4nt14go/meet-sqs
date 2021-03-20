function logResponse (requestParams:any, response:any, context:any, ee:any, next:any) {
  console.log("response.request.path:", response.request.path);
  console.log("response.request.body:", response.request.body);
  console.log("response.body:", response.body);
  return next();
}
module.exports = {
  logResponse
}

