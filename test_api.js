// Test file for API endpoints
// Run this with: node test_api.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/v1';

async function testAPI() {
  console.log('🚀 Testing PaVIAGen API...\n');

  try {
    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
      email: 'test@example.com',
      username: 'testuser',
      password: 'testpassword123',
      firstName: 'Test',
      lastName: 'User'
    });
    
    console.log('✅ Registration successful');
    console.log('User:', registerResponse.data.user);
    
    const token = registerResponse.data.token;
    console.log('🔑 Token received\n');

    // Test 2: Login
    console.log('2. Testing user login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'testpassword123'
    });
    
    console.log('✅ Login successful');
    console.log('User:', loginResponse.data.user);
    
    const loginToken = loginResponse.data.token;
    console.log('🔑 New token received\n');

    // Test 3: Get Profile
    console.log('3. Testing get profile...');
    const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${loginToken}`
      }
    });
    
    console.log('✅ Profile retrieved');
    console.log('Profile:', profileResponse.data.user);
    console.log('Settings:', profileResponse.data.settings);
    console.log('');

    // Test 4: Get Settings
    console.log('4. Testing get settings...');
    const settingsResponse = await axios.get(`${BASE_URL}/settings`, {
      headers: {
        'Authorization': `Bearer ${loginToken}`
      }
    });
    
    console.log('✅ Settings retrieved');
    console.log('Settings:', settingsResponse.data);
    console.log('');

    // Test 5: Update Settings
    console.log('5. Testing update settings...');
    const updateSettingsResponse = await axios.put(`${BASE_URL}/settings`, {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: false,
        sms: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${loginToken}`
      }
    });
    
    console.log('✅ Settings updated');
    console.log('Updated settings:', updateSettingsResponse.data.settings);
    console.log('');

    // Test 6: Create Conversation
    console.log('6. Testing create conversation...');
    const conversationResponse = await axios.post(`${BASE_URL}/chat/conversations`, {
      title: 'Health Consultation',
      systemPrompt: 'You are a helpful health assistant specializing in smoking cessation.'
    }, {
      headers: {
        'Authorization': `Bearer ${loginToken}`
      }
    });
    
    console.log('✅ Conversation created');
    console.log('Conversation:', conversationResponse.data.conversation);
    
    const conversationId = conversationResponse.data.conversation.id;
    console.log('');

    // Test 7: Get Conversations
    console.log('7. Testing get conversations...');
    const conversationsResponse = await axios.get(`${BASE_URL}/chat/conversations`, {
      headers: {
        'Authorization': `Bearer ${loginToken}`
      }
    });
    
    console.log('✅ Conversations retrieved');
    console.log('Conversations:', conversationsResponse.data.conversations);
    console.log('');

    // Test 8: Protected Route
    console.log('8. Testing protected route...');
    const protectedResponse = await axios.get(`${BASE_URL}/protected/dashboard`, {
      headers: {
        'Authorization': `Bearer ${loginToken}`
      }
    });
    
    console.log('✅ Protected route accessed');
    console.log('Dashboard data:', protectedResponse.data);
    console.log('');

    console.log('🎉 All API tests passed successfully!');
    console.log('');
    console.log('📝 Notes:');
    console.log('- Chat functionality requires OpenAI API key in .env file');
    console.log('- Add OPENAI_API_KEY=your_key_here to .env to test chat messages');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.response?.status) {
      console.error('Status:', error.response.status);
    }
  }
}

// Run the tests
testAPI();