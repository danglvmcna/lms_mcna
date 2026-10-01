import {describe,it,expect} from 'vitest';
import {certificateDecision,commissionSnapshot,paymentMayPlace,teacherTier,voucherDiscount} from '../../src/operationRules';
import {certificateSvg} from '../../src/certificateDocument';

describe('direct-sale operational rules',()=>{
  it('payment never seats a direct-sale learner',()=>{expect(paymentMayPlace(true,'class')).toBe(false);expect(paymentMayPlace(false,'class')).toBe(true);expect(paymentMayPlace(false)).toBe(false);});
  const complete={expected:5,sessions:5,recorded:5,ended:true,absences:2,finalSubmitted:true};
  it('allows at most two absences, without requiring a quiz or a passing assignment score',()=>expect(certificateDecision(complete).eligible).toBe(true));
  it.each([
    {...complete,absences:3},{...complete,ended:false},{...complete,recorded:4},{...complete,sessions:4},{...complete,expected:0},{...complete,finalSubmitted:false}
  ])('does not silently approve incomplete evidence: %j',input=>expect(certificateDecision(input).eligible).toBe(false));
  it('caps a voucher at the real course price',()=>expect(voucherDiscount(200000,300000)).toEqual({originalPrice:200000,discount:200000,amount:0}));
  it.each([[0,1],[-1,1],[100,0.5],[1.5,0],[100,-1],[Infinity,0]])('rejects invalid monetary values %j',(p,v)=>expect(()=>voucherDiscount(p,v)).toThrow());
  it('does not invent a policy start date',()=>expect(commissionSnapshot('self',null).rate).toBeNull());
  it('records 10% self-service and 5% consultation during the 12-month term',()=>{const now=new Date('2026-10-01T12:00:00+07:00');expect(commissionSnapshot('self','2026-10-01',now).rate).toBe(.1);expect(commissionSnapshot('sale','2026-10-01',now).rate).toBe(.05);});
  it('does not apply policy before or at expiry',()=>{expect(commissionSnapshot('self','2026-10-01',new Date('2026-09-30T23:59:59+07:00')).rate).toBeNull();expect(commissionSnapshot('self','2026-10-01',new Date('2027-10-01T00:00:00+07:00')).rate).toBeNull();});
  it('does not infer missing teacher-tier thresholds',()=>expect(teacherTier(10,[])).toEqual({label:'Chưa cấu hình',next:null,remaining:0}));
  it('computes teacher progression from configured thresholds',()=>expect(teacherTier(3,[{label:'1.2',courses:5},{label:'1.1',courses:0}])).toEqual({label:'1.1',next:'1.2',remaining:2}));
  it('escapes untrusted names in downloadable certificates',()=>{const svg=certificateSvg({student_name:'<script>alert(1)</script>',course_title:'A & B',certificate_code:'CODE',issued_at:'2026-10-01'},'https://lms.example');expect(svg).not.toContain('<script>');expect(svg).toContain('&lt;script&gt;');expect(svg).toContain('A &amp; B');});
});
