import chai = require('chai');
const expect = chai.expect;
describe('My "Test" Test', function () {
   it('should be true', function () {
       const a = 12;
       expect(Boolean(a)).equal(true);
   })
});
