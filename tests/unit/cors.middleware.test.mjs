import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorsMiddleware } from '../../src/middlewares/cors.middleware.mjs';

const createResponse = () => {
  const headers = new Map();

  return {
    headers,
    status: null,
    setHeader: (name, value) => headers.set(name, value),
    sendStatus(status) {
      this.status = status;
      return this;
    }
  };
};

test('CORS allows the configured frontend origin',()=>{
  const middleware=createCorsMiddleware('http://localhost:3000');
  const req={method:'GET',get:()=> 'http://localhost:3000'};
  const res=createResponse();
  let nextCalled=false;

  middleware(req,res,()=>{nextCalled=true;});

  assert.equal(
    res.headers.get('Access-Control-Allow-Origin'),
    'http://localhost:3000'
  );
  assert.equal(nextCalled,true);
});

test('CORS completes browser preflight without entering routes',()=>{
  const middleware=createCorsMiddleware('http://localhost:3000');
  const req={method:'OPTIONS',get:()=> 'http://localhost:3000'};
  const res=createResponse();
  let nextCalled=false;

  middleware(req,res,()=>{nextCalled=true;});

  assert.equal(res.status,204);
  assert.equal(nextCalled,false);
});
