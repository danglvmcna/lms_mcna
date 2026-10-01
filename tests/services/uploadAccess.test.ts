import {describe,it,expect,vi,afterEach} from 'vitest';
import {uploadAccess,validateAttachmentOwner} from '../../src/server/services/uploadAccess';
import {User} from '../../src/types';
const learner={id:'student1',role:'student'} as User;
afterEach(()=>vi.unstubAllEnvs());
describe('private attachment authorization',()=>{
  it('rejects remote links and traversal instead of turning the LMS into an arbitrary URL proxy',async()=>{
    const db={query:vi.fn()} as any;
    for(const url of ['https://example.com/file.pdf','/uploads/../secret','/uploads/file.pdf?extra=1']) await expect(validateAttachmentOwner(db,learner,url)).rejects.toMatchObject({status:400});
    expect(db.query).not.toHaveBeenCalled();
  });
  it('rejects attaching another account upload',async()=>{const db={query:vi.fn().mockResolvedValue({rows:[{owner_id:'other'}]})} as any;await expect(validateAttachmentOwner(db,learner,'/uploads/a.pdf')).rejects.toMatchObject({status:403});});
  it('an orphaned private upload is not public',async()=>{const db={query:vi.fn().mockResolvedValue({rows:[]})} as any;expect((await uploadAccess(db,learner,'a.pdf',false)).allowed).toBe(false);});
  it('view-only brief is still blocked by a plain URL',async()=>{
    vi.stubEnv('ALLOW_HOMEWORK_DOWNLOAD','false');
    const query=vi.fn().mockResolvedValueOnce({rows:[{owner_id:'teacher'}]}).mockResolvedValueOnce({rows:[{kind:'brief',course_id:'course',session_id:'session'}]}).mockResolvedValueOnce({rows:[{section_id:'class'}]}).mockResolvedValueOnce({rows:[{}],rowCount:1});
    expect((await uploadAccess({query} as any,learner,'a.pdf',false)).allowed).toBe(false);
  });
  it('viewer header does not bypass class membership',async()=>{
    vi.stubEnv('ALLOW_HOMEWORK_DOWNLOAD','false');
    const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{kind:'brief',course_id:'course',session_id:'session'}]}).mockResolvedValueOnce({rows:[{section_id:'other'}]}).mockResolvedValueOnce({rows:[],rowCount:0});
    expect((await uploadAccess({query} as any,learner,'a.pdf',true)).allowed).toBe(false);
  });
  it('a published PDF brief can be viewed by its placed learner',async()=>{
    vi.stubEnv('ALLOW_HOMEWORK_DOWNLOAD','false');
    const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{kind:'brief',course_id:'course',session_id:'session'}]}).mockResolvedValueOnce({rows:[{section_id:'class'}]}).mockResolvedValueOnce({rows:[{}],rowCount:1});
    expect(await uploadAccess({query} as any,learner,'a.pdf',true)).toMatchObject({allowed:true,viewOnly:true});
  });
  it('unpublished solution remains private even with a viewer header',async()=>{
    const query=vi.fn().mockResolvedValueOnce({rows:[]}).mockResolvedValueOnce({rows:[{kind:'hidden',course_id:'course',session_id:'session'}]}).mockResolvedValueOnce({rows:[{section_id:'class'}]});
    expect((await uploadAccess({query} as any,learner,'answer.pdf',true)).allowed).toBe(false);
  });
});
