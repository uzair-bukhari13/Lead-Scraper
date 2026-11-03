import { parseStartSearchRunInput } from './search-runs.validation.mjs';

export const createSearchRunsController=({service,targetCountry})=>{
  return Object.freeze({
    start:(req,res)=>{
      const {limit}=parseStartSearchRunInput(req.body);
      const run=service.startManualRun({country:targetCountry,limit});
      res.status(202).json({...run,pollUrl:`/v1/search-runs/${run.id}`});
    },
    get:(req,res)=>{
      res.json(service.getRun(req.params.id));
    }
  });
};
