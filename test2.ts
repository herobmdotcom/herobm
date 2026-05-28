import * as api from './packages/sdk/src/api';
async function test() {
  const dataRes = await api.productsControllerFindOne('123');
  const d = dataRes?.data;
  const d2 = dataRes?.data || dataRes;
}
