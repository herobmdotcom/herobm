import { v5 as uuidv5 } from 'uuid';
const NAMESPACE_COA = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
console.log('GST:', uuidv5('GST_CAT_GST', NAMESPACE_COA));
console.log('FRE:', uuidv5('GST_CAT_FRE', NAMESPACE_COA));
console.log('N-T:', uuidv5('GST_CAT_N-T', NAMESPACE_COA));
