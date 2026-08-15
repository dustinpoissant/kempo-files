import install from './install.js';

/*
  Updating is the same job as installing: make sure files/ exists and is explained. Both are safe
  to run repeatedly, and neither touches anything already in there.
*/
export default async () => {
  await install();
};
