import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMongooseModel,
  mongoPaginate
} from '../../src/middlewares/mongoose-pagination.middleware.mjs';

const createModel = ({ totalResults = 12 } = {}) => {
  const calls = {
    filter: null,
    sort: null,
    skip: null,
    limit: null,
    select: null,
    populates: []
  };
  const documents = [{
    toJSON: options => ({ id: 'lead-1', options: options || null })
  }];
  const query = {
    sort: value => {
      calls.sort = value;
      return query;
    },
    skip: value => {
      calls.skip = value;
      return query;
    },
    limit: value => {
      calls.limit = value;
      return query;
    },
    select: value => {
      calls.select = value;
      return query;
    },
    populate: value => {
      calls.populates.push(value);
      return query;
    },
    exec: async () => documents
  };
  const model = {
    collection: {},
    countDocuments: filter => ({
      exec: async () => {
        calls.filter = filter;
        return totalResults;
      }
    }),
    find: filter => {
      calls.filter = filter;
      return query;
    }
  };

  return { model, calls };
};

test('mongo pagination applies search, sorting, paging and populate',async()=>{
  const {model,calls}=createModel();

  const result=await mongoPaginate(model,{country:'Canada'},{
    page:'2',
    limit:'5',
    search:'node.js',
    searchFields:['title','summary'],
    sortBy:'postedAt:desc,title:asc',
    select:'title url',
    populate:['owner.company',{path:'skills'}],
    currentUserId:'user-1'
  });

  assert.equal(isMongooseModel(model),true);
  assert.equal(calls.filter.country,'Canada');
  assert.equal(calls.filter.$or.length,2);
  assert.equal(calls.filter.$or[0].title.source,'node\\.js');
  assert.equal(calls.sort,'-postedAt title');
  assert.equal(calls.skip,5);
  assert.equal(calls.limit,5);
  assert.equal(calls.select,'title url');
  assert.deepEqual(calls.populates[0],{
    path:'owner',
    populate:{path:'company'}
  });
  assert.deepEqual(calls.populates[1],{path:'skills'});
  assert.deepEqual(result,{
    data:[{id:'lead-1',options:{currentUserId:'user-1'}}],
    page:2,
    limit:5,
    totalPages:3,
    totalResults:12
  });
});

test('mongo pagination rejects non-Mongoose models',async()=>{
  await assert.rejects(
    mongoPaginate({}, {}, {}),
    /Expected a Mongoose model/
  );
});
