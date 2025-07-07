#!/usr/bin/env node

/**
 * CORS Debug Script
 * Run this script to test CORS configuration
 */

const https = require('https');
const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'https://gym-sass-backend.onrender.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://gym.nexgenbattles.com';

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Origin': FRONTEND_URL,
        'User-Agent': 'CORS-Debug-Script/1.0',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function testCORS() {
  console.log('🔍 Testing CORS Configuration...\n');
  console.log(`Backend URL: ${BACKEND_URL}`);
  console.log(`Frontend URL: ${FRONTEND_URL}\n`);

  try {
    // Test 1: Simple GET request
    console.log('1. Testing GET request...');
    const getResponse = await makeRequest(`${BACKEND_URL}/health`);
    console.log(`   Status: ${getResponse.statusCode}`);
    console.log(`   CORS Headers:`, {
      'Access-Control-Allow-Origin': getResponse.headers['access-control-allow-origin'],
      'Access-Control-Allow-Credentials': getResponse.headers['access-control-allow-credentials'],
      'Access-Control-Allow-Methods': getResponse.headers['access-control-allow-methods']
    });
    console.log('');

    // Test 2: OPTIONS preflight request
    console.log('2. Testing OPTIONS preflight request...');
    const optionsResponse = await makeRequest(`${BACKEND_URL}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    console.log(`   Status: ${optionsResponse.statusCode}`);
    console.log(`   CORS Headers:`, {
      'Access-Control-Allow-Origin': optionsResponse.headers['access-control-allow-origin'],
      'Access-Control-Allow-Credentials': optionsResponse.headers['access-control-allow-credentials'],
      'Access-Control-Allow-Methods': optionsResponse.headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': optionsResponse.headers['access-control-allow-headers']
    });
    console.log('');

    // Test 3: POST request with credentials
    console.log('3. Testing POST request with credentials...');
    const postResponse = await makeRequest(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: 'test@example.com', password: 'test' })
    });
    console.log(`   Status: ${postResponse.statusCode}`);
    console.log(`   CORS Headers:`, {
      'Access-Control-Allow-Origin': postResponse.headers['access-control-allow-origin'],
      'Access-Control-Allow-Credentials': postResponse.headers['access-control-allow-credentials']
    });

  } catch (error) {
    console.error('❌ Error during CORS test:', error.message);
  }
}

// Run the test
testCORS(); 