const request = require('supertest');
const app = require('../nlp_service/app');
const { expect } = require('chai');


describe('GET /health-check', () => {
  it('should return status 200', async () => {
    const response = await request(app)
      .get('/health-check')
      .expect(200);
  });
});