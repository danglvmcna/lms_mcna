import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({query:vi.fn(),issue:vi.fn(),direct:vi.fn()}));
vi.mock('../../src/server/db',()=>({pool:{query:mocks.query}}));
vi.mock('../../src/server/config',()=>({isDirectSale:mocks.direct}));
vi.mock('../../src/server/services/certificateEligibility',()=>({autoIssueCertificates:mocks.issue}));
import {runCertificateJob} from '../../src/server/services/certificateJob';

describe('background certificate batches',()=>{
  beforeEach(()=>{vi.resetAllMocks();mocks.direct.mockReturnValue(true);mocks.issue.mockResolvedValue({issued:0});});
  it('does not run in the legacy sales mode',async()=>{
    mocks.direct.mockReturnValue(false);
    expect(await runCertificateJob()).toEqual({issued:0,checked:0});
    expect(mocks.query).not.toHaveBeenCalled();
  });
  it('rotates past ineligible classes, wraps around and eventually checks every class',async()=>{
    const ids=Array.from({length:26},(_,i)=>String(i+1).padStart(3,'0'));
    let cursor='';
    mocks.query.mockImplementation(async(sql:string,params:any[]=[])=>{
      if(sql.startsWith('SELECT value'))return {rows:[{value:{lastId:cursor}}]};
      if(sql.startsWith('SELECT candidates')){
        expect(sql).toContain('ORDER BY (candidates.id > $1) DESC,candidates.id LIMIT 25');
        expect(params).toEqual([cursor]);
        return {rows:[...ids.filter(id=>id>cursor),...ids.filter(id=>id<=cursor)].slice(0,25).map(id=>({id}))};
      }
      cursor=JSON.parse(params[0]).lastId;return {rows:[]};
    });
    mocks.issue.mockImplementation(async(_pool:any,id:string)=>({issued:id==='026'?1:0}));
    expect(await runCertificateJob()).toEqual({issued:0,checked:25});
    expect(cursor).toBe('025');
    expect(await runCertificateJob()).toEqual({issued:1,checked:25});
    expect(new Set(mocks.issue.mock.calls.map(call=>call[1])).size).toBe(26);
  });
  it('does not advance a batch after a failed issuance',async()=>{
    mocks.query.mockResolvedValueOnce({rows:[{value:{lastId:'previous'}}]}).mockResolvedValueOnce({rows:[{id:'next'}]});
    mocks.issue.mockRejectedValueOnce(new Error('Temporary database failure'));
    await expect(runCertificateJob()).rejects.toThrow('Temporary database failure');
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });
  it('does not create a cursor when no classes need checking',async()=>{
    mocks.query.mockResolvedValue({rows:[]});
    expect(await runCertificateJob()).toEqual({issued:0,checked:0});
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.issue).not.toHaveBeenCalled();
  });
});
