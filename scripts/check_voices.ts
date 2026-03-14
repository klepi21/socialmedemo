import axios from 'axios';

const API_KEY = 'sk_c2c386283bc2c4f4e2afce2476fb040763ef84ad23e6b820';

async function listVoices() {
  try {
    const response = await axios.get('https://api.elevenlabs.io/v1/voices', {
      headers: {
        'xi-api-key': API_KEY
      }
    });
    
    console.log('Available Voices:');
    response.data.voices.slice(0, 10).forEach((voice: any) => {
      console.log(`- ${voice.name} | ID: ${voice.voice_id}`);
    });
  } catch (error: any) {
    console.error('Error fetching voices:', error.response?.data || error.message);
  }
}

listVoices();
