export const notFoundHandler=(_req,res)=>{
  res.status(404).json({error:'route_not_found'});
};

export const errorHandler=(error,_req,res,_next)=>{
  const status=Number(error.statusCode)||500;
  const isSafe=status>=400&&status<500;
  const message=isSafe?error.message:'Unexpected server or MCP error. Check backend logs.';
  if (status>=500) console.error('Backend error:',error?.name||'Error');
  res.status(status).json({
    error:message,
    ...(error.retryAfterSeconds?{retryAfterSeconds:error.retryAfterSeconds}:{})
  });
};
