import {pool} from '../db';
import {materialStorage} from './storage';
/** Templates and copied classes may share an immutable storage object. Delete only the last reference. */
export async function removeUnreferencedMaterials(paths:string[]) {
  const removable:string[]=[];
  for(const objectPath of new Set(paths)) {
    const live=(await pool.query('SELECT 1 FROM session_materials WHERE storage_path=$1 LIMIT 1',[objectPath])).rowCount;
    const template=(await pool.query(`SELECT 1 FROM lesson_plan_templates t CROSS JOIN LATERAL jsonb_array_elements(t.sessions) s
      CROSS JOIN LATERAL jsonb_array_elements(s->'materials') m WHERE m->>'storage_path'=$1 LIMIT 1`,[objectPath])).rowCount;
    if(!live && !template) removable.push(objectPath);
  }
  if(removable.length) await materialStorage.remove(removable);
}
