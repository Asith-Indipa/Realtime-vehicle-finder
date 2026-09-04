const axios = require('axios');

async function testAuth() {
  try {
    console.log('Testing User Registration...');
    const email = `driver_${Date.now()}@example.com`;
    const regRes = await axios.post('http://localhost:5000/api/auth/register', {
      name: 'Test Driver',
      email,
      password: 'password123',
      whatsappNumber: '94771234567'
    });
    console.log('✅ Registration Success:', regRes.data);

    const { token } = regRes.data;

    console.log('\nTesting Profile Fetch...');
    const profileRes = await axios.get('http://localhost:5000/api/auth/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile Fetch Success:', profileRes.data);

    console.log('\nTesting Profile Update...');
    const updateRes = await axios.put('http://localhost:5000/api/auth/profile', {
      name: 'Test Driver Updated',
      whatsappNumber: '94779998888',
      isSubscribed: true
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Profile Update Success:', updateRes.data);

    console.log('\nALL AUTH TESTS PASSED PERFECTLY!');
  } catch (err) {
    console.error('❌ Test Failed:', err.response ? err.response.data : err.message);
  }
}

testAuth();
